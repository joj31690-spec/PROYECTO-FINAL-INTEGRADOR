# Datos de demostración

`demo-input.json` contiene ocho evaluaciones deterministas del mismo examen resuelto de cinco preguntas. `demo-expected.json` es el resultado completo de `engine/sequential.mjs`, no una salida copiada de la versión paralela.

Se incluyen 0, 1, 2, 3, 4 y 5 aciertos, omisiones, opciones incorrectas y orden de entrada invertido. Totales esperados: **8 evaluaciones, 5 aprobadas, 23 aciertos de 40 preguntas, 460 puntos acumulados**. El punto de corte es tres aciertos.

Regeneración explícita desde la raíz: `node scripts/export-fixture.mjs`. Los archivos quedan versionados para que Docker no necesite Node ni generación aleatoria para repetir la demostración. El banco educativo completo continúa en `content/` y no se distribuye al navegador.
