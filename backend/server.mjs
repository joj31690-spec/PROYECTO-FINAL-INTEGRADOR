import http from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, root } from './config.mjs';
import { createProcessor } from './processor.mjs';
import { createExamAttempt } from './exam-selection.mjs';
import { RULES } from '../engine/sequential.mjs';

const exams = new Map(['history-1.json', 'history-2.json', 'history-3.json'].map(filename => {
  const exam = JSON.parse(readFileSync(resolve(root, 'content', filename), 'utf8'));
  return [exam.id, exam];
}));
const processor = createProcessor(config.engineMode);
const sessions = new Map();
mkdirSync(config.dataDir, { recursive: true });
const progressFile = resolve(config.dataDir, 'progress.json');
const progress = existsSync(progressFile) ? JSON.parse(readFileSync(progressFile, 'utf8')) : {};
const publicQuestion = q => ({ id: q.id, text: q.text, options: q.options });
const view = s => ({ sessionId: s.id, examId: s.exam.id, questionIndex: s.answers.length, question: publicQuestion(s.exam.questions[s.answers.length]), deadline: s.deadline, serverNow: Date.now(), rules: RULES });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function saveProgress(s, result) {
  const p = progress[s.playerId] || { attempts: 0, passed: 0, bestScore: 0 };
  progress[s.playerId] = { attempts: p.attempts + 1, passed: p.passed + Number(result.passed), bestScore: Math.max(p.bestScore, result.score), lastScore: result.score };
  writeFileSync(`${progressFile}.tmp`, JSON.stringify(progress));
  renameSync(`${progressFile}.tmp`, progressFile);
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16384) throw fail('Solicitud demasiado grande.', 413);
  }
  try { return JSON.parse(raw); } catch { throw fail('JSON inválido.'); }
}
function playerId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(value)) throw fail('Identificador de jugador inválido.');
  return value;
}
const server = http.createServer(async (req, res) => {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/catalog') return send(200, { exams: [...exams.values()].map(({ id, category, title, topic, displayTitle, shortTopic, difficulty, brief, introduction }) => ({ id, category, title, topic, displayTitle, shortTopic, difficulty, brief, introduction, available: true })).concat(['Geografía', 'Economía', 'Cultura'].map((category, i) => ({ id: `pending-${i}`, category, title: `${category} 1`, available: false }))), rules: RULES });
    if (req.method === 'GET' && url.pathname === '/api/progress') return send(200, progress[playerId(url.searchParams.get('playerId'))] || { attempts: 0, passed: 0, bestScore: 0 });
    if (req.method === 'POST' && url.pathname === '/api/sessions') {
      const data = await body(req);
      const exam = exams.get(data.examId);
      if (!exam) throw fail('Esta prueba todavía no está disponible.', 404);
      const s = { id: randomUUID(), playerId: playerId(data.playerId), exam: createExamAttempt(exam, RULES.questionCount), answers: [], responses: new Map(), deadline: Date.now() + RULES.secondsPerQuestion * 1000, created: Date.now() };
      sessions.set(s.id, s);
      return send(201, view(s));
    }
    const match = url.pathname.match(/^\/api\/sessions\/([a-z0-9-]+)\/answers$/);
    if (req.method === 'POST' && match) {
      const data = await body(req);
      const s = sessions.get(match[1]);
      if (!s || s.playerId !== data.playerId) throw fail('La sesión ya no está disponible. Vuelve al inicio.', 404);
      if (s.result) return send(200, s.result);
      if (s.busy) throw fail('La respuesta se está procesando.', 409);
      if (s.responses.has(data.questionId)) return send(200, { ...s.responses.get(data.questionId), serverNow: Date.now() });
      const q = s.exam.questions[s.answers.length];
      if (data.questionId !== q.id) throw fail('Esta pregunta ya fue respondida.', 409);
      if (data.optionId !== null && !q.options.some(o => o.id === data.optionId)) throw fail('Opción inválida.');
      const timedOut = Date.now() >= s.deadline;
      s.answers.push({ questionId: q.id, optionId: timedOut ? null : data.optionId });
      if (s.answers.length < s.exam.questions.length) {
        s.deadline = Date.now() + RULES.secondsPerQuestion * 1000;
        const next = view(s);
        s.responses.set(q.id, next);
        return send(200, next);
      }
      s.busy = true;
      const batch = await processor.process({ schemaVersion: '1', exams: [s.exam], evaluations: [{ evaluationId: s.id, examId: s.exam.id, answers: s.answers }] });
      const result = batch.results[0];
      saveProgress(s, result);
      s.result = { finished: true, result, questions: s.exam.questions, progress: progress[s.playerId] };
      return send(200, s.result);
    }
    if (url.pathname.startsWith('/api/')) throw fail('Ruta no encontrada.', 404);
    if (req.method !== 'GET') throw fail('Método no permitido.', 405);
    const dist = resolve(root, 'frontend/dist');
    let path = resolve(dist, '.' + decodeURIComponent(url.pathname));
    if (path !== dist && !path.startsWith(dist + sep)) throw fail('Ruta inválida.', 400);
    if (!extname(path)) path = resolve(dist, 'index.html');
    if (!existsSync(path)) throw fail('Archivo no encontrado. Ejecuta pnpm build o usa pnpm dev.', 404);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(readFileSync(path));
  } catch (error) { if (!error.status) console.error(error); send(error.status || 500, { error: error.status ? error.message : 'No se pudo completar la operación.' }); }
});
// Sessions expire; persistent progress remains independent of transient games.
setInterval(() => { for (const [id, s] of sessions) if (Date.now() - s.created > 3600000) sessions.delete(id); }, 60000).unref();
server.listen(config.port, config.host, () => console.log(`Examen API: http://${config.host}:${config.port}`));
