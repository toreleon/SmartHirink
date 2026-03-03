'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { TableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

export default function InterviewsListPage() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listInterviews({ limit: 50 })
      .then((data) => setInterviews(data.items))
      .catch((err) => toast('error', err.message || 'Failed to load interviews'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interviews</h1>
          <p className="text-muted-foreground">Manage and review all interviews</p>
        </div>
        <Button asChild>
          <Link href="/interviews/new">
            <Plus className="mr-2 h-4 w-4" />
            New Interview
          </Link>
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : interviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No interviews yet</p>
            <Button asChild variant="outline">
              <Link href="/interviews/new">Create your first interview</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scenario</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {interviews.map((i) => (
                <TableRow key={i.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/interviews/${i.id}`} className="font-medium hover:underline">
                      {i.scenario?.title || 'Interview'}
                    </Link>
                  </TableCell>
                  <TableCell>{i.candidate?.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.scenario?.position}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.scenario?.level}
                  </TableCell>
                  <TableCell>{phaseBadge(i.phase)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(i.createdAt).toLocaleDateString('en-US')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
