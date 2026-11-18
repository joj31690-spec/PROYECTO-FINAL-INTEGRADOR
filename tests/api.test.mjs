import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const exams = [1, 2, 3].map(n => JSON.parse(readFileSync(new URL(`../content/history-${n}.json`, import.meta.url))));
test('API plays all three levels, hides keys, handles retries and saves shared progress', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'cultura-api-test-'));
  const child = spawn(process.execPath, ['backend/server.mjs'], { env: { ...process.env, PORT: '3199', DATA_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); await once(child, 'exit'); rmSync(dir, { recursive: true, force: true }); });
  await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(new Error('API did not start')), 5000).unref())]);
  const playerId = 'test-player-123456789';
  async function request(path, data) {
    const res = await fetch(`http://127.0.0.1:3199/api${path}`, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, playerId }) } : {});
    return { status: res.status, data: await res.json() };
  }
  const catalog = await request('/catalog');
  assert.ok(!JSON.stringify(catalog).includes('correctOptionId'));
  assert.deepEqual(catalog.data.exams.filter(e => e.available).map(e => [e.id, e.difficulty]), [['historia-1', 'Fácil'], ['historia-2', 'Medio'], ['historia-3', 'Avanzado']]);
  assert.equal((await request('/sessions', { examId: 'historia-inexistente' })).status, 404);
  for (const [examIndex, exam] of exams.entries()) await t.test(exam.title, async () => {
    let { data: s } = await request('/sessions', { examId: exam.id });
    const id = s.sessionId;
    assert.equal(s.examId, exam.id);
    const foreignQuestion = exams.find(e => e.id !== exam.id).questions[0];
    assert.equal((await request(`/sessions/${id}/answers`, { questionId: foreignQuestion.id, optionId: foreignQuestion.correctOptionId })).status, 409);
    assert.ok(s.deadline - s.serverNow <= 30000 && s.deadline - s.serverNow > 29000);
    const presented = [];
    const seen = new Set();
    for (let i = 0; i < 5; i++) {
      assert.ok(!JSON.stringify(s).includes('correctOptionId'));
      assert.ok(!JSON.stringify(s).includes('explanation'));
      const publicQuestion = s.question;
      const q = exam.questions.find(q => q.id === publicQuestion.id);
      assert.ok(q);
      assert.ok(!seen.has(q.id)); seen.add(q.id);
      presented.push(publicQuestion);
      assert.deepEqual([...publicQuestion.options].sort((a, b) => a.id.localeCompare(b.id)), q.options);
      const data = { questionId: q.id, optionId: i < 3 ? q.correctOptionId : null };
      const response = await request(`/sessions/${id}/answers`, data);
      assert.equal(response.status, 200);
      s = response.data;
      if (i === 0) {
        const retry = await request(`/sessions/${id}/answers`, data);
        assert.equal(retry.data.questionIndex, 1);
        assert.equal(retry.data.deadline, s.deadline);
        assert.deepEqual(retry.data.question, s.question);
      }
    }
    assert.equal(s.result.score, 60); assert.equal(s.result.passed, true);
    assert.equal(s.result.examId, exam.id);
    assert.equal(s.questions.length, 5);
    assert.deepEqual(s.questions.map(({ id, text, options }) => ({ id, text, options })), presented);
    assert.deepEqual(s.result.details.map(d => d.questionId), presented.map(q => q.id));
    for (const q of s.questions) assert.equal(q.explanation, exam.questions.find(original => original.id === q.id).explanation);
    await request(`/sessions/${id}/answers`, { questionId: presented[4].id, optionId: null });
    const p = await request(`/progress?playerId=${playerId}`);
    assert.equal(p.data.attempts, examIndex + 1); assert.equal(p.data.bestScore, 60);
    assert.equal(JSON.parse(readFileSync(`${dir}/progress.json`))[playerId].passed, examIndex + 1);
    const next = await request('/sessions', { examId: exam.id });
    assert.equal(next.status, 201); assert.notEqual(next.data.sessionId, id);
    assert.equal(next.data.questionIndex, 0); assert.ok(!next.data.finished);
    assert.equal(next.data.examId, exam.id);
  });
});
