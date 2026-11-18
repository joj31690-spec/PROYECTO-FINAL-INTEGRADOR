# ResultEnvelope

`frontend/src/result-envelope/ResultEnvelope.js` controla exclusivamente la presentación del examen ya evaluado. Su CSS está en `style.css`, dentro de la misma carpeta. La integración se limita a `results()` y a la limpieza de pantalla en `frontend/src/main.js`.

## Documento único

La función de resultados construye su hoja real una sola vez, con nota, explicación y navegación ya enlazadas. `ResultEnvelope` mueve **ese mismo nodo DOM** a una ventana de papel, sin copiarlo ni recalcular resultados. Al finalizar lo extrae del contenedor; sus controles y eventos siguen siendo los originales.

Mientras está cerrado, la hoja está oculta, con `aria-hidden` e `inert`. Solo son accesibles el mensaje de entrega y el botón «ABRIR RESULTADOS». No hay apertura automática. Durante la extracción el contenido real se mueve con el papel, detrás del frente del sobre y recortado por su borde inferior. Los controles conservan su espacio pero aparecen solo al terminar.

## Secuencia

Estados: `closed` → `opening` → `revealed`. La activación repetida se ignora y el botón se desactiva inmediatamente.

La Web Animations API nativa coordina las fases de `ENVELOPE_TIMING`: ruptura del sello (180 ms), solapa (230 ms), extracción (580 ms) y asentamiento (110 ms): 1,1 segundos de animación, aproximadamente 1,2 segundos incluyendo los cambios de fotograma. Las dos mitades del sello tienen un borde de grieta compartido. El frente y la parte posterior descienden mientras el documento sube, manteniendo el orden de capas. El documento conserva la escala interior hasta quedar libre del frente, y después se ajusta al tamaño de lectura.

La mascota se monta con su resultado habitual en `onReveal`, cuando la transición ya ha terminado. No participa en el sobre ni se modifica su lógica.

## Accesibilidad y limpieza

- Botón nativo, operable con Enter o Espacio; foco inicial en él y foco final en el título de resultados.
- `prefers-reduced-motion` conserva el botón y omite la animación al abrir. Si la preferencia cambia durante la apertura, esta termina inmediatamente.
- `destroy()` cancela animaciones y elimina listeners, incluso si se abandona una fase intermedia. No hay intervalos ni temporizadores de espera.
- Cada examen terminado crea una instancia nueva y cerrada. La nota permanece en la sesión existente.

No se modifican API, puntuación, preguntas, reloj, progreso ni motor de procesamiento.

## Verificación inicial

Comprobado en Chromium: espera cerrada sin nota accesible, apertura con teclado y doble activación, contenido real visible durante la extracción, identidad del nodo antes/después, misma posición y dimensiones finales, revisión numerada, regreso al menú y reinicio al repetir. Se probaron resultados de 0, 3 y 5 aciertos; vista móvil de 320 × 568 sin desbordamiento; apertura inmediata con movimiento reducido; y destrucción durante la ruptura del sello sin animaciones o callbacks pendientes. Las pruebas generales se ejecutan con `pnpm test` y la compilación con `pnpm build`.
