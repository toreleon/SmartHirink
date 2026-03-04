'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowLeft, Mic, CheckCircle, AlertTriangle, Bot, User, Mail, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { LoadingSkeleton } from '@/components/skeletons';
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

export default function InterviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hydrate } = useAuthStore();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const id = params.id as string;

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .getInterview(id)
      .then(setInterview)
      .catch((err) => toast('error', err.message || 'Failed to load interview'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const data = await api.getInterviewConnection(id);
      setSessionId(data.sessionId);
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    try {
      await api.startInterview(id);
      const updated = await api.getInterview(id);
      setInterview(updated);
    } catch (err: any) {
      toast('error', err.message);
    }
  };

  const handleSendInvite = async () => {
    setSendingInvite(true);
    try {
      const result = await api.sendInvite(id);
      setInviteUrl(result.inviteUrl);
      // Refresh interview to get inviteSentAt
      const updated = await api.getInterview(id);
      setInterview(updated);
      toast('success', 'Interview invite email sent to candidate');
    } catch (err: any) {
      toast('error', err.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast('success', 'Invite URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <LoadingSkeleton lines={8} />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="container py-16 text-center">
        <p className="text-destructive">Interview not found</p>
      </div>
    );
  }

  if (sessionId) {
    return (
      <InterviewRoom
        sessionId={sessionId}
        onSessionComplete={() => {
          router.push(`/interviews/${id}/results`);
        }}
      />
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/interviews">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to interviews
        </Link>
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{interview.scenario?.title || 'Interview'}</CardTitle>
            <Badge
              variant={
                interview.phase === 'COMPLETED'
                  ? 'success'
                  : interview.phase === 'CANCELLED'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {interview.phase}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2">Interview Details</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Position</dt>
                  <dd>{interview.scenario?.position}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Level</dt>
                  <dd>{interview.scenario?.level}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="font-mono text-xs">{interview.id}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Candidate</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>{interview.candidate?.fullName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{interview.candidate?.email}</dd>
                </div>
              </dl>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Disclosure */}
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
              <CheckCircle className="h-4 w-4 text-success" />
              Ensure your microphone is working
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Stable internet connection required
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Find a quiet environment
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Be ready to respond in English
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Invite Status */}
      {interview.inviteSentAt && (
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          Invite sent {new Date(interview.inviteSentAt).toLocaleString()}
        </div>
      )}

      {/* Invite URL (shown after sending) */}
      {inviteUrl && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                {inviteUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyInviteUrl}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {/* Send Invite - for RECRUITER/ADMIN when session is not terminal */}
        {(user?.role === 'RECRUITER' || user?.role === 'ADMIN') &&
          !['COMPLETED', 'CANCELLED', 'NO_SHOW', 'IN_PROGRESS'].includes(interview.phase) && (
            <Button variant="outline" onClick={handleSendInvite} disabled={sendingInvite}>
              <Mail className="mr-2 h-4 w-4" />
              {sendingInvite
                ? 'Sending...'
                : interview.inviteSentAt
                  ? 'Resend Invite Email'
                  : 'Send Invite Email'}
            </Button>
          )}

        {interview.phase === 'CREATED' && user?.role === 'RECRUITER' && (
          <Button variant="success" onClick={handleStart}>
            Start Interview Session
          </Button>
        )}

        {(interview.phase === 'WAITING' || interview.phase === 'CREATED') && (
          <Button onClick={handleJoin} disabled={joining} size="lg">
            <Mic className="mr-2 h-4 w-4" />
            {joining ? 'Connecting...' : 'Join Interview'}
          </Button>
        )}

        {interview.phase === 'COMPLETED' && (
          <Button asChild>
            <Link href={`/interviews/${id}/results`}>View Results</Link>
          </Button>
        )}
      </div>

      {/* Transcript Preview */}
      {interview.turns && interview.turns.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {interview.turns.map((turn: any, i: number) => (
                <div key={i} className="flex gap-3">
                  {turn.speakerRole === 'AI' ? (
                    <Bot className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  ) : (
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  )}
                  <p className="text-sm">{turn.transcript}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
