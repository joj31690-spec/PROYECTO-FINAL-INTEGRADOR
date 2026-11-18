import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { processBatch, prepareWork, evaluateUnit, consolidate } from '../engine/sequential.mjs';
const bank = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
const exam = { ...bank, questions: bank.questions.slice(0, 5) };
const evaluation = (id, correct = 5) => ({ evaluationId: id, examId: exam.id, answers: exam.questions.map((q, i) => ({ questionId: q.id, optionId: i < correct ? q.correctOptionId : null })) });
const input = evaluations => ({ schemaVersion: '1', exams: [exam], evaluations });
test('five stable questions, four options and valid answer keys', () => {
  assert.equal(exam.questions.length, 5);
  for (const q of exam.questions) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.id)).size, 4);
    assert.ok(q.options.some(o => o.id === q.correctOptionId));
    assert.ok(q.explanation.length > 20);
  }
});
test('pass threshold and integer scoring include missing answers', () => {
  for (let n = 0; n <= 5; n++) {
    const r = processBatch(input([evaluation('test', n)])).results[0];
    assert.equal(r.score, n * 20); assert.equal(r.passed, n >= 3); assert.equal(r.correct, n);
  }
});
test('single equals batch; reordered independent partitions consolidate identically', () => {
  const data = input([evaluation('b', 2), evaluation('a', 5), evaluation('c', 3)]);
  const expected = processBatch(data);
  assert.deepEqual(consolidate(prepareWork(data).reverse().map(evaluateUnit)), expected);
  assert.deepEqual(expected.results[1], processBatch(input([evaluation('b', 2)])).results[0]);
  assert.deepEqual(expected.aggregate, { evaluations: 3, passed: 2, correct: 10, questions: 15, totalScore: 200 });
  assert.deepEqual(processBatch(input([])).results, []);
});
test('reject invalid answers and duplicate evaluation IDs', () => {
  const e = evaluation('a'); e.answers.push(e.answers[0]);
  assert.throws(() => processBatch(input([e])), /duplicate answer/);
  assert.throws(() => processBatch(input([evaluation('a'), evaluation('a')])), /Duplicate evaluation/);
});
test('standalone JSON CLI matches in-process contract', () => {
  const data = input([evaluation('cli', 4)]);
  const child = spawnSync(process.execPath, ['engine/cli.mjs'], { input: JSON.stringify(data), encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), processBatch(data));
});
