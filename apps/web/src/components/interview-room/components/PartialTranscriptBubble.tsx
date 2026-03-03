'use client';

import { Bot, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  role: 'AI' | 'CANDIDATE';
  text: string;
}

export function PartialTranscriptBubble({ role, text }: Props) {
  const isAI = role === 'AI';

  return (
    <div className={cn('flex gap-3', isAI ? 'justify-start' : 'justify-end')}>
      {isAI && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-4 py-3 opacity-80',
          isAI
            ? 'bg-muted border-l-2 border-primary/50'
            : 'bg-primary/70 text-primary-foreground',
        )}
      >
        <p className="text-xs font-medium mb-1 opacity-70 flex items-center gap-1">
          {isAI ? 'Interviewer' : 'You'}
          {!isAI && <Mic className="h-3 w-3 animate-pulse" />}
        </p>
        <p className={cn('text-sm', isAI ? 'streaming-cursor' : 'italic')}>
          {text}
        </p>
      </div>
      {!isAI && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/70">
          <Mic className="h-4 w-4 text-primary-foreground animate-pulse" />
        </div>
      )}
    </div>
  );
}
