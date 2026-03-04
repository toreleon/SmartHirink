'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Upload, FileText, Users, Loader2, MapPin, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [cvText, setCvText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCandidates = () => {
    api
      .listCandidates()
      .then((d) => {
        setCandidates(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(loadCandidates, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const result = await api.parseCv(file);
      toast('success', result.created ? 'Candidate created from CV' : 'Candidate profile updated from CV');
      setDialogOpen(false);
      setCvText('');
      loadCandidates();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextParse = async () => {
    if (!cvText.trim()) return;

    setParsing(true);
    try {
      const result = await api.parseCvText(cvText);
      toast('success', result.created ? 'Candidate created from CV' : 'Candidate profile updated from CV');
      setDialogOpen(false);
      setCvText('');
      loadCandidates();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="container max-w-5xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Candidates</h1>
          <p className="text-muted-foreground">Manage candidate profiles. Upload a CV to auto-create a candidate using AI.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload CV
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Parse CV to Create Candidate</DialogTitle>
              <DialogDescription>
                Upload a CV file (PDF or text) or paste CV text below. The AI will extract candidate information automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Upload CV File</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.text,.md,.csv"
                    onChange={handleFileUpload}
                    disabled={parsing}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90
                      file:cursor-pointer cursor-pointer"
                  />
                </div>
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
                <Label>CV Text</Label>
                <Textarea
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  rows={8}
                  placeholder="Paste the candidate's CV/resume text here..."
                  disabled={parsing}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleTextParse}
                disabled={parsing || !cvText.trim()}
              >
                {parsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing with AI...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Parse CV Text
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : candidates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No candidates yet</p>
            <p className="mt-1">Upload a CV to create your first candidate profile.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <Link key={c.id} href={`/candidates/${c.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold truncate">{c.fullName}</h3>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {c.experienceYears} yr{c.experienceYears !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {c.headline && (
                        <p className="text-sm text-muted-foreground truncate">{c.headline}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{c.email}</span>
                        {c.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {c.location}
                          </span>
                        )}
                      </div>
                      {c.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(c.skills || []).slice(0, 5).map((s: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                          {c.skills.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{c.skills.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
