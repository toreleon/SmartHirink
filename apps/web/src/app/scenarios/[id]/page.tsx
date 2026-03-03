'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { LoadingSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function ScenarioDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [scenario, setScenario] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [criteria, setCriteria] = useState([
    { name: '', description: '', maxScore: 10, weight: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .getScenario(id)
      .then(setScenario)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const addCriterion = () => {
    setCriteria([...criteria, { name: '', description: '', maxScore: 10, weight: 1 }]);
  };

  const updateCriterion = (i: number, field: string, value: any) => {
    const next = [...criteria];
    (next[i] as any)[field] = value;
    setCriteria(next);
  };

  const removeCriterion = (i: number) => {
    setCriteria(criteria.filter((_, idx) => idx !== i));
  };

  const handleCreateRubric = async () => {
    setSaving(true);
    try {
      await api.createRubric(id, { criteria });
      setDialogOpen(false);
      setCriteria([{ name: '', description: '', maxScore: 10, weight: 1 }]);
      load();
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="container py-16 text-center">
        <p className="text-destructive">Scenario not found</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/scenarios">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to scenarios
        </Link>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{scenario.title}</CardTitle>
            <Badge variant="secondary">{scenario.level}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {scenario.position}
          </p>

          {scenario.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {scenario.topics.map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}

          {scenario.description && (
            <div className="rounded-lg bg-muted p-3 text-sm">{scenario.description}</div>
          )}
        </CardContent>
      </Card>

      {/* Rubrics Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Evaluation Rubrics</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Rubric
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Rubric</DialogTitle>
              <DialogDescription>
                Define evaluation criteria for this scenario
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {criteria.map((c, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Criterion #{i + 1}</span>
                    {criteria.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeCriterion(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={c.name}
                        onChange={(e) => updateCriterion(i, 'name', e.target.value)}
                        placeholder="Criterion name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Description</Label>
                      <Input
                        value={c.description}
                        onChange={(e) => updateCriterion(i, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Max Score</Label>
                      <Input
                        type="number"
                        value={c.maxScore}
                        onChange={(e) =>
                          updateCriterion(i, 'maxScore', parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weight</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={c.weight}
                        onChange={(e) =>
                          updateCriterion(i, 'weight', parseFloat(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addCriterion}>
                <Plus className="mr-2 h-4 w-4" />
                Add Criterion
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateRubric}
                disabled={saving || criteria.some((c) => !c.name)}
              >
                {saving ? 'Creating...' : 'Save Rubric'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {scenario.rubrics?.length > 0 ? (
        <div className="space-y-4">
          {scenario.rubrics.map((r: any, ri: number) => (
            <Card key={r.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rubric #{ri + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Max Score</TableHead>
                      <TableHead className="text-center">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.criteria.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.description}</TableCell>
                        <TableCell className="text-center">{c.maxScore}</TableCell>
                        <TableCell className="text-center">{c.weight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No rubrics yet. Create a rubric to start evaluating candidates.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
