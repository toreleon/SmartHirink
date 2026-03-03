'use client';

import { useContext } from 'react';
import { InterviewRoomContext, type InterviewRoomContextValue } from '../InterviewRoomProvider';

export function useInterviewRoom(): InterviewRoomContextValue {
  const ctx = useContext(InterviewRoomContext);
  if (!ctx) {
    throw new Error('useInterviewRoom must be used within InterviewRoomProvider');
  }
  return ctx;
}
