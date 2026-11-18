export const FACE_CONFIG = Object.freeze({
  size: 30,
  mobileSize: 26,
  transitionMs: 180,
  skepticalMs: 500,
  timeoutPauseMs: 1000,
  // First matching band wins; use the same rounded seconds shown by the clock.
  timeBands: [
    { minimumSeconds: 16, expression: 'calm' },
    { minimumSeconds: 11, expression: 'thoughtful' },
    { minimumSeconds: 6, expression: 'worried' },
    { minimumSeconds: 1, expression: 'nervous' }
  ],
  expressions: {
    calm: { emoji: '🙂', label: 'Tranquilo' },
    thoughtful: { emoji: '🤔', label: 'Pensativo' },
    worried: { emoji: '😟', label: 'Preocupado' },
    nervous: { emoji: '😰', label: 'Nervioso' },
    expired: { emoji: '😵', label: 'Tiempo agotado' },
    skeptical: { emoji: '🤨', label: '¿Cambias de respuesta?' },
    zero: { emoji: '🤪', label: 'Cero aciertos' },
    failed: { emoji: '😞', label: 'A seguir practicando' },
    passed: { emoji: '🥳', label: 'Examen aprobado' },
    perfect: { emoji: '😎', label: 'Todas las respuestas correctas' }
  }
});
