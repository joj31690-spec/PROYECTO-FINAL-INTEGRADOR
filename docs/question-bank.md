# Banco y selección por intento

`content/history-1.json` (Historia 1 · Fácil), `content/history-2.json` (Historia 2 · Medio) y `content/history-3.json` (Historia 3 · Avanzado: «Los secretos de la historia chaqueña») contienen diez preguntas cada uno. Los tres usan `selection: {randomQuestions: true, shuffleOptions: true}`. Los bancos, selecciones y revisiones de cada nivel se mantienen independientes.

`backend/exam-selection.mjs` usa Fisher–Yates y `crypto.randomInt` para mezclar una copia del banco, tomar cinco preguntas sin repetición y mezclar sus cuatro opciones. No cambia IDs, claves, explicaciones ni los datos originales. Otras pruebas podrán activar la misma política en sus datos; sin esa política conservan su orden.

Al crear una sesión, el backend guarda el examen resuelto en `session.exam`. La presentación, validación de respuestas, reintentos de solicitudes, evaluación y revisión final consultan esa misma selección. Nunca se vuelve a sortear al avanzar, renderizar, corregir o abrir el sobre. Repetir el examen crea otra sesión y otro sorteo; como en cualquier selección aleatoria, puede haber coincidencias con un intento anterior.

Las letras A–D que dibuja la interfaz indican posiciones visuales. El valor enviado es el ID original de la opción dentro de su pregunta, y `correctOptionId` sigue apuntando a ese ID, independientemente de su posición.

El motor secuencial no cambia: recibe un examen ya resuelto de **cinco** preguntas y sigue siendo determinista. La preparación aleatoria queda fuera del cálculo. Para reproducir un conjunto se conserva el examen resuelto; la función permite inyectar una fuente de enteros para fixtures deterministas. `scripts/sample-batch.mjs` conserva un examen fijo de cinco preguntas para su ejemplo de lotes.

Verificación: `pnpm test` comprueba el banco de diez, selecciones de cinco sin repetición, mezcla de opciones, integridad del banco, variación con fuentes deterministas distintas, corrección por ID para todos los puntajes y correspondencia exacta entre preguntas servidas y revisión final por HTTP.

## Incorporar otra prueba

Crear un JSON de banco con ID de examen único y preguntas con IDs estables; registrar su archivo en el mapa `exams` de `backend/server.mjs`. El catálogo publica sus metadatos sin claves. `displayTitle` admite saltos de línea para la bienvenida; `shortTopic` es el texto corto de la cabecera y `brief` la premisa. La interfaz usa el ID elegido para iniciar, repetir y mostrar el nombre del examen, sin componentes separados por nivel. El progreso continúa siendo el acumulado del jugador.
