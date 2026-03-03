'use client';

import { CheckCircle2 } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';

export function CompletionOverlay() {
  const phase = useInterviewStore((s) => s.phase);

  if (phase !== 'COMPLETED') return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in-up">
      <div className="text-center">
        <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
        <h2 className="text-2xl font-bold mb-2">Interview Complete</h2>
        <p className="text-muted-foreground">
          Redirecting to results...
        </p>
      </div>
    </div>
  );
}
