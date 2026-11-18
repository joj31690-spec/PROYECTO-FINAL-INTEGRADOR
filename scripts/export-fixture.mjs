// Export a tiny, deterministic dataset and the existing JS engine's full oracle.
import { readFileSync, writeFileSync } from 'node:fs';
import { RULES, processBatch } from '../engine/sequential.mjs';
const bank = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
const exam = { ...bank, questions: bank.questions.slice(0, RULES.questionCount) };
const evaluations = [5, 0, 3, 2, 4, 1, 5, 3].map((n, i) => ({
  evaluationId: `demo-${String(i + 1).padStart(3, '0')}`,
  examId: exam.id,
  answers: exam.questions.map((q, index) => ({ questionId: q.id, optionId: index < n ? q.correctOptionId : i % 2 ? null : q.options.find(o => o.id !== q.correctOptionId).id }))
}));
// Include an omitted-answer case and non-canonical evaluation order.
evaluations[1].answers = [];
const input = { schemaVersion: '1', exams: [exam], evaluations: evaluations.reverse() };
writeFileSync(new URL('../data/demo-input.json', import.meta.url), JSON.stringify(input, null, 2) + '\n');
writeFileSync(new URL('../data/demo-expected.json', import.meta.url), JSON.stringify(processBatch(input), null, 2) + '\n');
console.log('Exported 8 evaluations and JS oracle to data/.');
