import { FACE_CONFIG } from './config.mjs';
import './style.css';

// Replace this renderer with an <img>, SVG or sprite renderer; state stays intact.
export function renderEmoji(artwork, expression) {
  artwork.textContent = expression.emoji;
}

export function createFaceView(element, renderArtwork = renderEmoji) {
  element.classList.add('exam-face');
  element.setAttribute('role', 'img');
  element.style.setProperty('--face-size', `${FACE_CONFIG.size}px`);
  element.style.setProperty('--face-mobile-size', `${FACE_CONFIG.mobileSize}px`);
  const artwork = document.createElement('span');
  artwork.className = 'exam-face-art';
  artwork.setAttribute('aria-hidden', 'true');
  element.replaceChildren(artwork);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current, animation;
  const cancelAnimation = () => animation?.cancel();
  reducedMotion.addEventListener('change', cancelAnimation);
  return {
    render(key) {
      if (key === current) return;
      current = key;
      const expression = FACE_CONFIG.expressions[key];
      animation?.cancel();
      renderArtwork(artwork, expression, key);
      element.dataset.expression = key;
      element.setAttribute('aria-label', `Mascota: ${expression.label}`);
      if (!reducedMotion.matches) animation = artwork.animate([
        { transform: 'translateY(1px) scale(.94)', opacity: .75 },
        { transform: 'translateY(0) scale(1)', opacity: 1 }
      ], { duration: FACE_CONFIG.transitionMs, easing: 'ease-out' });
    },
    destroy() {
      animation?.cancel();
      reducedMotion.removeEventListener('change', cancelAnimation);
    }
  };
}
