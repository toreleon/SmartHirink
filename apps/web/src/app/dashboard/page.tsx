'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, CheckCircle2, Clock, PlayCircle, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function phaseBadge(phase: string) {
  switch (phase) {
    case 'COMPLETED':
      return <Badge variant="success">{phase}</Badge>;
    case 'CANCELLED':
      return <Badge variant="destructive">{phase}</Badge>;
    default:
      return <Badge variant="warning">{phase}</Badge>;
  }
}

export default function DashboardPage() {
  const { user, hydrate, isHydrated } = useAuthStore();
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!isHydrated || !user) return;
    api
      .listInterviews({ limit: 10 })
      .then((data) => setInterviews(data.items))
      .catch((err) => toast('error', err.message || 'Failed to load interviews'))
      .finally(() => setLoading(false));
  }, [user, isHydrated]);

  if (!isHydrated) {
    return (
      <div className="container py-8">
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-16 text-center">
        <p className="text-muted-foreground">
          Please{' '}
          <Link href="/login" className="text-primary underline">
            sign in
          </Link>{' '}
          to continue.
        </p>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Interviews',
      value: interviews.length,
      icon: Users,
    },
    {
      label: 'Pending',
      value: interviews.filter((i) => i.phase === 'WAITING' || i.phase === 'CREATED').length,
      icon: Clock,
      color: 'text-warning',
    },
    {
      label: 'Completed',
      value: interviews.filter((i) => i.phase === 'COMPLETED').length,
      icon: CheckCircle2,
      color: 'text-success',
    },
    {
      label: 'In Progress',
      value: interviews.filter((i) => ['INTRO', 'QUESTIONING', 'WRAP_UP'].includes(i.phase)).length,
      icon: PlayCircle,
      color: 'text-primary',
    },
  ];

  return (
    <div className="container py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.fullName}
          </p>
        </div>
        {(user.role === 'RECRUITER' || user.role === 'ADMIN') && (
          <Button asChild>
            <Link href="/interviews/new">
              <Plus className="mr-2 h-4 w-4" />
              New Interview
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color || 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Interviews */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interviews</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={4} />
          ) : interviews.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No interviews yet. Create your first interview to get started.
            </div>
          ) : (
            <div className="divide-y">
              {interviews.map((interview) => (
                <Link
                  key={interview.id}
                  href={`/interviews/${interview.id}`}
                  className="flex items-center justify-between py-4 transition-colors hover:bg-muted/50 -mx-6 px-6"
                >
                  <div>
                    <p className="font-medium">{interview.scenario?.title || 'Interview'}</p>
                    <p className="text-sm text-muted-foreground">
                      {interview.candidate?.fullName} &middot; {interview.scenario?.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {phaseBadge(interview.phase)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(interview.createdAt).toLocaleDateString('en-US')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
