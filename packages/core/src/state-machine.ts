/**
 * Interview State Machine
 * 
 * Defines valid state transitions for InterviewSession phase lifecycle.
 * Ensures domain invariants are enforced at the application layer.
 */

import { InterviewPhase } from './types.js';

/**
 * Valid phase transitions map.
 * Key: current phase, Value: array of allowed next phases
 */
export const PHASE_TRANSITIONS: Record<InterviewPhase, InterviewPhase[]> = {
  [InterviewPhase.CREATED]: [
    InterviewPhase.SCHEDULED,
    InterviewPhase.WAITING,
    InterviewPhase.CANCELLED,
  ],
  [InterviewPhase.SCHEDULED]: [
    InterviewPhase.WAITING,
    InterviewPhase.CANCELLED,
  ],
  [InterviewPhase.WAITING]: [
    InterviewPhase.IN_PROGRESS,
    InterviewPhase.NO_SHOW,
    InterviewPhase.CANCELLED,
  ],
  [InterviewPhase.IN_PROGRESS]: [
    InterviewPhase.COMPLETED,
    InterviewPhase.CANCELLED,
  ],
  [InterviewPhase.COMPLETED]: [], // Terminal state
  [InterviewPhase.CANCELLED]: [], // Terminal state
  [InterviewPhase.NO_SHOW]: [],   // Terminal state
};

/**
 * Terminal phases (cannot transition out of)
 */
export const TERMINAL_PHASES: ReadonlySet<InterviewPhase> = new Set([
  InterviewPhase.COMPLETED,
  InterviewPhase.CANCELLED,
  InterviewPhase.NO_SHOW,
]);

/**
 * Phases that indicate the interview has started
 */
export const ACTIVE_PHASES: ReadonlySet<InterviewPhase> = new Set([
  InterviewPhase.WAITING,
  InterviewPhase.IN_PROGRESS,
]);

/**
 * Check if a phase transition is valid
 */
export function canTransition(from: InterviewPhase, to: InterviewPhase): boolean {
  return PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a phase is terminal (cannot transition out)
 */
export function isTerminalPhase(phase: InterviewPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

/**
 * Check if a phase indicates an active interview
 */
export function isActivePhase(phase: InterviewPhase): boolean {
  return ACTIVE_PHASES.has(phase);
}

/**
 * Get allowed transitions for a given phase
 */
export function getAllowedTransitions(phase: InterviewPhase): InterviewPhase[] {
  return PHASE_TRANSITIONS[phase] ?? [];
}

/**
 * Validate a phase transition, throwing an error if invalid
 */
export function validateTransition(from: InterviewPhase, to: InterviewPhase): void {
  if (!canTransition(from, to)) {
    throw new InvalidPhaseTransitionError(from, to);
  }
}

/**
 * Error thrown when an invalid phase transition is attempted
 */
export class InvalidPhaseTransitionError extends Error {
  constructor(
    public from: InterviewPhase,
    public to: InterviewPhase,
  ) {
    super(
      `Invalid phase transition: ${from} → ${to}. ` +
      `Allowed transitions from ${from}: ${getAllowedTransitions(from).join(', ') || '(none)'}`,
    );
    this.name = 'InvalidPhaseTransitionError';
  }
}

/**
 * Build a phase history entry
 */
export interface PhaseTransitionEntry {
  phase: InterviewPhase;
  timestamp: Date;
}

export function createPhaseTransition(phase: InterviewPhase): PhaseTransitionEntry {
  return {
    phase,
    timestamp: new Date(),
  };
}

/**
 * State machine helper for managing interview phase transitions
 */
export class InterviewStateMachine {
  constructor(
    public currentPhase: InterviewPhase,
    public history: PhaseTransitionEntry[] = [],
  ) {
    if (history.length === 0) {
      this.history = [createPhaseTransition(currentPhase)];
    }
  }

  /**
   * Attempt to transition to a new phase
   * Returns true if successful, false if invalid
   */
  transition(to: InterviewPhase): boolean {
    if (!canTransition(this.currentPhase, to)) {
      return false;
    }
    this.currentPhase = to;
    this.history.push(createPhaseTransition(to));
    return true;
  }

  /**
   * Force a transition (bypass validation - use with caution)
   */
  forceTransition(to: InterviewPhase): void {
    this.currentPhase = to;
    this.history.push(createPhaseTransition(to));
  }

  /**
   * Check if can transition to a specific phase
   */
  canTransitionTo(phase: InterviewPhase): boolean {
    return canTransition(this.currentPhase, phase);
  }

  /**
   * Check if current phase is terminal
   */
  isTerminal(): boolean {
    return isTerminalPhase(this.currentPhase);
  }

  /**
   * Check if interview is active
   */
  isActive(): boolean {
    return isActivePhase(this.currentPhase);
  }

  /**
   * Get the full phase history
   */
  getHistory(): PhaseTransitionEntry[] {
    return [...this.history];
  }

  /**
   * Get the initial phase from history
   */
  getInitialPhase(): InterviewPhase | null {
    return this.history[0]?.phase ?? null;
  }

  /**
   * Get the timestamp when a specific phase was entered
   */
  getPhaseTimestamp(phase: InterviewPhase): Date | null {
    const entry = this.history.find((h) => h.phase === phase);
    return entry?.timestamp ?? null;
  }

  /**
   * Serialize state for storage
   */
  serialize(): { phase: InterviewPhase; history: PhaseTransitionEntry[] } {
    return {
      phase: this.currentPhase,
      history: this.history,
    };
  }

  /**
   * Create state machine from serialized data
   */
  static deserialize(
    phase: InterviewPhase,
    history: PhaseTransitionEntry[] = [],
  ): InterviewStateMachine {
    return new InterviewStateMachine(phase, history);
  }
}
