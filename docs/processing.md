# Contrato del motor · versión 1

La referencia utilizada por el videojuego es JavaScript secuencial. El laboratorio incorpora implementaciones C++ secuencial, OpenMP y MPI en `src/`, con el mismo contrato JSON. El ejecutable acepta un archivo de entrada o `-` para stdin (en MPI se utiliza un archivo accesible en todos los nodos); escribe el resultado por stdout y diagnósticos por stderr. El adaptador backend es el único lugar que necesitará conocer el proceso externo cuando se integre con las partidas. Ver [validación de la entrega](requirements-validation.md).

## Entrada original

```json
{
  "schemaVersion": "1",
  "exams": [{ "id": "historia-1", "questions": ["cinco objetos de pregunta con id, options y correctOptionId"] }],
  "evaluations": [{
    "evaluationId": "evaluation-001",
    "examId": "historia-1",
    "answers": [{ "questionId": "chaco-paises", "optionId": "a" }]
  }]
}
```

El fragmento de `questions` es ilustrativo. Para obtener una entrada ejecutable: `node scripts/sample-batch.mjs`. Cada pregunta contiene cuatro opciones `{id,text}`, una clave `correctOptionId` y puede tener texto y explicación. IDs de evaluación y examen únicos. Las respuestas omitidas o `null` son incorrectas; IDs desconocidos y respuestas duplicadas se rechazan. El motor recibe respuestas cuyo plazo ya fue validado por el backend; no consulta relojes.

## Fases y estructuras

1. **Preparación — `prepareWork(input)`**: resuelve el examen y crea unidades `{evaluationId, examId, questions, answers}`. Datos originales separados de unidades; no muta la entrada.
2. **Cómputo — `evaluateUnit(unit)`**: función pura por evaluación. Devuelve `{evaluationId, examId, correct, total, score, passed, details}`. Cada detalle identifica pregunta, selección, clave y correctitud.
3. **Resultado parcial**: colección de resultados de unidades de un bloque; no contiene estado compartido entre evaluaciones.
4. **Consolidación — `consolidate(partials)`**: reúne resultados, valida IDs duplicados, ordena por `evaluationId` y suma enteros. No promediar promedios parciales.

La salida final tiene `{schemaVersion, rulesVersion, results, aggregate}`; `aggregate` contiene `evaluations`, `passed`, `correct`, `questions` y `totalScore`. Motor y referencia se limitan a enteros seguros de JavaScript, también para sumas; una futura ampliación que exceda ese rango deberá versionar su representación numérica. Con millones de evaluaciones de cinco preguntas, las sumas siguen siendo exactas. Comparar versiones por IDs y todos los campos semánticos, excluyendo metadatos de ejecución.

Reglas de referencia en `RULES`: cinco preguntas, treinta segundos por pregunta, veinte puntos por acierto, tres aciertos para aprobar. Las constantes C++ de `src/scoring.hpp` implementan `rulesVersion: "1"`; el lote de contrato comprueba que sus resultados coincidan con la referencia JS. Cualquier cambio de reglas debe coordinar ambas implementaciones y sus fixtures. El tiempo de respuesta sigue siendo responsabilidad exclusiva del backend.

## Distribución preliminar y futura

El borrador actual usa `omp parallel for schedule(static)` y partición MPI cíclica por rank. MPI reúne resultados serializados mediante `MPI_Gather`/`MPI_Gatherv`. Se podrá dividir el arreglo en bloques de tamaño configurable o asignar unidades dinámicamente. Cada hilo/proceso conserva sus resultados locales; la fase final consolida una sola vez. Ninguna unidad requiere el resultado de otra. Los aciertos y puntuaciones son enteros, de modo que el resultado no depende del orden de suma. Se usa orden canónico de IDs ASCII.

El contrato actual no promete streaming: carga todo el JSON en memoria. Para cargas realmente grandes se añadirá un lector por bloques/JSONL versionado, reutilizando la misma función por unidad. No hace falta modificar el juego.

## Instrumentación futura

La entrega actual registra RSS inicial por proceso y usa GNU time como reporte auxiliar; no realiza análisis de rendimiento. El ejecutable independiente permitirá envolver cada fase sin mezclarla con la UI. Una herramienta experimental separada podrá guardar un registro lateral por ejecución: `runId`, `datasetId`, `seed`, `engineVersion`, `inputSize`, `threads`, `mpiProcesses`, `preparationMs`, `communicationMs`, `processingMs`, `consolidationMs`, `totalMs`, `estimatedMemoryBytes` y resultado de validación. El registro por fases sigue pendiente. El conjunto determinista y las reglas deben identificarse para reproducibilidad. No incorporar tiempos al resultado matemático ni al puntaje.
