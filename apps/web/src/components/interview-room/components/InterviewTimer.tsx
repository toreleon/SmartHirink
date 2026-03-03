'use client';

import { Clock } from 'lucide-react';
import { useInterviewTimer } from '../hooks/useInterviewTimer';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function InterviewTimer({ durationMinutes = 30 }: { durationMinutes?: number }) {
  const { elapsedFormatted, totalFormatted, percent, isWarning, isOvertime } =
    useInterviewTimer(durationMinutes);

  return (
    <div className="flex items-center gap-2">
      <Clock className={cn('h-4 w-4', isOvertime ? 'text-destructive' : isWarning ? 'text-warning' : 'text-muted-foreground')} />
      <span
        className={cn(
          'text-xs font-mono tabular-nums',
          isOvertime ? 'text-destructive' : isWarning ? 'text-warning' : 'text-muted-foreground',
        )}
      >
        {elapsedFormatted} / {totalFormatted}
      </span>
      <Progress
        value={percent}
        className={cn(
          'h-1.5 w-20',
          isOvertime && '[&>div]:bg-destructive',
          isWarning && !isOvertime && '[&>div]:bg-warning',
        )}
      />
    </div>
  );
}
