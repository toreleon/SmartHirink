'use client';

import { Bot } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';

export function AIThinkingIndicator() {
  const speaking = useInterviewStore((s) => s.speaking);
  const aiPartialText = useInterviewStore((s) => s.aiPartialText);

  // Only show when AI is supposed to respond but hasn't started outputting text yet
  if (speaking !== 'AI' || aiPartialText) return null;

  return (
    <div className="flex gap-3 justify-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="bg-muted border-l-2 border-primary/50 rounded-lg px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
