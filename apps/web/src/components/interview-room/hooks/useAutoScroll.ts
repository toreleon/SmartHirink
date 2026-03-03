'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useInterviewStore } from '@/lib/store';

export function useAutoScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useInterviewStore((s) => s.isUserScrolledUp);
  const transcripts = useInterviewStore((s) => s.transcripts);
  const aiPartialText = useInterviewStore((s) => s.aiPartialText);
  const candidatePartialText = useInterviewStore((s) => s.candidatePartialText);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    useInterviewStore.setState({ isUserScrolledUp: false });
  }, []);

  // Detect manual scroll up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      useInterviewStore.setState({ isUserScrolledUp: !isAtBottom });
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll when new content arrives (if not scrolled up)
  useEffect(() => {
    if (!isUserScrolledUp) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, aiPartialText, candidatePartialText, isUserScrolledUp]);

  return { scrollRef, bottomRef, isUserScrolledUp, scrollToBottom };
}
