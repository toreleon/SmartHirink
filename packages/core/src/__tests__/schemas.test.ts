import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  CandidateProfileCreateSchema,
  ScenarioCreateSchema,
  RubricCreateSchema,
  InterviewSessionCreateSchema,
  LiveKitTokenRequestSchema,
  AgentDataMessageSchema,
  ClientDataMessageSchema,
} from '../schemas.js';

describe('RegisterSchema', () => {
  it('accepts valid input', () => {
    const result = RegisterSchema.parse({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    });
    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe('CANDIDATE'); // default
  });

  it('rejects short password', () => {
    expect(() =>
      RegisterSchema.parse({ email: 'test@example.com', password: '123', fullName: 'Test' }),
    ).toThrow();
  });

  it('rejects invalid email', () => {
    expect(() =>
      RegisterSchema.parse({ email: 'not-email', password: 'password123', fullName: 'Test' }),
    ).toThrow();
  });
});

describe('LoginSchema', () => {
  it('accepts valid input', () => {
    const result = LoginSchema.parse({ email: 'test@example.com', password: 'pass' });
    expect(result.email).toBe('test@example.com');
  });
});

describe('CandidateProfileCreateSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = CandidateProfileCreateSchema.parse({
      fullName: 'Nguyen Van A',
      email: 'a@example.com',
    });
    expect(result.skills).toEqual([]);
    expect(result.experienceYears).toBe(0);
  });

  it('accepts full input', () => {
    const result = CandidateProfileCreateSchema.parse({
      fullName: 'Nguyen Van A',
      email: 'a@example.com',
      phone: '0901234567',
      skills: ['TypeScript', 'Node.js'],
      experienceYears: 5,
    });
    expect(result.skills).toEqual(['TypeScript', 'Node.js']);
    expect(result.experienceYears).toBe(5);
  });
});

describe('ScenarioCreateSchema', () => {
  it('applies defaults', () => {
    const result = ScenarioCreateSchema.parse({
      title: 'Backend Interview',
      description: 'Test backend skills',
      position: 'Backend Developer',
      level: 'MID',
    });
    expect(result.domain).toBe('Software Engineering');
    expect(result.questionCount).toBe(10);
    expect(result.durationMinutes).toBe(30);
    expect(result.topics).toEqual([]);
  });

  it('rejects questionCount > 30', () => {
    expect(() =>
      ScenarioCreateSchema.parse({
        title: 'Test',
        description: 'Desc',
        position: 'Dev',
        level: 'MID',
        questionCount: 50,
      }),
    ).toThrow();
  });
});

describe('RubricCreateSchema', () => {
  it('accepts valid rubric', () => {
    const result = RubricCreateSchema.parse({
      scenarioId: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Backend Interview Rubric',
      criteria: [{ name: 'Technical Depth', description: 'Deep technical knowledge' }],
    });
    expect(result.criteria[0].maxScore).toBe(5); // default
    expect(result.criteria[0].weight).toBe(0.2); // default
  });

  it('rejects empty criteria', () => {
    expect(() =>
      RubricCreateSchema.parse({
        scenarioId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Backend Interview Rubric',
        criteria: [],
      }),
    ).toThrow();
  });
});

describe('InterviewSessionCreateSchema', () => {
  it('accepts valid UUIDs', () => {
    const result = InterviewSessionCreateSchema.parse({
      scenarioId: '550e8400-e29b-41d4-a716-446655440000',
      rubricId: '550e8400-e29b-41d4-a716-446655440001',
      candidateId: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(result.scenarioId).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects non-UUID', () => {
    expect(() =>
      InterviewSessionCreateSchema.parse({
        scenarioId: 'not-uuid',
        rubricId: 'not-uuid',
        candidateId: 'not-uuid',
      }),
    ).toThrow();
  });
});

describe('LiveKitTokenRequestSchema', () => {
  it('accepts valid request', () => {
    const result = LiveKitTokenRequestSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      identity: 'candidate_123',
      role: 'candidate',
    });
    expect(result.role).toBe('candidate');
  });

  it('rejects invalid role', () => {
    expect(() =>
      LiveKitTokenRequestSchema.parse({
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        identity: 'test',
        role: 'invalid',
      }),
    ).toThrow();
  });
});

describe('AgentDataMessageSchema', () => {
  it('validates partial_transcript', () => {
    const msg = AgentDataMessageSchema.parse({
      type: 'partial_transcript',
      turnId: 'turn-1',
      text: 'hello',
      isFinal: false,
      t: Date.now(),
    });
    expect(msg.type).toBe('partial_transcript');
  });

  it('validates state message', () => {
    const msg = AgentDataMessageSchema.parse({
      type: 'state',
      phase: 'IN_PROGRESS',
      speaking: { who: 'AI' },
      vad: true,
      t: Date.now(),
    });
    expect(msg.type).toBe('state');
  });

  it('validates error message', () => {
    const msg = AgentDataMessageSchema.parse({
      type: 'error',
      code: 'STT_ERROR',
      message: 'Speech recognition failed',
      recoverable: true,
      t: Date.now(),
    });
    expect(msg.type).toBe('error');
  });

  it('rejects unknown type', () => {
    expect(() =>
      AgentDataMessageSchema.parse({
        type: 'unknown_type',
        t: Date.now(),
      }),
    ).toThrow();
  });
});

describe('ClientDataMessageSchema', () => {
  it('validates client_event', () => {
    const msg = ClientDataMessageSchema.parse({
      type: 'client_event',
      action: 'stop',
      t: Date.now(),
    });
    expect(msg.type).toBe('client_event');
  });

  it('validates candidate_metadata_update', () => {
    const msg = ClientDataMessageSchema.parse({
      type: 'candidate_metadata_update',
      languageHint: 'vi',
      t: Date.now(),
    });
    expect(msg.type).toBe('candidate_metadata_update');
  });
});
