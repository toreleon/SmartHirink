'use client';

import { ArrowDown, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { useInterviewStore } from '@/lib/store';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { TranscriptMessage } from './TranscriptMessage';
import { PartialTranscriptBubble } from './PartialTranscriptBubble';
import { AIThinkingIndicator } from './AIThinkingIndicator';
import { Button } from '@/components/ui/button';

function ConnectionStatus() {
  const isConnected = useInterviewStore((s) => s.isConnected);
  const phase = useInterviewStore((s) => s.phase);

  if (phase === 'IN_PROGRESS' || phase === 'COMPLETED') return null;

  return (
    <div className="flex flex-col items-center gap-3 py-12">
      {!isConnected ? (
        <>
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Connecting to interview agent...</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-full bg-success/10 border border-success/20 px-4 py-2">
            <Bot className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-success">AI Interviewer joined</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="text-xs text-muted-foreground">The interview will begin shortly...</p>
        </>
      )}
    </div>
  );
}

export function TranscriptPanel() {
  const transcripts = useInterviewStore((s) => s.transcripts);
  const aiPartialText = useInterviewStore((s) => s.aiPartialText);
  const candidatePartialText = useInterviewStore((s) => s.candidatePartialText);
  const { scrollRef, bottomRef, isUserScrolledUp, scrollToBottom } = useAutoScroll();

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 transcript-container relative">
      <div className="max-w-2xl mx-auto space-y-4">
        {transcripts.length === 0 && !aiPartialText && !candidatePartialText && (
          <ConnectionStatus />
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
