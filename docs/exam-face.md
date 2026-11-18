# ExamFace

Detalle visual independiente de la evaluación, implementado en `frontend/src/exam-face/`.

- `config.mjs`: expresiones, intervalos, tamaño, transición y duraciones. La reacción por cambio muestra 🤨 durante 500 ms y después vuelve directamente a la expresión del tiempo restante. La pausa visual de tiempo agotado dura 1000 ms.
- `state.mjs`: estado y prioridades: resultado → tiempo agotado → reacción temporal → tiempo restante. Recibe los milisegundos del temporizador existente; no crea otro contador. Cada reinicio, resultado o destrucción cancela los callbacks de la reacción anterior.
- `view.js`: representación accesible y pequeña transición visual, respetando movimiento reducido.
- `style.css`: posicionamiento central sin alterar el tamaño de la cabecera; ajuste de la información lateral en móvil.

`main.js` crea una instancia por pregunta, llama a `updateRemaining` desde `tick` y a `answerChanged(previous, next)` en la selección. En resultados usa `finish(result)` con los aciertos y el estado de aprobación de la API. La mascota no conoce las claves de respuesta durante la partida. Cero aciertos muestra 🤪; todos los aciertos, 😎; los demás resultados usan `passed` del evaluador existente.

Al llegar a cero se bloquean los controles, se muestra 😵 y se espera un segundo antes de enviar la omisión y solicitar la siguiente pregunta. Así no se consume el tiempo de la pregunta siguiente durante la pausa. También se aplica a la última pregunta antes de mostrar resultados. No se cambian el backend ni los treinta segundos originales.

Para reemplazar los emojis por dibujos, pasar otro `renderArtwork(artwork, expression, key)` a `createFaceView`. Ese renderer puede insertar un `<img>` con rutas por estado, un SVG o un sprite dentro de `artwork`. Las dimensiones ya se adaptan al contenedor y no se modifica `ExamFace` ni el juego.

Verificación automatizada: `pnpm test`, incluidos límites temporales, cambios rápidos, cancelación por caducidad/salida y los seis resultados posibles (0–5 aciertos).
