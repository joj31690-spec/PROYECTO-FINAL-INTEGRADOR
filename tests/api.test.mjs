import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
const exam = JSON.parse(readFileSync(new URL('../content/history-1.json', import.meta.url)));
test('API plays a complete exam, hides keys, handles retries and saves progress', async t => {
  const dir = mkdtempSync('/tmp/opencode/examen-test-');
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
  assert.equal((await request('/sessions', { examId: 'historia-2' })).status, 404);
  let { data: s } = await request('/sessions', { examId: exam.id });
  const id = s.sessionId;
  assert.ok(s.deadline - s.serverNow <= 30000 && s.deadline - s.serverNow > 29000);
  for (const [i, q] of exam.questions.entries()) {
    assert.ok(!JSON.stringify(s).includes('correctOptionId'));
    const data = { questionId: q.id, optionId: i < 3 ? q.correctOptionId : null };
    const response = await request(`/sessions/${id}/answers`, data);
    assert.equal(response.status, 200);
    s = response.data;
    if (i === 0) {
      const retry = await request(`/sessions/${id}/answers`, data);
      assert.equal(retry.data.questionIndex, 1);
      assert.equal(retry.data.deadline, s.deadline);
    }
  }
  assert.equal(s.result.score, 60); assert.equal(s.result.passed, true);
  await request(`/sessions/${id}/answers`, { questionId: exam.questions[4].id, optionId: null });
  const p = await request(`/progress?playerId=${playerId}`);
  assert.equal(p.data.attempts, 1); assert.equal(p.data.bestScore, 60);
  assert.equal(JSON.parse(readFileSync(`${dir}/progress.json`))[playerId].passed, 1);
});
