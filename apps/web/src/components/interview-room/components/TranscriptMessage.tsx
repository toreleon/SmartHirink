'use client';

import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  role: 'AI' | 'CANDIDATE';
  text: string;
  timestamp?: number;
}

export function TranscriptMessage({ role, text, timestamp }: Props) {
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
          'max-w-[80%] rounded-lg px-4 py-3',
          isAI
            ? 'bg-muted border-l-2 border-primary'
            : 'bg-primary text-primary-foreground',
        )}
      >
        <p className="text-xs font-medium mb-1 opacity-70">
          {isAI ? 'Interviewer' : 'You'}
        </p>
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        {timestamp && (
          <p className={cn('text-xs mt-1', isAI ? 'text-muted-foreground' : 'opacity-60')}>
            {new Date(timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>
      {!isAI && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
