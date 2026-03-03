const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `API Error: ${res.status}`);
    }

    if (res.status === 204) return {} as T;
    return res.json();
  }

  // ─── Auth ──────────────────────────────────────────────
  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async register(email: string, password: string, fullName: string, role: string) {
    const data = await this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, fullName, role }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // ─── Interviews ────────────────────────────────────────
  async listInterviews(params?: { page?: number; limit?: number; phase?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.phase) search.set('phase', params.phase);
    return this.request<{ total: number; items: any[] }>(`/interviews?${search}`);
  }

  async getInterview(id: string) {
    return this.request<any>(`/interviews/${id}`);
  }

  async createInterview(data: { scenarioId: string; rubricId: string; candidateId: string }) {
    return this.request<any>('/interviews', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async startInterview(id: string) {
    return this.request<any>(`/interviews/${id}/start`, { method: 'POST' });
  }

  async finishInterview(id: string) {
    return this.request<any>(`/interviews/${id}/finish`, { method: 'POST' });
  }

  async getTranscript(id: string) {
    return this.request<any[]>(`/interviews/${id}/transcript`);
  }

  async getScoreCard(id: string) {
    return this.request<any>(`/interviews/${id}/scorecard`);
  }

  async getReport(id: string) {
    return this.request<any>(`/interviews/${id}/report`);
  }

  // ─── LiveKit Token ─────────────────────────────────────
  async getLiveKitToken(sessionId: string, role: 'candidate' | 'recruiter') {
    return this.request<{ token: string; room: string; identity: string }>('/interviews/token', {
      method: 'POST',
      body: JSON.stringify({ sessionId, role, identity: `${role}_user` }),
    });
  }

  // ─── Scenarios ─────────────────────────────────────────
  async listScenarios(params?: { page?: number }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    return this.request<{ total: number; items: any[] }>(`/scenarios?${search}`);
  }

  async createScenario(data: any) {
    return this.request<any>('/scenarios', { method: 'POST', body: JSON.stringify(data) });
  }

  async getScenario(id: string) {
    return this.request<any>(`/scenarios/${id}`);
  }

  // ─── Candidates ────────────────────────────────────────
  async listCandidates(params?: { page?: number }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    return this.request<{ total: number; items: any[] }>(`/candidates?${search}`);
  }

  async updateProfile(data: any) {
    return this.request<any>('/candidates/profile', { method: 'POST', body: JSON.stringify(data) });
  }

  // ─── Rubrics ───────────────────────────────────────────
  async createRubric(data: any) {
    return this.request<any>('/rubrics', { method: 'POST', body: JSON.stringify(data) });
  }

  logout() {
    this.setToken(null);
  }
}

export const api = new ApiClient();
