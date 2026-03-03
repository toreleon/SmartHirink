'use client';

import { useInterviewStore } from '@/lib/store';
import { MicToggleButton } from './MicToggleButton';
import { VolumeControl } from './VolumeControl';
import { EndInterviewDialog } from './EndInterviewDialog';
import { Badge } from '@/components/ui/badge';

export function ControlBar() {
  const phase = useInterviewStore((s) => s.phase);

  return (
    <div className="h-16 border-t bg-background/80 backdrop-blur-xl px-4 flex items-center justify-between shrink-0">
      <VolumeControl />

      <div className="flex items-center gap-4">
        <MicToggleButton />
      </div>

      <div className="flex items-center gap-2">
        {phase === 'COMPLETED' ? (
          <Badge variant="success">Interview Complete</Badge>
        ) : (
          <EndInterviewDialog />
        )}
      </div>
    </div>
  );
}
