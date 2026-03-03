const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    // Add 30s buffer
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (typeof window === 'undefined') return;
    if (token) {
      localStorage.setItem('token', token);
      // Also set cookie for middleware
      document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`;
    } else {
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; max-age=0';
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
      ...((options.headers as Record<string, string>) || {}),
    };

    // Only set Content-Type for requests that have a body
    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();

    // Check token expiration before making request
    if (token && isTokenExpired(token)) {
      this.handleUnauthorized();
      throw new Error('Token expired');
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // 401 interceptor — clear auth and redirect
    if (res.status === 401) {
      this.handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `API Error: ${res.status}`);
    }

    if (res.status === 204) return {} as T;
    return res.json();
  }

  private handleUnauthorized() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
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

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async updateProfile(data: { fullName?: string; email?: string }) {
    return this.request<any>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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
  async listScenarios(params?: { page?: number; position?: string; level?: string; domain?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.position) search.set('position', params.position);
    if (params?.level) search.set('level', params.level);
    if (params?.domain) search.set('domain', params.domain);
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

  async updateCandidateProfile(data: any) {
    return this.request<any>('/candidates/profile', { method: 'POST', body: JSON.stringify(data) });
  }

  // ─── Rubrics ───────────────────────────────────────────
  async createRubric(scenarioId: string, data: { criteria: any[] }) {
    return this.request<any>('/rubrics', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, criteria: data.criteria }),
    });
  }

  logout() {
    this.request('/auth/logout', { method: 'POST' }).catch(() => {});
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
  }
}

export const api = new ApiClient();
