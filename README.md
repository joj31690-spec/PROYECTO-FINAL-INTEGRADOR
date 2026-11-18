# Cultura Chaqueña

**plataformaeducativo y laboratorio introductorio de computación paralela y distribuida.**

## 1. Introducción y contextualización

Cultura Chaqueña propone aprender sobre el Chaco boliviano mediante una experiencia inspirada en los exámenes tradicionales: una hoja, un lápiz, un tiempo limitado y una corrección que explica cada respuesta. Está dirigido a estudiantes y personas interesadas en la historia y cultura regional.

La categoría Historia tiene tres niveles: **Historia 1 · Fácil**, **Historia 2 · Medio** e **Historia 3 · Avanzado**. Cada banco contiene diez preguntas; cada partida selecciona cinco y mezcla las opciones. Hay cuatro opciones por pregunta, treinta segundos para responder y tres aciertos para aprobar. Al terminar, el jugador abre un sobre de resultados y revisa las explicaciones. Geografía, Economía y Cultura quedan como categorías pendientes.

Como una partida de cinco preguntas no justifica por sí sola un procesamiento de alto rendimiento, el proyecto incluye un **laboratorio independiente de evaluación por lotes**. Este permite ejecutar el mismo cálculo secuencialmente, con hilos OpenMP y con procesos MPI en tres contenedores. La UI, la gestión de partidas y el laboratorio conservan responsabilidades separadas.

Esta entrega corresponde al **despliegue funcional y primer borrador paralelo**: conectividad, herramientas, equivalencia matemática y una medición inicial de memoria. No pretende demostrar aceleración con un lote pequeño ni incluye estudios de speedup, eficiencia, Amdahl o Gustafson.

## 2. Requisitos y estado de cumplimiento

El detalle de comprobaciones y resultados de esta máquina está en **[docs/requirements-validation.md](docs/requirements-validation.md)**. Los logs reproducibles se generan en `docs/evidence/` al ejecutar la demostración.

| Exigencia académica | Estado | Implementación / evidencia |
|---|---|---|
| Al menos 3 nodos: 1 Master + 2 Workers | Cumple | Servicios `master`, `worker1`, `worker2` saludables en `docker compose ps` |
| Bridge interna, DNS y SSH sin contraseña | Cumple | Red `cluster` inspeccionada y nueve rutas verificadas con `bash scripts/test-connectivity.sh` |
| GCC/G++, OpenMP y OpenMPI instalados y probados | Cumple | GCC/G++ 11.4.0, OpenMPI 4.1.2, smoke tests correctos sobre los tres nodos |
| Correctitud matemática | Cumple para el lote validado | C++ secuencial, OpenMP 1/2 hilos y MPI 1/3 procesos coinciden campo por campo con el motor JS |
| Huella inicial de memoria | Cumple | RSS por proceso, informes GNU time y captura host de `docker compose stats --no-stream` |
| Primera versión paralela | Cumple | `src/batch.cpp`: bucle OpenMP estático y partición MPI cíclica con recolección de resultados |
| Repositorio y estructura oficial | Incorporada en esta entrega | `src/`, `infrastructure/`, `data/`, `scripts/`, `docs/`; URL y clonación debajo |
| Arranque con un comando | Cumple | `docker compose up -d`; alternativa con reconstrucción y espera: `bash scripts/cluster-up.sh` |

Los nodos son **contenedores que actúan como nodos virtuales**, no tres máquinas físicas ni tres VM con kernels independientes. Comparten los recursos del host Docker. Hay un cuarto contenedor `web` para el videojuego; los tres nodos de cómputo están aislados en su red interna.

## 3. Clonación y arranque

Requisitos en el host: Git, Docker Engine y Docker Compose v2, con acceso al daemon Docker. La primera construcción necesita Internet para descargar imágenes y paquetes. Entorno de referencia: Linux, 2 CPU y aproximadamente 8 GB de RAM; no es un mínimo universal medido. Los comandos `bash scripts/…` requieren Bash.

```sh
git clone https://github.com/joj31690-spec/PROYECTO-FINAL-INTEGRADOR.git
cd PROYECTO-FINAL-INTEGRADOR
docker compose up -d
```

El primer arranque construye las imágenes. Esperar a que los tres nodos aparezcan `healthy`:

```sh
docker compose ps
```

**Videojuego en Docker: http://localhost:8080**.

Para reconstruir tras cambios y esperar automáticamente a los nodos:

```sh
bash scripts/cluster-up.sh
```

