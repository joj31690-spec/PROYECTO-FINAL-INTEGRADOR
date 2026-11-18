import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { processBatch } from '../engine/sequential.mjs';

test('versioned C++/OpenMP/MPI oracle still matches current JS rules and every answer detail', () => {
  const input = JSON.parse(readFileSync(new URL('../data/demo-input.json', import.meta.url)));
  const expected = JSON.parse(readFileSync(new URL('../data/demo-expected.json', import.meta.url)));
  assert.deepEqual(processBatch(input), expected, 'Regenerate the fixture and validate all native modes after changing the rules.');
  assert.deepEqual(expected.aggregate, { evaluations: 8, passed: 5, correct: 23, questions: 40, totalScore: 460 });
});
