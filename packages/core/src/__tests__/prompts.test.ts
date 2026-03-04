import { describe, it, expect } from 'vitest';
import {
  buildOrchestratorSystemPrompt,
  buildOrchestratorUserMessage,
  buildEvaluatorPrompt,
  buildIntroMessage,
  buildOutroMessage,
} from '../prompts.js';

describe('buildOrchestratorSystemPrompt', () => {
  it('includes position and level (en)', () => {
    const prompt = buildOrchestratorSystemPrompt({
      position: 'Backend Engineer',
      level: 'Mid-level',
      domain: 'Software Engineering',
      topics: ['Node.js', 'System Design'],
      candidateName: 'Nguyen Van A',
      candidateSummary: 'Skills: TypeScript',
      questionCount: 10,
      previousTurns: [],
      currentQuestionIndex: 0,
      language: 'en',
    });
    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('Mid-level');
    expect(prompt).toContain('Software Engineering');
    expect(prompt).toContain('Nguyen Van A');
    expect(prompt).toContain('1. Node.js');
    expect(prompt).toContain('2. System Design');
  });

  it('uses Vietnamese prompt when language is vi', () => {
    const prompt = buildOrchestratorSystemPrompt({
      position: 'Backend Engineer',
      level: 'Mid-level',
      domain: 'Software Engineering',
      topics: [],
      candidateName: 'Test',
      candidateSummary: '',
      questionCount: 5,
      previousTurns: [],
      currentQuestionIndex: 0,
      language: 'vi',
    });
    expect(prompt).toContain('QUY TẮC BẮT BUỘC');
  });

  it('includes RAG context when provided', () => {
    const prompt = buildOrchestratorSystemPrompt({
      position: 'Dev',
      level: 'Junior',
      domain: 'SE',
      topics: [],
      candidateName: 'Test',
      candidateSummary: '',
      questionCount: 5,
      previousTurns: [],
      currentQuestionIndex: 0,
      retrievedContext: 'Some RAG context here',
      language: 'en',
    });
    expect(prompt).toContain('Some RAG context here');
  });

  it('omits RAG section when no context', () => {
    const prompt = buildOrchestratorSystemPrompt({
      position: 'Dev',
      level: 'Junior',
      domain: 'SE',
      topics: [],
      candidateName: 'Test',
      candidateSummary: '',
      questionCount: 5,
      previousTurns: [],
      currentQuestionIndex: 0,
      language: 'en',
    });
    expect(prompt).not.toContain('SUPPLEMENTARY CONTEXT');
  });
});

describe('buildOrchestratorUserMessage', () => {
  it('includes conversation history and latest text (en)', () => {
    const msg = buildOrchestratorUserMessage(
      [
        { role: 'AI', text: 'Hello' },
        { role: 'CANDIDATE', text: 'Hi there' },
      ],
      'My answer about Node.js',
      'en',
    );
    expect(msg).toContain('My answer about Node.js');
    expect(msg).toContain('[Interviewer]: Hello');
    expect(msg).toContain('[Candidate]: Hi there');
  });

  it('uses Vietnamese labels when language is vi', () => {
    const msg = buildOrchestratorUserMessage(
      [{ role: 'AI', text: 'Hello' }],
      'My answer',
      'vi',
    );
    expect(msg).toContain('[Phỏng vấn viên]: Hello');
  });
});

describe('buildEvaluatorPrompt', () => {
  it('includes all rubric criteria', () => {
    const prompt = buildEvaluatorPrompt({
      position: 'Backend Engineer',
      level: 'Mid-level',
      candidateName: 'Test',
      rubricCriteria: [
        { name: 'Technical Depth', description: 'Deep knowledge', maxScore: 10, weight: 0.5 },
        { name: 'Communication', description: 'Clear explanation', maxScore: 10, weight: 0.5 },
      ],
      transcript: [
        { role: 'AI', text: 'Tell me about Node.js' },
        { role: 'CANDIDATE', text: 'Node.js is a runtime...' },
      ],
      jobDescription: 'Build scalable APIs',
    });
    expect(prompt).toContain('Technical Depth');
    expect(prompt).toContain('Communication');
    expect(prompt).toContain('Backend Engineer');
    expect(prompt).toContain('Build scalable APIs');
    expect(prompt).toContain('Node.js is a runtime');
    expect(prompt).toContain('STRONG_YES|YES|MAYBE|NO|STRONG_NO');
  });
});

describe('buildIntroMessage', () => {
  it('includes candidate name and position (en)', () => {
    const msg = buildIntroMessage('Nguyen Van A', 'Backend Engineer', 'en');
    expect(msg).toContain('Nguyen Van A');
    expect(msg).toContain('Backend Engineer');
    expect(msg).toContain('SmartHirink');
  });

  it('returns Vietnamese intro when language is vi', () => {
    const msg = buildIntroMessage('Nguyen Van A', 'Backend Engineer', 'vi');
    expect(msg).toContain('Xin chào');
  });
});

describe('buildOutroMessage', () => {
  it('includes candidate name (en)', () => {
    const msg = buildOutroMessage('Nguyen Van A', 'en');
    expect(msg).toContain('Nguyen Van A');
    expect(msg).toContain('Thank you');
  });

  it('returns Vietnamese outro when language is vi', () => {
    const msg = buildOutroMessage('Nguyen Van A', 'vi');
    expect(msg).toContain('Cảm ơn');
  });
});