No se necesitan GCC, MPI, claves SSH ni Node.js instalados en el host para la demostración Docker. Las claves se generan en un volumen local del clúster, no se guardan en Git ni se copian de la cuenta del host. SSH no publica puertos al exterior. El registro inicial de claves de host se realiza explícitamente con `ssh-keyscan` dentro de la red aislada; después se usa `StrictHostKeyChecking yes` y `BatchMode yes`.

## 4. Guion para presentar en clase

### Terminal 1: levantar y verificar

```sh
bash scripts/cluster-up.sh
bash scripts/test-connectivity.sh
bash scripts/demo.sh
```

`demo.sh` ejecuta, en orden:

1. Estado de los servicios.
2. Resolución de nombres, ping y SSH en las nueve combinaciones de origen/destino (seis entre nodos distintos y tres locales).
3. Versiones de GCC/G++/OpenMPI y smoke OpenMP de dos hilos en cada nodo.
4. Smoke MPI: un proceso por nodo; imprime `rank`, nombre del nodo y suma esperada `1 + 2 + 3 = 6`.
5. Lote de ocho evaluaciones: C++ secuencial, OpenMP con uno y dos hilos y MPI con uno y tres procesos.
6. Comparación de todos los resultados con el oráculo JavaScript y registro de RSS.
7. Captura de consumo de los contenedores y configuración de red desde el host.

Resultado matemático esperado: **8 evaluaciones, 23 respuestas correctas de 40, 5 aprobadas y 460 puntos acumulados**. Cada acierto vale veinte puntos. El script termina con error si hay una discrepancia, si no funciona la red o si falla un smoke test.

### Terminal 2: recursos visibles desde el host

```sh
docker stats
```

O una captura puntual solo de este proyecto:

```sh
docker compose stats --no-stream
```

También se puede usar `htop` si ya está instalado en el host. La ejecución del lote es breve: es normal que los procesos terminen antes de apreciarlos en un monitor interactivo; los archivos de RSS conservan el máximo de cada proceso. No se añaden esperas artificiales ni cargas masivas.

### Navegador

Abrir http://localhost:8080, elegir Historia, completar una partida y abrir el sobre de resultados. Para el desarrollo local existente, la misma web continúa disponible en http://localhost:5173 al ejecutar `pnpm dev`.

## 5. Estructura oficial y arquitectura

```text
src/
  scoring.hpp             Funciones C++ de preparación, evaluación y consolidación
  batch.cpp               Ejecución secuencial, OpenMP y MPI
  smoke/                  Programas elementales OpenMP y MPI
infrastructure/
  Dockerfile.node         Imagen GCC/G++/OpenMP/OpenMPI/SSH
  entrypoint.sh           Claves en volumen y servicio SSH
  ssh_config              Cliente SSH sin contraseña, verificación de host activa
  sshd_config             Servidor SSH del laboratorio
data/
  demo-input.json         Lote pequeño, fijo y reproducible
  demo-expected.json      Salida del motor JS de referencia
scripts/
  cluster-up.sh           Construcción y arranque con espera
  test-connectivity.sh    Verificación DNS + ping + SSH
  demo.sh                 Guion de demostración y generación de evidencias
  cluster/                Pruebas ejecutadas dentro de los contenedores
  export-fixture.mjs      Exportación reproducible del lote y su oráculo
docs/
  requirements-validation.md  Documento de validación de esta entrega
  processing.md           Contrato JSON del motor
  evidence/               Logs y capturas de recursos generados localmente
frontend/                 Interfaz existente: Vite y JavaScript
backend/                  API Node, sesiones, plazos y progreso
engine/                   Referencia secuencial JS y CLI JSON
content/                  Bancos educativos, claves y explicaciones
tests/                    Pruebas automatizadas del juego y motor JS
compose.yaml              Tres nodos de cómputo + web, redes y volúmenes
Dockerfile                Imagen de producción del juego
```

Se incorporan las cinco carpetas oficiales con código y datos reales. Los módulos web existentes conservan sus rutas para mantener la continuidad del proyecto.

```text
Navegador → web/API → adaptador JS → motor secuencial JS → resultados del juego

Laboratorio aislado:
                    bridge interna «cluster»
                master ↔ worker1 ↔ worker2
                    SSH + mensajes MPI

data/demo-input.json → C++ secuencial / OpenMP / MPI → comparación con oráculo JS
```

La evaluación del videojuego está en `engine/sequential.mjs`; las implementaciones de laboratorio en `src/scoring.hpp` respetan el mismo contrato JSON y reglas versión 1. El juego sigue usando su adaptador `backend/processor.mjs`; **no envía automáticamente partidas al clúster**. Conectar ese adaptador con el ejecutable C++ será una integración posterior, sin alterar las pantallas.

