'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function NewInterviewPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [selectedRubric, setSelectedRubric] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarioDetail, setScenarioDetail] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.listScenarios(), api.listCandidates()]).then(([s, c]) => {
      setScenarios(s.items);
      setCandidates(c.items);
    });
  }, []);

  useEffect(() => {
    if (selectedScenario) {
      api.getScenario(selectedScenario).then((s) => {
        setScenarioDetail(s);
        if (s.rubrics?.length > 0) {
          setSelectedRubric(s.rubrics[0].id);
        }
      });
    }
  }, [selectedScenario]);

  const handleCreate = async () => {
    if (!selectedScenario || !selectedRubric || !selectedCandidate) {
      toast('warning', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const interview = await api.createInterview({
        scenarioId: selectedScenario,
        rubricId: selectedRubric,
        candidateId: selectedCandidate,
      });
      router.push(`/interviews/${interview.id}`);
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/interviews">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to interviews
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Create Interview</h1>
        <p className="text-muted-foreground">Set up a new AI-powered interview session</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interview Configuration</CardTitle>
          <CardDescription>Select the scenario, rubric, and candidate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Interview Scenario</Label>
            <Select value={selectedScenario} onValueChange={setSelectedScenario}>
              <SelectTrigger>
                <SelectValue placeholder="Select a scenario..." />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.position} - {s.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {scenarioDetail?.rubrics?.length > 0 && (
            <div className="space-y-2">
              <Label>Evaluation Rubric</Label>
              <Select value={selectedRubric} onValueChange={setSelectedRubric}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scenarioDetail.rubrics.map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      Rubric ({r.criteria.length} criteria)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Candidate</Label>
            <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
              <SelectTrigger>
                <SelectValue placeholder="Select a candidate..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fullName} ({c.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading || !selectedScenario || !selectedCandidate}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Interview'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
