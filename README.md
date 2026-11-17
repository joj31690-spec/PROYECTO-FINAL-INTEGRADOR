# El Examen · Cuaderno del Chaco

Videojuego educativo de examen tradicional. Primera prueba: **Historia 1**, historia básica del Chaco boliviano, nivel fácil. Cinco preguntas, cuatro opciones, treinta segundos por pregunta y tres aciertos para aprobar. La corrección y las explicaciones aparecen al entregar la última respuesta.

## Ejecución local

Requisitos: Node.js 22.9 o posterior (recomendado 24) y pnpm 11.

```sh
pnpm install
pnpm dev
```

Abrir **http://localhost:5173**. La API se inicia en el puerto 3001. `Ctrl+C` detiene ambos procesos. No hace falta copiar `.env.example`: los valores predeterminados permiten empezar. Para personalizar puertos, rutas o direcciones, copiarlo a `.env`. El proxy de Vite debe apuntar al puerto elegido para la API.

Versión compilada, servida por el backend:

```sh
pnpm build
pnpm start
```

Abrir **http://localhost:3001**. Las fuentes web son opcionales: sin Internet se usan las fuentes locales de reserva.

## Organización y arquitectura

```text
frontend/           Vite, interfaz y animación CSS del lápiz
backend/            API HTTP, sesiones, temporizador y progreso
content/            Exámenes y claves (solo servidor)
engine/             Motor secuencial puro y CLI JSON
scripts/            Desarrollo y pequeño lote determinista
tests/              Correctitud, contrato CLI y partida API
docs/               Contrato de procesamiento y referencias
Dockerfile          Compilación frontend + ejecución Node
compose.yaml        Un servicio local y volumen de progreso
```

**Flujo:** navegador → API → adaptador `backend/processor.mjs` → motor → API → pantalla de resultados. El frontend no calcula notas ni recibe claves antes de terminar. `engine/sequential.mjs` concentra reglas y evaluación. La API controla los plazos: una respuesta que llega después de los treinta segundos se considera sin responder. Cambiar de pestaña no reinicia el plazo. Cada confirmación abre la siguiente pregunta; no hay retroceso.

### API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/catalog` | Pruebas disponibles y pendientes, sin claves |
| POST | `/api/sessions` | `{examId, playerId}` → sesión, pregunta, plazo, hora del servidor |
| POST | `/api/sessions/:id/answers` | `{questionId, optionId, playerId}` → siguiente pregunta o resultado |
| GET | `/api/progress?playerId=…` | Intentos, aprobados y mejor nota |

`optionId: null` representa omisión. Reintentar una confirmación no duplica respuestas ni progreso. El identificador del jugador se guarda en localStorage; el progreso se persiste en `DATA_DIR/progress.json`. No hay cuentas ni autenticación en esta demostración. Las sesiones viven en memoria y caducan a la hora: reiniciar el servidor o recargar la página abandona la partida, pero conserva las estadísticas de las partidas terminadas. El almacenamiento actual está pensado para una sola instancia local.

## Preparación para paralelismo

El contrato completo está en [docs/processing.md](docs/processing.md). Cada evaluación es una unidad independiente. Se pueden particionar lotes de evaluaciones, calcular sus puntuaciones y reducir conteos enteros. La evaluación individual y por lotes usa exactamente la misma función. La consolidación ordena por identificadores estables, sin depender del orden de ejecución.

El futuro adaptador C/C++ se añadirá en `backend/processor.mjs`, conservando JSON de entrada/salida. El motor también se ejecuta sin HTTP ni navegador:

```sh
node scripts/sample-batch.mjs | node engine/cli.mjs
```

Este comando procesa solo dos evaluaciones conocidas; no mide rendimiento. Para las futuras versiones: implementar la referencia C++, validar el mismo contrato, incorporar OpenMP con GCC/G++, agregar después MPI con OpenMPI y configurar su entorno de ejecución. El particionamiento y el orden de consolidación son interfaces disponibles; no se implementan planificadores ni distribución multinodo. Las animaciones, temporizador y navegación no son cargas apropiadas para paralelizar.

## Docker básico (opcional)

```sh
docker compose up --build
```

Abrir **http://localhost:8080**. Un único contenedor sirve frontend y API, manteniendo separados sus códigos y el motor. El volumen `progress` conserva estadísticas. No se requiere C++ para la versión actual. En una etapa posterior se podrán crear imágenes de motor con GCC/OpenMP/OpenMPI e infraestructura propia bajo `infra/`; no se incluye clúster ni conexiones SSH.

## Verificación

```sh
pnpm test
pnpm build
```

Las pruebas comprueban el umbral de aprobación, puntuaciones, equivalencia individual/lote, independencia del orden, validación de entradas, CLI y una partida por HTTP con persistencia y reintentos. La prueba HTTP usa el puerto 3199 y almacenamiento temporal aislado.

Verificación inicial realizada: seis pruebas automáticas aprobadas, compilación de producción correcta, partida completa en Chromium con 100/100 y cinco explicaciones, avance automático al vencer treinta segundos y vista móvil de 390 px sin desbordamiento horizontal. La configuración Compose pasó `docker compose config --quiet`; la imagen Docker no se construyó en esta etapa.

## Pendientes de la siguiente etapa

- Implementaciones C++ secuencial, OpenMP y MPI con el mismo contrato.
- Particionamiento por bloques o dinámico y parámetros de hilos/procesos.
- Generación reproducible de datos grandes en herramientas independientes.
- Instrumentación separada de preparación, comunicación, cómputo y consolidación; validación cruzada contra la referencia.
- Imágenes e infraestructura multinodo, almacenamiento compartido y ejecución MPI.
- Experimentos, speedup, eficiencia, Amdahl/Gustafson y gráficas, únicamente cuando corresponda.

No se han incorporado benchmarks, mediciones, algoritmos paralelos ni infraestructura distribuida.