### Qué se paraleliza

Cada evaluación es una unidad independiente. OpenMP asigna iteraciones a hilos y escribe en posiciones distintas del vector de resultados. MPI reparte las evaluaciones cíclicamente entre ranks; cada rank produce resultados parciales y el rank 0 los reúne con `MPI_Gather`/`MPI_Gatherv`. Se ordenan por identificadores estables y se consolidan sumas enteras: el resultado no depende del orden de ejecución. Los ocho casos de demostración incluyen los extremos de cero y cinco aciertos, el umbral de aprobación y respuestas omitidas.

El Master coordina el arranque MPI y también procesa su partición. No se implementa un planificador Master/Workers dinámico. Cada rank lee el mismo archivo pequeño, incluido en la imagen; no hay particionado distribuido de archivos ni almacenamiento compartido entre equipos.

## 6. Correctitud y memoria: cómo interpretar la evidencia

La comparación es estructural JSON, no una comparación textual de claves. Se contrastan nota, aprobación, detalles de cada respuesta, identificadores, orden final y estadísticas agregadas. La referencia se genera con el motor JS original: no se toma la salida paralela como su propia referencia.

- `*.process.txt`: `getrusage(RUSAGE_SELF).ru_maxrss`, máximo RSS de cada proceso C++ en Linux hasta el punto de registro, en **KiB**. MPI registra los tres ranks por separado.
- `*.memory.txt`: salida de `/usr/bin/time -v`. En MPI envuelve a `mpirun`; **no representa la suma de memoria de los tres nodos**.
- `docker-stats.txt`: instantánea de memoria/CPU de los contenedores, capturada desde el host al terminar la demostración. No es un pico de todo el experimento.
- `network.json`: inspección de Docker que permite verificar bridge, aislamiento interno y miembros de la red.

Los valores concretos, fecha y entorno de la verificación están en [docs/requirements-validation.md](docs/requirements-validation.md). Son una **línea base inicial**, no un benchmark de memoria ni una afirmación sobre escalabilidad. Las pruebas aportan evidencia para el conjunto validado; no constituyen una demostración exhaustiva de todos los datos posibles.

## 7. Comandos individuales dentro del Master

Primero registrar/verificar conectividad con `bash scripts/test-connectivity.sh`.

```sh
docker compose exec --user hpc master bash
```

Desde esa terminal:

```sh
bash scripts/smoke.sh
bin/batch seq data/demo-input.json
OMP_NUM_THREADS=2 bin/batch omp data/demo-input.json
mpirun --host master:1,worker1:1,worker2:1 --map-by ppr:1:node --mca btl_tcp_if_include eth0 --mca oob_tcp_if_include eth0 -np 3 bin/batch-mpi mpi data/demo-input.json
```

`bash scripts/compare.sh` requiere que el directorio de reportes esté preparado; `bash scripts/demo.sh` desde el host lo prepara automáticamente y guarda todas las salidas. Se usa `hpc` para ejecutar MPI sin permisos de root. Las opciones de interfaz MPI seleccionan `eth0`, disponible en estos contenedores con una sola red de cómputo.

## 8. Desarrollo local y pruebas del videojuego

Node.js 22.9 o posterior (recomendado 24), pnpm 11:

```sh
pnpm install
pnpm dev
```

Web: http://localhost:5173. API: http://localhost:3001. Configuración opcional en `.env`, tomando `.env.example` como referencia. En Docker la web usa el puerto 8080 del host. No hay rutas absolutas de una máquina concreta en la configuración del proyecto.

```sh
pnpm test
pnpm build
node scripts/sample-batch.mjs | node engine/cli.mjs
```

El progreso del juego se guarda en `DATA_DIR/progress.json`, o en el volumen Docker `progress`. El navegador conserva un identificador de jugador. Las sesiones son transitorias: recargar o reiniciar el backend abandona la partida. Más información sobre contenidos, contratos y animaciones en `docs/`.

## 9. Detener y volver a presentar

```sh
docker compose stop
docker compose start
```

Para eliminar los contenedores y redes, conservando los volúmenes y reportes:

```sh
docker compose down
```

Después de recrear nodos, volver a ejecutar la prueba de conectividad para actualizar las claves de host. El script de demostración también la ejecuta. Las evidencias detalladas se generan localmente y están excluidas de Git; el documento de validación contiene el resumen versionable.

## 10. Próximas etapas

Integración opcional del motor C++ con el backend, lectura de grandes lotes por bloques, distribución dinámica, ejecución en varios hosts reales y estudios experimentales de rendimiento. Las versiones actuales son preliminares y priorizan un contrato común, correctitud y reproducibilidad.
