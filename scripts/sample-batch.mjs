// Small deterministic fixture: no random generation and no benchmarking.
import { readFileSync } from 'node:fs';
const exam = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
process.stdout.write(JSON.stringify({ schemaVersion: '1', exams: [exam], evaluations: [
  { evaluationId: 'sample-001', examId: exam.id, answers: exam.questions.map(q => ({ questionId: q.id, optionId: q.correctOptionId })) },
  { evaluationId: 'sample-002', examId: exam.id, answers: exam.questions.map((q, i) => ({ questionId: q.id, optionId: i < 2 ? q.correctOptionId : null })) }
] }) + '\n');
