import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createExamAttempt } from '../backend/exam-selection.mjs';
import { processBatch, RULES } from '../engine/sequential.mjs';

const bank = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
// Deterministic source for correctness fixtures only, not for production draws.
function seeded(seed) {
  return max => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 2 ** 32 * max);
  };
}

test('Historia 1 contains exactly ten unique questions with four stable options', () => {
  assert.equal(bank.questions.length, 10);
  assert.equal(new Set(bank.questions.map(q => q.id)).size, 10);
  for (const q of bank.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.ok(q.options.some(o => o.id === q.correctOptionId));
    assert.ok(q.explanation.length > 20);
  }
});

test('draw five distinct questions, permute options, and preserve the source bank', () => {
  const before = JSON.stringify(bank);
  const attempt = createExamAttempt(bank, RULES.questionCount, seeded(42));
  assert.equal(attempt.questions.length, 5);
  assert.equal(new Set(attempt.questions.map(q => q.id)).size, 5);
  for (const q of attempt.questions) {
    const original = bank.questions.find(o => o.id === q.id);
    assert.equal(q.correctOptionId, original.correctOptionId);
    assert.equal(q.explanation, original.explanation);
    assert.deepEqual([...q.options].sort((a, b) => a.id.localeCompare(b.id)), original.options);
  }
  assert.ok(attempt.questions.some(q => q.options.map(o => o.id).join('') !== 'abcd'));
  attempt.questions[0].options[0].text = 'Only this attempt changes';
  assert.equal(JSON.stringify(bank), before);
});

test('new random input changes the draw; fixed input reproduces the same attempt', () => {
  const first = createExamAttempt(bank, 5, seeded(1));
  const again = createExamAttempt(bank, 5, seeded(1));
  const different = createExamAttempt(bank, 5, seeded(2));
  assert.deepEqual(first, again);
  assert.notDeepEqual(first.questions.map(q => q.id), different.questions.map(q => q.id));
  assert.notDeepEqual(first.questions.map(q => q.options), different.questions.map(q => q.options));
});

test('shuffling remains opt-in for other exams', () => {
  const fixed = { ...bank, selection: undefined, questions: bank.questions.slice(0, 5) };
  assert.deepEqual(createExamAttempt(fixed, 5, () => { throw new Error('Must not draw'); }).questions, fixed.questions);
});

test('ID-based scoring and review stay correct for all score levels after shuffling', () => {
  const attempt = createExamAttempt(bank, 5, seeded(42));
  for (let correct = 0; correct <= 5; correct++) {
    const answers = attempt.questions.map((q, i) => ({ questionId: q.id, optionId: i < correct ? q.correctOptionId : q.options.find(o => o.id !== q.correctOptionId).id }));
    const input = { schemaVersion: '1', exams: [attempt], evaluations: [{ evaluationId: `shuffled-${correct}`, examId: attempt.id, answers }] };
    const r = processBatch(input).results[0];
    assert.equal(r.correct, correct); assert.equal(r.total, 5);
    assert.equal(r.score, correct * 20); assert.equal(r.passed, correct >= 3);
    assert.deepEqual(r.details.map(d => d.questionId), attempt.questions.map(q => q.id));
    for (const [i, detail] of r.details.entries()) {
      assert.equal(detail.selectedOptionId, answers[i].optionId);
      assert.equal(detail.correctOptionId, bank.questions.find(q => q.id === detail.questionId).correctOptionId);
    }
    assert.deepEqual(processBatch(input), processBatch(input));
  }
});

test('invalid counts and duplicate question IDs cannot create an attempt', () => {
  for (const count of [0, 11, 2.5]) assert.throws(() => createExamAttempt(bank, count));
  assert.throws(() => createExamAttempt({ ...bank, questions: [...bank.questions, bank.questions[0]] }, 5), /Duplicate question/);
});

const medium = JSON.parse(readFileSync(new URL('../content/history-2.json', import.meta.url)));
test('Historia 2 has ten unique questions, the supplied answer keys, and medium metadata', () => {
  assert.equal(medium.id, 'historia-2'); assert.equal(medium.difficulty, 'Medio');
  assert.equal(medium.questions.length, 10);
  assert.deepEqual(medium.questions.map(q => q.correctOptionId), ['b', 'c', 'a', 'd', 'b', 'c', 'a', 'd', 'b', 'c']);
  const allIds = [...bank.questions, ...medium.questions].map(q => q.id);
  assert.equal(new Set(allIds).size, 20);
  for (const q of medium.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.ok(q.options.some(o => o.id === q.correctOptionId));
    assert.ok(q.explanation.length > 20);
  }
});

