'use client';

import { useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';
import { useInterviewRoom } from '../hooks/useInterviewRoom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function MicToggleButton() {
  const isMicMuted = useInterviewStore((s) => s.isMicMuted);
  const vad = useInterviewStore((s) => s.vad);
  const { toggleMic } = useInterviewRoom();

  // Keyboard shortcut: M
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMic]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isMicMuted ? 'destructive' : 'secondary'}
            size="icon"
            className={cn(
              'h-12 w-12 rounded-full transition-all',
              !isMicMuted && vad && 'ring-2 ring-success ring-offset-2 ring-offset-background',
            )}
            onClick={toggleMic}
          >
            {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMicMuted ? 'Unmute microphone (M)' : 'Mute microphone (M)'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
