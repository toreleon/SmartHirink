'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Plus, Upload, FileText, Loader2, CheckCircle, ClipboardList } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [jdDialogOpen, setJdDialogOpen] = useState(false);
  const [jdText, setJdText] = useState('');
  const [parsingJd, setParsingJd] = useState(false);
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    position: '',
    level: 'JUNIOR',
    language: 'en',
    description: '',
    topics: '',
  });
  const [saving, setSaving] = useState(false);

  const loadScenarios = () => {
    api
      .listScenarios()
      .then((d) => {
        setScenarios(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(loadScenarios, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.createScenario({
        ...form,
        topics: form.topics
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean),
      });
      setDialogOpen(false);
      setForm({ title: '', position: '', level: 'JUNIOR', language: 'en', description: '', topics: '' });
      loadScenarios();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleJdFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsingJd(true);
    try {
      const result = await api.parseJd(file);
      toast('success', `Scenario "${result.scenario.title}" and rubric created from JD`);
      setJdDialogOpen(false);
      setJdText('');
      loadScenarios();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setParsingJd(false);
      if (jdFileInputRef.current) jdFileInputRef.current.value = '';
    }
  };

  const handleJdTextParse = async () => {
    if (!jdText.trim()) return;

    setParsingJd(true);
    try {
      const result = await api.parseJdText(jdText);
      toast('success', `Scenario "${result.scenario.title}" and rubric created from JD`);
      setJdDialogOpen(false);
      setJdText('');
      loadScenarios();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setParsingJd(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scenarios</h1>
          <p className="text-muted-foreground">Interview scenarios and question templates</p>
        </div>

        <div className="flex gap-2">
        <Dialog open={jdDialogOpen} onOpenChange={setJdDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload JD
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Parse Job Description</DialogTitle>
              <DialogDescription>
                Upload a JD file (PDF or text) or paste text below. AI will create a scenario and rubric automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Upload JD File</Label>
                <input
                  ref={jdFileInputRef}
                  type="file"
                  accept=".pdf,.txt,.text,.md,.csv"
                  onChange={handleJdFileUpload}
                  disabled={parsingJd}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    file:cursor-pointer cursor-pointer"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or paste text</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Description Text</Label>
                <Textarea
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                  placeholder="Paste the job description text here..."
                  disabled={parsingJd}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleJdTextParse}
                disabled={parsingJd || !jdText.trim()}
              >
                {parsingJd ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing with AI...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Parse JD Text
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Scenario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Scenario</DialogTitle>
              <DialogDescription>
                Define a new interview scenario with topics and configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Backend Developer Interview"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Input
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g. Backend Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={form.level}
                    onValueChange={(v) => setForm({ ...form, level: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERN">Intern</SelectItem>
                      <SelectItem value="JUNIOR">Junior</SelectItem>
                      <SelectItem value="MID">Mid</SelectItem>
                      <SelectItem value="SENIOR">Senior</SelectItem>
                      <SelectItem value="LEAD">Lead</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Interview Language</Label>
                <Select
                  value={form.language}
                  onValueChange={(v) => setForm({ ...form, language: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="vi">Vietnamese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Topics (comma-separated)</Label>
                <Input
                  value={form.topics}
                  onChange={(e) => setForm({ ...form, topics: e.target.value })}
                  placeholder="e.g. Node.js, TypeScript, System Design"
                />
              </div>
              <div className="space-y-2">
                <Label>System context (optional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Additional context for the AI interviewer..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={saving || !form.title || !form.position}
              >
                {saving ? 'Creating...' : 'Create Scenario'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : scenarios.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No scenarios yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scenarios.map((s) => {
            const rubricCount = s.rubrics?.length ?? 0;
            return (
              <Link key={s.id} href={`/scenarios/${s.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{s.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        {rubricCount > 0 ? (
                          <Badge variant="default" className="text-xs flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Rubric
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            No Rubric
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {s.language === 'vi' ? 'Vietnamese' : 'English'}
                        </Badge>
                        <Badge variant="secondary">{s.level}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {s.position} &middot; {s.domain || 'Software Engineering'} &middot; {s.questionCount || 10} questions &middot; {s.durationMinutes || 30} min
                    </p>
                    {s.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.topics.map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