test('Historia 2 reuses random draws, stable IDs and all six score outcomes', () => {
  const before = JSON.stringify(medium);
  const attempt = createExamAttempt(medium, 5, seeded(42));
  const other = createExamAttempt(medium, 5, seeded(2));
  assert.equal(attempt.questions.length, 5);
  assert.equal(new Set(attempt.questions.map(q => q.id)).size, 5);
  assert.notDeepEqual(attempt.questions.map(q => q.id), other.questions.map(q => q.id));
  assert.ok(attempt.questions.some(q => q.options.map(o => o.id).join('') !== 'abcd'));
  for (let correct = 0; correct <= 5; correct++) {
    const answers = attempt.questions.map((q, i) => ({ questionId: q.id, optionId: i < correct ? q.correctOptionId : null }));
    const result = processBatch({ schemaVersion: '1', exams: [attempt], evaluations: [{ evaluationId: 'medium', examId: attempt.id, answers }] }).results[0];
    assert.equal(result.correct, correct); assert.equal(result.score, correct * 20); assert.equal(result.passed, correct >= 3);
    assert.deepEqual(result.details.map(d => d.questionId), attempt.questions.map(q => q.id));
    for (const q of attempt.questions) assert.equal(q.explanation, medium.questions.find(original => original.id === q.id).explanation);
  }
  assert.equal(JSON.stringify(medium), before);
});

const advanced = JSON.parse(readFileSync(new URL('../content/history-3.json', import.meta.url)));
test('all three resolved exam levels can be evaluated in one deterministic batch', () => {
  const easyAttempt = createExamAttempt(bank, 5, seeded(1));
  const mediumAttempt = createExamAttempt(medium, 5, seeded(2));
  const advancedAttempt = createExamAttempt(advanced, 5, seeded(3));
  const exams = [easyAttempt, mediumAttempt, advancedAttempt];
  const evaluations = exams.map((exam, n) => ({ evaluationId: `level-${n}`, examId: exam.id, answers: exam.questions.map((q, i) => ({ questionId: q.id, optionId: i < [5, 3, 2][n] ? q.correctOptionId : null })) }));
  const output = processBatch({ schemaVersion: '1', exams, evaluations });
  assert.deepEqual(output.results.map(r => [r.examId, r.score]), [['historia-1', 100], ['historia-2', 60], ['historia-3', 40]]);
  assert.equal(output.aggregate.evaluations, 3); assert.equal(output.aggregate.passed, 2); assert.equal(output.aggregate.totalScore, 200);
});

test('Historia 3 has ten unique questions, the supplied answer keys and advanced metadata', () => {
  assert.equal(advanced.id, 'historia-3'); assert.equal(advanced.difficulty, 'Avanzado');
  assert.equal(advanced.topic, 'Los secretos de la historia chaqueña');
  assert.equal(advanced.questions.length, 10);
  assert.deepEqual(advanced.questions.map(q => q.correctOptionId), ['b', 'd', 'a', 'c', 'b', 'a', 'd', 'c', 'a', 'b']);
  const ids = [...bank.questions, ...medium.questions, ...advanced.questions].map(q => q.id);
  assert.equal(new Set(ids).size, 30);
  for (const q of advanced.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.ok(q.options.some(o => o.id === q.correctOptionId));
    assert.ok(q.explanation.length > 20);
  }
});

test('Historia 3 reuses random draws, stable IDs and all six score outcomes', () => {
  const before = JSON.stringify(advanced);
  const attempt = createExamAttempt(advanced, 5, seeded(42));
  const other = createExamAttempt(advanced, 5, seeded(2));
  assert.equal(attempt.questions.length, 5);
  assert.equal(new Set(attempt.questions.map(q => q.id)).size, 5);
  assert.notDeepEqual(attempt.questions.map(q => q.id), other.questions.map(q => q.id));
  assert.ok(attempt.questions.some(q => q.options.map(o => o.id).join('') !== 'abcd'));
  for (let correct = 0; correct <= 5; correct++) {
    const answers = attempt.questions.map((q, i) => ({ questionId: q.id, optionId: i < correct ? q.correctOptionId : null }));
    const result = processBatch({ schemaVersion: '1', exams: [attempt], evaluations: [{ evaluationId: 'advanced', examId: attempt.id, answers }] }).results[0];
    assert.equal(result.correct, correct); assert.equal(result.score, correct * 20); assert.equal(result.passed, correct >= 3);
    assert.deepEqual(result.details.map(d => d.questionId), attempt.questions.map(q => q.id));
    for (const q of attempt.questions) assert.equal(q.explanation, advanced.questions.find(original => original.id === q.id).explanation);
  }
  assert.equal(JSON.stringify(advanced), before);
});
