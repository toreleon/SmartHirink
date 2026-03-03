import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        // Invalid stored data
      }
    }
  },
}));

// ─── Interview Room State ────────────────────────────────
interface TranscriptEntry {
  turnId: string;
  role: 'AI' | 'CANDIDATE';
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface InterviewState {
  phase: string;
  speaking: string;
  transcripts: TranscriptEntry[];
  aiPartialText: string;
  candidatePartialText: string;
  error: string | null;
  isConnected: boolean;

  setPhase: (phase: string) => void;
  setSpeaking: (who: string) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  updatePartialTranscript: (turnId: string, text: string) => void;
  setAiPartialText: (text: string) => void;
  setCandidatePartialText: (text: string) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  phase: 'CREATED',
  speaking: 'NONE',
  transcripts: [],
  aiPartialText: '',
  candidatePartialText: '',
  error: null,
  isConnected: false,

  setPhase: (phase) => set({ phase }),
  setSpeaking: (who) => set({ speaking: who }),
  addTranscript: (entry) =>
    set((state) => ({
      transcripts: [...state.transcripts, entry],
      aiPartialText: entry.role === 'AI' ? '' : state.aiPartialText,
      candidatePartialText: entry.role === 'CANDIDATE' ? '' : state.candidatePartialText,
    })),
  updatePartialTranscript: (_turnId, text) =>
    set({ candidatePartialText: text }),
  setAiPartialText: (text) => set({ aiPartialText: text }),
  setCandidatePartialText: (text) => set({ candidatePartialText: text }),
  setError: (error) => set({ error }),
  setConnected: (connected) => set({ isConnected: connected }),
  reset: () =>
    set({
      phase: 'CREATED',
      speaking: 'NONE',
      transcripts: [],
      aiPartialText: '',
      candidatePartialText: '',
      error: null,
      isConnected: false,
    }),
}));
