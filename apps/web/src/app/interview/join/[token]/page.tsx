'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Mic, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const InterviewRoom = dynamic(() => import('@/components/interview-room'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <p className="text-muted-foreground">Loading interview room...</p>
    </div>
  ),
});

export default function CandidateInterviewPage() {
  const params = useParams();
  const token = params.token as string;

  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getInviteInterview(token)
      .then(setInterview)
      .catch((err) => setError(err.message || 'Failed to load interview'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const data = await api.joinInviteInterview(token);
      setSessionId(data.sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to join interview');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading interview details...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Interview Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Please check your invite link or contact the recruiter.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render interview room once joined
  if (sessionId) {
    return (
      <InterviewRoom
        sessionId={sessionId}
        onSessionComplete={() => {
          setSessionId(null);
          setInterview({ ...interview, phase: 'COMPLETED' });
        }}
      />
    );
  }

  const isTerminal = ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(interview?.phase);
  const canJoin = !isTerminal;

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header for candidates */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">SmartHirink</span>
          </div>
        </div>
      </header>

      <div className="container max-w-3xl py-8 px-4">
        {/* Interview Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{interview?.scenario?.title || 'Interview'}</CardTitle>
              <Badge
                variant={
                  interview?.phase === 'COMPLETED'
                    ? 'success'
                    : interview?.phase === 'CANCELLED'
                      ? 'destructive'
                      : 'warning'
                }
              >
                {interview?.phase === 'CREATED' || interview?.phase === 'SCHEDULED'
                  ? 'READY'
                  : interview?.phase}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Position</dt>
                <dd className="font-medium">{interview?.scenario?.position}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium">{interview?.scenario?.level}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Duration</dt>
                <dd className="font-medium">{interview?.scenario?.durationMinutes} minutes</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Candidate</dt>
                <dd className="font-medium">{interview?.candidate?.fullName}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Completed/Cancelled state */}
        {isTerminal && (
          <Alert variant={interview?.phase === 'COMPLETED' ? 'default' : 'destructive'} className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {interview?.phase === 'COMPLETED'
                ? 'Interview Completed'
                : interview?.phase === 'CANCELLED'
                  ? 'Interview Cancelled'
                  : 'No Show'}
            </AlertTitle>
            <AlertDescription>
              {interview?.phase === 'COMPLETED'
                ? 'This interview has been completed. Thank you for participating.'
                : 'This interview is no longer available. Please contact your recruiter.'}
            </AlertDescription>
          </Alert>
        )}

        {/* AI Disclosure */}
        {!isTerminal && (
          <>
            <Alert variant="warning" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>AI-Powered Interview</AlertTitle>
              <AlertDescription>
                This interview is conducted by an AI interviewer. The session is recorded and
                automatically transcribed. Evaluation results are advisory only.
              </AlertDescription>
            </Alert>

            {/* Pre-join Checklist */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Before You Begin</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Ensure your microphone is working
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Stable internet connection required
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Find a quiet environment
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Be ready to respond in English
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <div className="mb-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Join Button */}
            {canJoin && (
              <div className="flex justify-center">
                <Button onClick={handleJoin} disabled={joining} size="lg" className="px-8">
                  <Mic className="mr-2 h-5 w-5" />
                  {joining ? 'Connecting...' : 'Join Interview'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
