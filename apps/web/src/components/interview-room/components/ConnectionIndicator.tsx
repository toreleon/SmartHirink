'use client';

import { Signal, SignalLow, SignalMedium, SignalZero } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function ConnectionIndicator() {
  const quality = useInterviewStore((s) => s.connectionQuality);
  const isConnected = useInterviewStore((s) => s.isConnected);

  if (!isConnected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <SignalZero className="h-4 w-4 text-destructive" />
          </TooltipTrigger>
          <TooltipContent>Disconnected</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const Icon = quality === 'excellent' ? Signal : quality === 'good' ? SignalMedium : SignalLow;
  const color =
    quality === 'excellent'
      ? 'text-success'
      : quality === 'good'
        ? 'text-warning'
        : 'text-destructive';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={cn('h-4 w-4', color)} />
        </TooltipTrigger>
        <TooltipContent>
          Connection: {isConnected ? quality : 'disconnected'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
