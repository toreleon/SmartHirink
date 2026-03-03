'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Bot, User, ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function recommendationBadge(rec: string) {
  switch (rec) {
    case 'STRONG_YES':
    case 'YES':
      return <Badge variant="success">{rec.replace('_', ' ')}</Badge>;
    case 'MAYBE':
      return <Badge variant="warning">{rec}</Badge>;
    default:
      return <Badge variant="destructive">{rec}</Badge>;
  }
}

export default function ResultsPage() {
  const params = useParams();
  const id = params.id as string;
  const [scoreCard, setScoreCard] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getInterview(id).catch(() => null),
      api.getScoreCard(id).catch(() => null),
      api.getReport(id).catch(() => null),
    ])
      .then(([interviewData, scoreData, reportData]) => {
        setInterview(interviewData);
        setScoreCard(scoreData);
        setReport(reportData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  const criterionScores = scoreCard?.criterionScores || [];
  const scorePercent = scoreCard
    ? (scoreCard.overallScore / scoreCard.maxPossibleScore) * 100
    : 0;

  return (
    <div className="container max-w-4xl py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href={`/interviews/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to interview
        </Link>
      </Button>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Interview Results</h1>

      {scoreCard ? (
        <Tabs defaultValue="scorecard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            {report?.pdfUrl && <TabsTrigger value="report">Report</TabsTrigger>}
          </TabsList>

          <TabsContent value="scorecard" className="space-y-6">
            {/* Overall Score */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Overall Assessment</CardTitle>
                  {recommendationBadge(scoreCard.recommendation)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-4xl font-bold text-primary">
                    {scoreCard.overallScore.toFixed(1)}
                  </div>
                  <div className="text-muted-foreground">
                    / {scoreCard.maxPossibleScore.toFixed(1)} points
                  </div>
                  <div className="flex-1">
                    <Progress value={scorePercent} className="h-3" />
                  </div>
                </div>

                {/* Strengths & Weaknesses */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 font-medium text-success mb-2">
                      <ThumbsUp className="h-4 w-4" />
                      Strengths
                    </h3>
                    <ul className="space-y-1">
                      {scoreCard.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          &bull; {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 font-medium text-destructive mb-2">
                      <ThumbsDown className="h-4 w-4" />
                      Areas for Improvement
                    </h3>
                    <ul className="space-y-1">
                      {scoreCard.weaknesses.map((w: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          &bull; {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Criterion Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Criterion Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criterion</TableHead>
                      <TableHead className="w-32">Score</TableHead>
                      <TableHead>Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {criterionScores.map((cs: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{cs.criterionName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-primary">
                              {cs.score}/{cs.maxScore}
                            </span>
                            <Progress
                              value={(cs.score / cs.maxScore) * 100}
                              className="h-2 flex-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {cs.reasoning}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Interview Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {interview?.turns && interview.turns.length > 0 ? (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto">
                    {interview.turns.map((turn: any, i: number) => (
                      <div
                        key={i}
                        className={`flex gap-3 rounded-lg p-3 ${
                          turn.speakerRole === 'AI' ? 'bg-muted' : 'bg-primary/5'
                        }`}
                      >
                        {turn.speakerRole === 'AI' ? (
                          <Bot className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                        ) : (
                          <User className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {turn.speakerRole === 'AI' ? 'Interviewer' : 'Candidate'}
                            {turn.e2eLatencyMs && (
                              <span className="ml-2 opacity-60">
                                ({turn.e2eLatencyMs}ms)
                              </span>
                            )}
                          </p>
                          <p className="text-sm">{turn.transcript}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No transcript available
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {report?.pdfUrl && (
            <TabsContent value="report">
              <Card>
                <CardContent className="py-12 text-center">
                  <Download className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">PDF Report</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download the full interview report
                  </p>
                  <Button asChild>
                    <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Download Report
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Evaluation in progress... Results will be available in a few minutes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="mt-6 rounded-lg bg-muted p-4 text-center">
        <p className="text-xs text-muted-foreground">
          This report was generated automatically by AI. Results are advisory only. Recruiters
          should review independently before making final decisions.
        </p>
      </div>
    </div>
  );
}
