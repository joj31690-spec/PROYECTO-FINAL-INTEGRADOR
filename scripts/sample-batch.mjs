// Small deterministic fixture: no random generation and no benchmarking.
import { readFileSync } from 'node:fs';
import { RULES } from '../engine/sequential.mjs';
const bank = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
// A reproducible resolved exam, rather than the full question bank.
const exam = { ...bank, questions: bank.questions.slice(0, RULES.questionCount) };
process.stdout.write(JSON.stringify({ schemaVersion: '1', exams: [exam], evaluations: [
  { evaluationId: 'sample-001', examId: exam.id, answers: exam.questions.map(q => ({ questionId: q.id, optionId: q.correctOptionId })) },
  { evaluationId: 'sample-002', examId: exam.id, answers: exam.questions.map((q, i) => ({ questionId: q.id, optionId: i < 2 ? q.correctOptionId : null })) }
] }) + '\n');
