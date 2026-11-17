// Pure, deterministic reference implementation. No UI, storage, clocks or network.
export const RULES = Object.freeze({ version: '1', questionCount: 5, secondsPerQuestion: 30, passCorrect: 3, pointsPerCorrect: 20 });

export function evaluateUnit(unit) {
  const { evaluationId, examId, questions, answers } = unit;
  if (typeof evaluationId !== 'string' || !evaluationId || typeof examId !== 'string' || !examId || !Array.isArray(questions) || questions.length !== RULES.questionCount || !Array.isArray(answers)) throw new Error('Invalid work unit');
  for (const q of questions) {
    if (typeof q.id !== 'string' || !q.id || !Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options.map(o => o.id)).size !== 4 || q.options.some(o => typeof o.id !== 'string' || !o.id) || !q.options.some(o => o.id === q.correctOptionId)) throw new Error('Invalid question or answer key');
  }
  const keys = new Map(questions.map(q => [q.id, q]));
  if (keys.size !== questions.length) throw new Error('Duplicate question ID');
  const choices = new Map();
  for (const answer of answers) {
    const q = keys.get(answer.questionId);
    if (!q || choices.has(answer.questionId) || (answer.optionId !== null && !q.options.some(o => o.id === answer.optionId))) throw new Error('Invalid or duplicate answer');
    choices.set(answer.questionId, answer.optionId);
  }
  const details = questions.map(q => ({ questionId: q.id, selectedOptionId: choices.get(q.id) ?? null, correctOptionId: q.correctOptionId, correct: choices.get(q.id) === q.correctOptionId }));
  const correct = details.filter(d => d.correct).length;
  return { evaluationId, examId, correct, total: questions.length, score: correct * RULES.pointsPerCorrect, passed: correct >= RULES.passCorrect, details };
}

export function prepareWork(input) {
  if (input.schemaVersion !== '1' || !Array.isArray(input.evaluations) || !Array.isArray(input.exams)) throw new Error('Invalid input schema');
  const exams = new Map(input.exams.map(e => [e.id, e]));
  const ids = new Set();
  if (exams.size !== input.exams.length) throw new Error('Duplicate exam ID');
  return input.evaluations.map(e => {
    if (ids.has(e.evaluationId)) throw new Error('Duplicate evaluation ID');
    ids.add(e.evaluationId);
    const exam = exams.get(e.examId);
    if (!exam) throw new Error('Unknown exam');
    return { ...e, questions: exam.questions };
  });
}

export function consolidate(partials) {
  const results = [...partials].sort((a, b) => a.evaluationId < b.evaluationId ? -1 : a.evaluationId > b.evaluationId ? 1 : 0);
  if (new Set(results.map(r => r.evaluationId)).size !== results.length) throw new Error('Duplicate partial result');
  return { schemaVersion: '1', rulesVersion: RULES.version, results, aggregate: {
    evaluations: results.length,
    passed: results.reduce((n, r) => n + Number(r.passed), 0),
    correct: results.reduce((n, r) => n + r.correct, 0),
    questions: results.reduce((n, r) => n + r.total, 0),
    totalScore: results.reduce((n, r) => n + r.score, 0)
  } };
}

export function processBatch(input) {
  return consolidate(prepareWork(input).map(evaluateUnit));
}
