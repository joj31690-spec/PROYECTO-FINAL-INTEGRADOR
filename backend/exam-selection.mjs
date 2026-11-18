import { randomInt } from 'node:crypto';

function shuffled(items, randomIndex) {
  const result = [...items];
  // Fisher–Yates: unbiased permutations without changing IDs or source data.
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Resolve a bank into a fixed attempt once, before presentation or evaluation.
// An injectable integer RNG allows deterministic fixtures without adding any
// randomness to the computational engine. Future exams opt in through data.
export function createExamAttempt(bank, questionCount, randomIndex = randomInt) {
  if (!Number.isInteger(questionCount) || questionCount < 1 || !Array.isArray(bank.questions) || bank.questions.length < questionCount) throw new Error('Insufficient questions for an exam attempt');
  if (new Set(bank.questions.map(q => q.id)).size !== bank.questions.length) throw new Error('Duplicate question ID in bank');
  const policy = bank.selection || {};
  const questions = policy.randomQuestions ? shuffled(bank.questions, randomIndex) : bank.questions;
  return {
    ...bank,
    questions: questions.slice(0, questionCount).map(q => ({
      ...q,
      options: (policy.shuffleOptions ? shuffled(q.options, randomIndex) : q.options).map(o => ({ ...o }))
    }))
  };
}
