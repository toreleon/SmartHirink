'use client';

import { useInterviewStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';

export function PhaseIndicator() {
  const phase = useInterviewStore((s) => s.phase);

  const variant =
    phase === 'COMPLETED'
      ? 'success'
      : phase === 'CANCELLED'
        ? 'destructive'
        : 'secondary';

  return (
    <Badge variant={variant as any} className="text-xs">
      {phase}
    </Badge>
  );
}
