import type { Step } from './types';

export interface TimerState {
  /** índice del paso en curso (-1 antes del primero) */
  current: number;
  next: Step | undefined;
  /** segundos hasta el siguiente paso */
  untilNext: number | undefined;
  /** si el paso actual tiene vertido en curso (entre at y endsAt) */
  pouring: boolean;
}

export function timerState(steps: Step[], elapsed: number): TimerState {
  let current = -1;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].at <= elapsed) current = i;
    else break;
  }
  const next = steps[current + 1];
  const step = steps[current];
  return {
    current,
    next,
    untilNext: next ? next.at - elapsed : undefined,
    pouring: !!step && step.endsAt !== undefined && elapsed < step.endsAt,
  };
}
