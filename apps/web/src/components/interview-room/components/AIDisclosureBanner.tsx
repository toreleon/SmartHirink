'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AIDisclosureBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/20 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
      <p className="text-xs text-warning-foreground">
        You are speaking with an AI interviewer. This session is recorded and transcribed automatically.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 text-warning-foreground/60 hover:text-warning-foreground shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
