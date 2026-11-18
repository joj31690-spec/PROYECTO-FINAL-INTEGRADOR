import './style.css';

export const ENVELOPE_TIMING = Object.freeze({ seal: 180, flap: 230, extract: 580, settle: 110 });
const PAPER_INSIDE = 'translateY(31%) scale(var(--paper-scale))';
const PAPER_EXTRACTED = 'translateY(-1.2%) scale(1)';

// Owns presentation only. The supplied sheet already contains the real results
// and keeps its identity, content and event listeners throughout the reveal.
export class ResultEnvelope {
  constructor(sheet, { onReveal = () => {} } = {}) {
    this.sheet = sheet;
    this.onReveal = onReveal;
    this.state = 'closed';
    this.destroyed = false;
    this.animations = new Set();
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.stage = document.createElement('section');
    this.stage.className = 'result-envelope';
    this.stage.dataset.state = this.state;
    this.stage.setAttribute('aria-label', 'Entrega del examen corregido');
    this.stage.innerHTML = `
      <div class="envelope-caption"><h1>EXAMEN FINALIZADO</h1><p>Tu examen ha sido calificado.</p></div>
      <div class="envelope-back" aria-hidden="true"></div>
      <div class="envelope-paper" aria-hidden="true" inert></div>
      <div class="envelope-front" aria-hidden="true"></div>
      <div class="envelope-flap" aria-hidden="true"></div>
      <div class="wax-seal" aria-hidden="true"><span class="wax-fragment wax-left"></span><span class="wax-fragment wax-right"></span><svg class="wax-crack" viewBox="0 0 36 36"><path d="M19 0L15 10 21 18 16 26 19 36"/></svg></div>
      <button class="primary envelope-open">ABRIR RESULTADOS</button>`;
    this.paperWindow = this.stage.querySelector('.envelope-paper');
    this.button = this.stage.querySelector('.envelope-open');
    sheet.before(this.stage);
    this.paperWindow.append(sheet);
    sheet.dataset.revealState = 'closed';
    this.handleOpen = () => { void this.open(); };
    this.handleMotion = () => { if (this.motion.matches && this.state === 'opening') this.reveal(); };
    this.button.addEventListener('click', this.handleOpen);
    this.motion.addEventListener('change', this.handleMotion);
    this.button.focus({ preventScroll: true });
  }

  animate(element, keyframes, options) {
    const animation = element.animate(keyframes, { fill: 'forwards', easing: 'ease-in-out', ...options });
    this.animations.add(animation);
    return animation.finished;
  }

  async open() {
    if (this.destroyed || this.state !== 'closed') return;
    this.state = 'opening';
    this.stage.dataset.state = this.state;
    this.sheet.dataset.revealState = this.state;
    this.button.disabled = true;
    if (this.motion.matches) { this.reveal(); return; }
    const find = selector => this.stage.querySelector(selector);
    try {
      // Fragments share the original irregular seal outline and a jagged seam.
      await Promise.all([
        this.animate(find('.wax-crack'), [{ opacity: 0 }, { opacity: .85, offset: .25 }, { opacity: 0 }], { duration: ENVELOPE_TIMING.seal }),
        this.animate(find('.wax-left'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(-4px, 3px) rotate(-9deg)', opacity: 0 }], { duration: ENVELOPE_TIMING.seal }),
        this.animate(find('.wax-right'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(4px, 4px) rotate(10deg)', opacity: 0 }], { duration: ENVELOPE_TIMING.seal })
      ]);
      if (this.destroyed || this.state !== 'opening') return;
      this.stage.dataset.phase = 'flap';
      await this.animate(find('.envelope-flap'), [
        { transform: 'perspective(900px) rotateX(0deg)', zIndex: 4 },
        { transform: 'perspective(900px) rotateX(-90deg)', zIndex: 4, offset: .5 },
        { transform: 'perspective(900px) rotateX(-165deg)', zIndex: 1 }
      ], { duration: ENVELOPE_TIMING.flap });
      if (this.destroyed || this.state !== 'opening') return;
      this.stage.dataset.phase = 'extract';
      // The front hides the part still inside the pocket. The paper window
      // prevents its lower edge leaking beneath the closed envelope.
      await Promise.all([
        this.animate(this.sheet, [
          { transform: PAPER_INSIDE },
          { transform: 'translateY(3%) scale(var(--paper-scale))', offset: .65, easing: 'ease-out' },
          { transform: PAPER_EXTRACTED }
        ], { duration: ENVELOPE_TIMING.extract, easing: 'linear' }),
        this.animate(this.paperWindow, [{ clipPath: 'inset(0 0 12% 0)' }, { clipPath: 'inset(0)' }], { duration: ENVELOPE_TIMING.extract }),
        ...['.envelope-back', '.envelope-front', '.envelope-flap'].map(selector => {
          const transform = selector === '.envelope-flap' ? 'perspective(900px) rotateX(-165deg)' : '';
          return this.animate(find(selector), [
            { transform: `translateY(0) ${transform}` },
            { transform: `translateY(110svh) ${transform}` }
          ], { duration: ENVELOPE_TIMING.extract, easing: 'cubic-bezier(.4,0,.4,1)' });
        })
      ]);
      if (this.destroyed || this.state !== 'opening') return;
      this.stage.dataset.phase = 'settle';
      await this.animate(this.sheet, [{ transform: PAPER_EXTRACTED }, { transform: 'none' }], { duration: ENVELOPE_TIMING.settle, easing: 'ease-out' });
      this.reveal();
    } catch {
      // Canceled on disposal or reduced motion. If animation is unavailable,
      // still let the user reach their results after pressing the button.
      if (!this.destroyed && this.state === 'opening') this.reveal();
    }
  }

  stopAnimations() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }

  removeListeners() {
    this.button.removeEventListener('click', this.handleOpen);
    this.motion.removeEventListener('change', this.handleMotion);
  }

  reveal() {
    if (this.destroyed || this.state !== 'opening') return;
    this.state = 'revealed';
    this.sheet.dataset.revealState = this.state;
    this.paperWindow.inert = false;
    this.paperWindow.removeAttribute('aria-hidden');
    // Unwrap, never re-render or clone the document. Natural layout matches
    // the final animation frame, including its reserved navigation controls.
    this.stage.replaceWith(this.sheet);
    this.stopAnimations();
    this.removeListeners();
    this.onReveal();
    const heading = this.sheet.querySelector('h1');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeListeners();
    this.stopAnimations();
    if (this.stage.isConnected) this.stage.replaceWith(this.sheet);
  }
}
