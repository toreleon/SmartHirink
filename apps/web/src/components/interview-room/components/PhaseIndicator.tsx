'use client';

import { useInterviewStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';

const phaseConfig: Record<string, { label: string; variant: string }> = {
  CREATED: { label: 'Connecting', variant: 'secondary' },
  WAITING: { label: 'Waiting for agent', variant: 'secondary' },
  SCHEDULED: { label: 'Scheduled', variant: 'secondary' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  NO_SHOW: { label: 'No Show', variant: 'destructive' },
};

export function PhaseIndicator() {
  const phase = useInterviewStore((s) => s.phase);
  const isConnected = useInterviewStore((s) => s.isConnected);

  const config = phaseConfig[phase] ?? { label: phase, variant: 'secondary' };

  // Override label when connected but not yet in progress
  const label =
    isConnected && (phase === 'CREATED' || phase === 'WAITING')
      ? 'Agent joined'
      : config.label;

  const variant =
    isConnected && (phase === 'CREATED' || phase === 'WAITING')
      ? 'success'
      : config.variant;

  return (
    <Badge variant={variant as any} className="text-xs">
      {label}
    </Badge>
  );
}
