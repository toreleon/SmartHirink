'use client';

import { useInterviewStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function SpeakingIndicator() {
  const speaking = useInterviewStore((s) => s.speaking);

  if (speaking === 'NONE') return null;

  const isAI = speaking === 'AI';
  const label = isAI ? 'AI speaking' : 'You are speaking';

  return (
    <div className="flex items-center gap-2">
      {/* Waveform bars */}
      <div className="flex items-end gap-0.5 h-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'w-0.5 rounded-full waveform-bar',
              isAI ? 'bg-primary' : 'bg-success',
            )}
            style={{
              height: '100%',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
