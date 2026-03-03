'use client';

import { ArrowDown } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { TranscriptMessage } from './TranscriptMessage';
import { PartialTranscriptBubble } from './PartialTranscriptBubble';
import { AIThinkingIndicator } from './AIThinkingIndicator';
import { Button } from '@/components/ui/button';

export function TranscriptPanel() {
  const transcripts = useInterviewStore((s) => s.transcripts);
  const aiPartialText = useInterviewStore((s) => s.aiPartialText);
  const candidatePartialText = useInterviewStore((s) => s.candidatePartialText);
  const { scrollRef, bottomRef, isUserScrolledUp, scrollToBottom } = useAutoScroll();

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 transcript-container relative">
      <div className="max-w-2xl mx-auto space-y-4">
        {transcripts.length === 0 && !aiPartialText && !candidatePartialText && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Waiting for the interview to begin...</p>
          </div>
        )}

        {transcripts.map((t, i) => (
          <TranscriptMessage key={i} role={t.role} text={t.text} timestamp={t.timestamp} />
        ))}

        <AIThinkingIndicator />

        {aiPartialText && <PartialTranscriptBubble role="AI" text={aiPartialText} />}

        {candidatePartialText && (
          <PartialTranscriptBubble role="CANDIDATE" text={candidatePartialText} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* New messages pill */}
      {isUserScrolledUp && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown className="mr-1 h-3 w-3" />
            New messages
          </Button>
        </div>
      )}
    </div>
  );
}
