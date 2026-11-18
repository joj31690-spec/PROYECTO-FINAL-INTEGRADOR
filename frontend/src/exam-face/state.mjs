import { FACE_CONFIG } from './config.mjs';

export function timeExpression(remainingMs) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return FACE_CONFIG.timeBands.find(band => seconds >= band.minimumSeconds)?.expression ?? 'expired';
}

// Priority is kept in one place. Results come from the existing evaluator.
export function resolveExpression({ result, remainingMs, reaction }) {
  if (result) {
    if (result.correct === 0) return 'zero';
    if (result.correct === result.total) return 'perfect';
    return result.passed ? 'passed' : 'failed';
  }
  if (remainingMs <= 0) return 'expired';
  return reaction || timeExpression(remainingMs);
}

export class ExamFace {
  constructor(view, clock = { schedule: (callback, delay) => setTimeout(callback, delay), cancel: id => clearTimeout(id) }) {
    this.view = view;
    this.clock = clock;
    this.pending = new Set();
    this.remainingMs = 0;
    this.result = null;
    this.reaction = null;
    this.generation = 0;
    this.destroyed = false;
  }

  paint() {
    if (!this.destroyed) this.view.render(resolveExpression(this));
  }

  updateRemaining(remainingMs) {
    if (this.destroyed) return;
    this.remainingMs = remainingMs;
    if (remainingMs <= 0) this.cancelReaction();
    this.paint();
  }

  cancelReaction() {
    this.generation++;
    for (const id of this.pending) this.clock.cancel(id);
    this.pending.clear();
    this.reaction = null;
  }

  later(delay, callback) {
    const generation = this.generation;
    const id = this.clock.schedule(() => {
      this.pending.delete(id);
      if (!this.destroyed && generation === this.generation) callback();
    }, delay);
    this.pending.add(id);
  }

  answerChanged(previous, next) {
    if (this.destroyed || this.result || this.remainingMs <= 0 || previous === null || previous === next) return;
    this.cancelReaction();
    this.reaction = 'skeptical';
    this.paint();
    this.later(FACE_CONFIG.skepticalMs, () => {
      this.reaction = null;
      this.paint();
    });
  }

  finish(result) {
    if (this.destroyed) return;
    this.cancelReaction();
    this.result = result;
    this.paint();
  }

  destroy() {
    this.cancelReaction();
    this.destroyed = true;
    this.view.destroy();
  }
}
