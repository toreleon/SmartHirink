'use client';

import { Volume2 } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';
import { useInterviewRoom } from '../hooks/useInterviewRoom';
import { Slider } from '@/components/ui/slider';

export function VolumeControl() {
  const volume = useInterviewStore((s) => s.volume);
  const { setVolume } = useInterviewRoom();

  return (
    <div className="hidden md:flex items-center gap-2">
      <Volume2 className="h-4 w-4 text-muted-foreground" />
      <Slider
        value={[volume]}
        max={1}
        step={0.05}
        className="w-24"
        onValueChange={([v]) => setVolume(v)}
      />
    </div>
  );
}
