import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamFace, timeExpression } from '../frontend/src/exam-face/state.mjs';

function fixture() {
  let now = 0, nextId = 0, expression, destroyed = false;
  const tasks = new Map();
  const face = new ExamFace({ render: key => { expression = key; }, destroy: () => { destroyed = true; } }, {
    schedule(callback, delay) { const id = ++nextId; tasks.set(id, { callback, due: now + delay }); return id; },
    cancel(id) { tasks.delete(id); }
  });
  return {
    face,
    get expression() { return expression; },
    get pending() { return tasks.size; },
    get destroyed() { return destroyed; },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...tasks].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        now = next[1].due; tasks.delete(next[0]); next[1].callback();
      }
      now = end;
    }
  };
}

test('face thresholds match displayed rounded seconds', () => {
  for (const [ms, expression] of [[30000, 'calm'], [16000, 'calm'], [15001, 'calm'], [15000, 'thoughtful'], [11000, 'thoughtful'], [10000, 'worried'], [6000, 'worried'], [5000, 'nervous'], [1, 'nervous'], [0, 'expired']]) {
    assert.equal(timeExpression(ms), expression, `remaining ${ms}`);
  }
});

test('only a real answer change starts the 500ms reaction, then restores the current clock expression', () => {
  const f = fixture(); f.face.updateRemaining(30000);
  assert.equal(f.expression, 'calm');
  f.face.answerChanged(null, 'a'); f.face.answerChanged('a', 'a');
  assert.equal(f.expression, 'calm'); assert.equal(f.pending, 0);
  f.face.answerChanged('a', 'b'); assert.equal(f.expression, 'skeptical');
  f.advance(499); assert.equal(f.expression, 'skeptical');
  f.face.updateRemaining(2000); assert.equal(f.expression, 'skeptical');
  f.advance(1); assert.equal(f.expression, 'nervous'); assert.equal(f.pending, 0);
  f.advance(800); assert.equal(f.expression, 'nervous'); assert.equal(f.pending, 0);
});

test('rapid changes restart the sequence without accumulating callbacks', () => {
  const f = fixture(); f.face.updateRemaining(14000);
  f.face.answerChanged('a', 'b'); f.advance(450);
  f.face.answerChanged('b', 'c'); f.advance(100);
  assert.equal(f.expression, 'skeptical'); assert.equal(f.pending, 1);
  f.advance(399); assert.equal(f.expression, 'skeptical');
  f.face.answerChanged('c', 'd'); assert.equal(f.expression, 'skeptical'); assert.equal(f.pending, 1);
  f.advance(499); assert.equal(f.expression, 'skeptical');
  f.advance(1); assert.equal(f.expression, 'thoughtful'); assert.equal(f.pending, 0);
});

test('expiry cancels reactions immediately and final results take priority', () => {
  const f = fixture(); f.face.updateRemaining(30000); f.face.answerChanged('a', 'b');
  f.face.updateRemaining(0); assert.equal(f.expression, 'expired'); assert.equal(f.pending, 0);
  f.face.answerChanged('b', 'c'); f.advance(2000); assert.equal(f.expression, 'expired');
  f.face.finish({ correct: 0, total: 5, passed: false }); assert.equal(f.expression, 'zero');
  f.face.updateRemaining(0); assert.equal(f.expression, 'zero');
});

test('all result levels include special zero and perfect outcomes', () => {
  for (const [correct, expected] of [[0, 'zero'], [1, 'failed'], [2, 'failed'], [3, 'passed'], [4, 'passed'], [5, 'perfect']]) {
    const f = fixture(); f.face.updateRemaining(10000); f.face.answerChanged('a', 'b');
    f.face.finish({ correct, total: 5, passed: correct >= 3 });
    assert.equal(f.expression, expected); assert.equal(f.pending, 0);
    f.advance(2000); assert.equal(f.expression, expected);
  }
});

test('leaving a question destroys the old face and cancels its reaction', () => {
  const old = fixture(); old.face.updateRemaining(30000); old.face.answerChanged('a', 'b');
  old.face.destroy(); assert.equal(old.pending, 0); assert.equal(old.destroyed, true);
  old.advance(2000); assert.equal(old.expression, 'skeptical');
  const next = fixture(); next.face.updateRemaining(30000); assert.equal(next.expression, 'calm');
});
