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
  isHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Sync cookie for middleware
    document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
    set({ user, token, isAuthenticated: true, isHydrated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; max-age=0';
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isHydrated: true });
      } catch {
        set({ isHydrated: true });
      }
    } else {
      set({ isHydrated: true });
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

type ConnectionQuality = 'excellent' | 'good' | 'poor';

interface InterviewState {
  phase: string;
  speaking: string;
  transcripts: TranscriptEntry[];
  aiPartialText: string;
  candidatePartialText: string;
  error: string | null;
  isConnected: boolean;
  // New fields for revamped room
  vad: boolean;
  isMicMuted: boolean;
  volume: number;
  timerStartedAt: number | null;
  isUserScrolledUp: boolean;
  connectionQuality: ConnectionQuality;

  setPhase: (phase: string) => void;
  setSpeaking: (who: string) => void;
  addTranscript: (entry: TranscriptEntry) => void;
  updatePartialTranscript: (turnId: string, text: string) => void;
  setAiPartialText: (text: string) => void;
  setCandidatePartialText: (text: string) => void;
  setError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setIsMicMuted: (muted: boolean) => void;
  setConnectionQuality: (quality: ConnectionQuality) => void;
  setTimerStartedAt: (time: number | null) => void;
  reset: () => void;
}

const initialInterviewState = {
  phase: 'CREATED',
  speaking: 'NONE',
  transcripts: [] as TranscriptEntry[],
  aiPartialText: '',
  candidatePartialText: '',
  error: null as string | null,
  isConnected: false,
  vad: false,
  isMicMuted: true,
  volume: 1,
  timerStartedAt: null as number | null,
  isUserScrolledUp: false,
  connectionQuality: 'poor' as ConnectionQuality,
};

export const useInterviewStore = create<InterviewState>((set) => ({
  ...initialInterviewState,

  setPhase: (phase) => set({ phase }),
  setSpeaking: (who) => set({ speaking: who }),
  addTranscript: (entry) =>
    set((state) => ({
      transcripts: [...state.transcripts, entry],
      aiPartialText: entry.role === 'AI' ? '' : state.aiPartialText,
      candidatePartialText: entry.role === 'CANDIDATE' ? '' : state.candidatePartialText,
    })),
  updatePartialTranscript: (_turnId, text) => set({ candidatePartialText: text }),
  setAiPartialText: (text) => set({ aiPartialText: text }),
  setCandidatePartialText: (text) => set({ candidatePartialText: text }),
  setError: (error) => set({ error }),
  setConnected: (connected) => set({ isConnected: connected }),
  setIsMicMuted: (muted) => set({ isMicMuted: muted }),
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),
  setTimerStartedAt: (time) => set({ timerStartedAt: time }),
  reset: () => set(initialInterviewState),
}));
