import './style.css';
import { FACE_CONFIG } from './exam-face/config.mjs';
import { ExamFace } from './exam-face/state.mjs';
import { createFaceView } from './exam-face/view.js';
import { ResultEnvelope } from './result-envelope/ResultEnvelope.js';

const app = document.querySelector('#app');
let playerId;
try { playerId = localStorage.getItem('examen-player'); if (!playerId) { playerId = crypto.randomUUID(); localStorage.setItem('examen-player', playerId); } } catch { playerId = crypto.randomUUID(); }
let catalog, progress = { attempts: 0, passed: 0, bestScore: 0 }, session, selected = null, busy = false, timer, clockOffset = 0, category = 'Historia';
let examFace, timeoutTransition, resultEnvelope, selectedExamId;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pencil = `<svg class="answer-circle" viewBox="0 0 38 38" aria-hidden="true"><path pathLength="100" d="M29 5 C15 -1 2 7 3 21 C4 34 23 38 32 28 C40 18 33 4 20 3"/></svg><span class="pencil-tip" aria-hidden="true"><span class="pencil"></span></span>`;
async function api(path, data) {
  const response = await fetch(`/api${path}`, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, playerId }) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo conectar con el servidor.');
  return result;
}
function shell(content, label = '', showBrand = false) {
  clearInterval(timer);
  resultEnvelope?.destroy();
  resultEnvelope = null;
  examFace?.destroy();
  examFace = null;
  if (timeoutTransition) {
    clearTimeout(timeoutTransition.id);
    timeoutTransition.resolve(false);
    timeoutTransition = null;
  }
  document.body.classList.toggle('paper-view', content.includes('welcome-sheet') || content.includes('question-sheet') || content.includes('results-sheet'));
  app.innerHTML = `${showBrand ? '<header class="masthead"><a href="/" class="brand" aria-label="Cultura Chaqueña, inicio"><span class="brand-mark">C<span>×</span></span> Cultura Chaqueña<span class="brand-sub">APRENDER DEJA HUELLA</span></a></header>' : ''}<main>${label ? `<div class="desk-label">${esc(label)}</div>` : ''}${content}</main>`;
  const brand = app.querySelector('.brand');
  if (brand) brand.onclick = e => {
    e.preventDefault();
    if (session && !session.finished && !confirm('¿Salir del examen? Esta partida quedará sin finalizar.')) return;
    session = null; home();
  };
}
function error(message, retry) {
  let box = document.querySelector('#error');
  if (!box) { box = document.createElement('div'); box.id = 'error'; box.setAttribute('role', 'alert'); document.querySelector('main').append(box); }
  box.innerHTML = `<span>${esc(message)}</span> <button class="text-button" id="retry">Reintentar</button>`;
  box.querySelector('button').onclick = () => { box.remove(); retry(); };
}
function home() {
  shell(`<section class="study-desk" aria-labelledby="desk-title">
    <div class="section-heading"><h1 id="desk-title">Tu mesa de estudio</h1><p>Elige una materia y abre tu examen.</p></div>
    <div class="tabs" role="group" aria-label="Categorías">${['Historia', 'Geografía', 'Economía', 'Cultura'].map(c => `<button class="tab ${c === category ? 'active' : ''}" data-category="${c}" aria-pressed="${c === category}">${c}</button>`).join('')}</div>
    <div class="exam-grid">${catalog.exams.filter(e => e.category === category).map(e => `
      <button class="exam-card ${e.available ? 'available' : 'locked'}" data-exam="${esc(e.id)}" ${e.available ? '' : 'disabled'}>
        <span class="card-label">${e.available ? esc(e.difficulty) : 'Próximamente'}</span>
        <span class="card-title">${esc(e.title)}</span>
        <span class="card-topic">${e.available ? esc(e.topic) : 'Todavía no disponible'}</span>
        <span class="card-mark" aria-hidden="true">${e.available ? '✎' : '—'}</span>
      </button>`).join('')}</div>
    <details class="player-progress"><summary>Mi progreso</summary><div class="progress-line"><span><strong>${progress.attempts}</strong> intentos</span><span><strong>${progress.passed}</strong> aprobados</span><span>Mejor nota <strong>${progress.bestScore}/100</strong></span></div></details>
  </section>`, '', true);
  document.querySelectorAll('[data-exam]:not(:disabled)').forEach(b => b.onclick = () => introduction(b.dataset.exam));
  document.querySelectorAll('[data-category]').forEach(b => b.onclick = () => {
    category = b.dataset.category; home();
    document.querySelector(`[data-category="${category}"]`).focus({ preventScroll: true });
  });
}
function introduction(examId = selectedExamId) {
  const exam = catalog.exams.find(e => e.id === examId && e.available);
  if (!exam) return;
  selectedExamId = exam.id;
  shell(`<section class="sheet narrow welcome-sheet">
    <div class="paper-top"><span>ANTES DE EMPEZAR</span><span>${esc(exam.title.toUpperCase())} · ${esc(exam.difficulty.toUpperCase())}</span></div>
    <div class="welcome-copy"><h1>${esc(exam.displayTitle || exam.topic).replace(/\n/g, '<br>')}</h1><p class="lead">${esc(exam.brief || exam.introduction)}</p></div>
    <div class="rules-strip"><span><strong>05</strong> preguntas</span><span><strong>30<span>s</span></strong> por pregunta</span><span><strong>03</strong> aciertos para aprobar</span></div>
    <div class="actions"><button class="text-button" id="back">← Volver a mi mesa</button><button class="primary" id="start">Tomar el lápiz y comenzar →</button></div>
  </section>`);
  document.querySelector('#back').onclick = home;
  document.querySelector('#start').onclick = start;
  window.scrollTo(0, 0);
}
async function start() {
  if (busy) return;
  busy = true;
  const b = document.querySelector('#start'); if (b) { b.disabled = true; b.textContent = 'Preparando tu hoja…'; }
  try { session = await api('/sessions', { examId: selectedExamId }); selected = null; clockOffset = session.serverNow - Date.now(); question(); }
  catch (e) { error(e.message, start); }
  finally { busy = false; if (b) { b.disabled = false; b.textContent = 'Tomar el lápiz y comenzar →'; } }
}
function question() {
  const { question: q, questionIndex: i } = session;
  const exam = catalog.exams.find(e => e.id === session.examId);
  shell(`<section class="sheet question-sheet">
    <div class="question-toolbar">
      <div class="timer" role="timer" aria-label="Tiempo restante" aria-live="off">
        <svg viewBox="0 0 44 44" aria-hidden="true"><circle class="timer-track" cx="22" cy="22" r="19"/><circle id="timer-ring" cx="22" cy="22" r="19" pathLength="100"/></svg>
        <span class="timer-value"><strong id="seconds">30</strong><span>s</span></span>
      </div>
      <div class="exam-heading"><span>${esc(exam.title.toUpperCase())}</span><span>${esc(exam.shortTopic || exam.topic)}</span></div>
      <div data-exam-face></div>
      <span class="question-count">${i + 1} / 5</span>
    </div>
    <div class="question-content"><h1 class="question-title" tabindex="-1">${esc(q.text)}</h1>
    <fieldset class="options"><legend class="sr-only">Selecciona una respuesta</legend>${q.options.map((o, n) => `<label class="option"><input type="radio" name="answer" value="${o.id}"/><span class="option-letter">${String.fromCharCode(65 + n)}${pencil}</span><span>${esc(o.text)}</span></label>`).join('')}</fieldset></div>
    <div class="answer-note" aria-live="polite" id="answer-note">Marca una opción y confirma tu respuesta.</div>
    <div class="actions"><button class="primary" id="confirm" disabled>${i === 4 ? 'Entregar examen' : 'Confirmar respuesta'} →</button></div>
  </section>`);
  examFace = new ExamFace(createFaceView(document.querySelector('[data-exam-face]')));
  window.scrollTo(0, 0);
  document.querySelector('.question-title').focus({ preventScroll: true });
  document.querySelectorAll('input[name="answer"]').forEach(input => input.onchange = () => {
    if (busy) return;
    const remaining = Math.max(0, session.deadline - Date.now() - clockOffset);
    if (remaining === 0) { tick(); return; }
    examFace.updateRemaining(remaining);
    examFace.answerChanged(selected, input.value);
    selected = input.value;
    document.querySelectorAll('.option').forEach(el => el.classList.toggle('selected', el.querySelector('input').checked));
    document.querySelector('#confirm').disabled = false;
    document.querySelector('#answer-note').textContent = 'Respuesta marcada. Confirma para continuar.';
  });
  document.querySelector('#confirm').onclick = () => submit(false);
  tick(); timer = setInterval(tick, 150);
}
function tick() {
  if (!session || session.finished) return;
  const remaining = Math.max(0, session.deadline - Date.now() - clockOffset);
  examFace?.updateRemaining(remaining);
  document.querySelector('#seconds').textContent = Math.ceil(remaining / 1000);
  const fraction = remaining / (session.rules.secondsPerQuestion * 1000);
  document.querySelector('#timer-ring').style.strokeDashoffset = 100 * (1 - fraction);
  const timerElement = document.querySelector('.timer');
  timerElement.classList.toggle('warning', remaining < 15000 && remaining >= 5000);
  timerElement.classList.toggle('urgent', remaining < 5000);
  if (remaining === 0 && !busy) submit(true);
}
async function submit(timeout) {
  if (busy) return;
  // Account for a deadline crossed between the last tick and the click.
  timeout = timeout || Date.now() + clockOffset >= session.deadline;
  busy = true; clearInterval(timer);
  const button = document.querySelector('#confirm'); button.disabled = true; button.textContent = timeout ? 'Tiempo agotado…' : 'Guardando…';
  document.querySelectorAll('input[name="answer"]').forEach(el => el.disabled = true);
  try {
    if (timeout) {
      examFace?.updateRemaining(0);
      document.querySelector('#seconds').textContent = '0';
      document.querySelector('#timer-ring').style.strokeDashoffset = 100;
      document.querySelector('#answer-note').textContent = 'Tiempo agotado. Pasamos a la siguiente hoja…';
      // This is a presentation delay, not another countdown. Request the next
      // question afterwards so its server-side 30-second deadline starts fresh.
      const continueTransition = await new Promise(resolve => {
        timeoutTransition = { resolve, id: setTimeout(() => {
          timeoutTransition = null;
          resolve(true);
        }, FACE_CONFIG.timeoutPauseMs) };
      });
      if (!continueTransition) return;
    }
    session = await api(`/sessions/${session.sessionId}/answers`, { questionId: session.question.id, optionId: timeout ? null : selected });
    selected = null;
    if (session.finished) { progress = session.progress; results(); }
    else { clockOffset = session.serverNow - Date.now(); question(); }
  } catch (e) { error(e.message, () => submit(timeout || Date.now() + clockOffset >= session.deadline)); }
  finally { busy = false; }
}
function results() {
  const r = session.result;
  const exam = catalog.exams.find(e => e.id === r.examId);
  function reviewMarkup(i) {
    const d = r.details[i];
    const q = session.questions.find(q => q.id === d.questionId);
    const answer = q.options.find(o => o.id === d.selectedOptionId);
    return `<article class="review"><span class="review-mark ${d.correct ? 'correct' : ''}" role="img" aria-label="${d.correct ? 'Respuesta correcta' : 'Respuesta incorrecta'}">${d.correct ? '✓' : '×'}</span><div><h3>${i + 1}. ${esc(q.text)}</h3><p>Tu respuesta: <strong>${answer ? esc(answer.text) : 'Sin respuesta (omitida o fuera de tiempo)'}</strong></p>${!d.correct ? `<p class="correct-text">Respuesta correcta: ${esc(q.options.find(o => o.id === d.correctOptionId).text)}</p>` : ''}<p class="explanation">${esc(q.explanation)}</p></div></article>`;
  }
  shell(`<section class="sheet results-sheet"><div class="paper-top"><span>CORRECCIÓN / ${esc(exam.title.toUpperCase())}</span><div data-exam-face></div><span>EXAMEN ENTREGADO</span></div><div class="result-header"><div><p class="eyebrow">${r.passed ? '¡BUEN TRABAJO!' : 'CADA INTENTO ENSEÑA'}</p><h1>${r.passed ? 'Una huella<br>bien puesta.' : 'La historia sigue.<br>Vuelve a intentarlo.'}</h1><p class="lead">${r.correct} de ${r.total} respuestas correctas. ${r.passed ? `Has aprobado ${esc(exam.title)}.` : 'Necesitas tres aciertos para aprobar.'}</p></div><div class="grade ${r.passed ? 'passed' : ''}"><strong>${r.score}<small>/100</small></strong><span>${r.passed ? 'APROBADO' : 'A REPASAR'}</span></div></div>
    <h2 class="review-title">Repasemos tu hoja</h2>
    <div class="reviews" id="review-panel" role="region" aria-label="Corrección de la pregunta" aria-live="polite" aria-atomic="true">${reviewMarkup(0)}</div>
    <nav class="review-navigation" aria-label="Elegir pregunta para repasar">${r.details.map((d, i) => `<button class="review-number ${d.correct ? 'correct' : 'incorrect'}" data-review="${i}" aria-label="Pregunta ${i + 1}: ${d.correct ? 'correcta' : 'incorrecta'}" aria-controls="review-panel" aria-pressed="${i === 0}">${i + 1}</button>`).join('')}</nav>
    <div class="actions"><button class="text-button" id="home">← Volver a mi mesa</button><button class="primary" id="again">Intentarlo de nuevo →</button></div></section>`);
  resultEnvelope = new ResultEnvelope(document.querySelector('.results-sheet'), {
    onReveal() {
      examFace = new ExamFace(createFaceView(document.querySelector('[data-exam-face]')));
      examFace.finish(r);
    }
  });
  document.querySelectorAll('[data-review]').forEach(button => button.onclick = () => {
    document.querySelector('#review-panel').innerHTML = reviewMarkup(Number(button.dataset.review));
    document.querySelectorAll('[data-review]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  });
  document.querySelector('#home').onclick = () => { session = null; home(); };
  document.querySelector('#again').onclick = () => introduction(r.examId);
  window.scrollTo(0, 0);
}
async function load() {
  shell('<section class="sheet narrow"><p class="eyebrow">ABRIENDO EL CUADERNO</p><h1>Preparando<br>tu escritorio…</h1></section>');
  try { [catalog, progress] = await Promise.all([api('/catalog'), api(`/progress?playerId=${playerId}`)]); home(); }
  catch (e) { error('No se pudo abrir el cuaderno. Comprueba que el backend esté en ejecución. ' + e.message, load); }
}
load();
