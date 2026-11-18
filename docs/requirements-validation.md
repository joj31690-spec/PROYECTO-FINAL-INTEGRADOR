# Validación de requisitos · Cultura Chaqueña

## Introducción

Cultura Chaqueña es un videojuego educativo de preguntas sobre la historia del Chaco boliviano. Combina una experiencia visual de examen tradicional con un laboratorio académico de computación paralela y distribuida. El juego evalúa partidas de cinco preguntas; el laboratorio evalúa lotes de partidas independientes con las mismas reglas de puntuación.

Esta entrega amplía la base secuencial original para satisfacer los requisitos de tres nodos Docker, conectividad, herramientas OpenMP/MPI, correctitud y memoria inicial. La demostración usa ocho evaluaciones fijas y no busca demostrar mejora de rendimiento.

## Entorno y fecha

Verificación realizada el **18 de noviembre de 2026**, aproximadamente a las **10:15, UTC−04:00**, sobre esta entrega local. Host Linux x86_64 con 2 CPU y 8.328.146.944 bytes de RAM (7,756 GiB visibles para Docker). Docker Engine **29.1.3**, Docker Compose **2.40.3**; nodos Ubuntu **22.04**, GCC/G++ **11.4.0**, OpenMPI **4.1.2**. Los valores de memoria siguientes pertenecen a una ejecución concreta y cambiarán entre equipos y ejecuciones.

## Matriz de cumplimiento

| Requisito | Estado verificado | Fundamento |
|---|---|---|
| Despliegue funcional de 1 Master + 2 Workers | **Cumple** | `master`, `worker1` y `worker2` iniciados y `healthy`; servicio `web` adicional en puerto 8080 |
| Red bridge interna | **Cumple** | Inspección Docker: `Driver=bridge`, `Internal=true`, tres miembros; subred asignada en esta ejecución `172.18.0.0/16` |
| Resolución de nombres entre nodos | **Cumple** | `getent hosts` resuelve los tres nombres desde cada nodo |
| SSH sin contraseña y conectividad | **Cumple** | Nueve rutas DNS + ping + SSH aprobadas, incluidas las seis rutas dirigidas entre nodos distintos |
| GCC/G++ con OpenMP | **Cumple** | Compilación con `gcc -fopenmp` y `g++ -fopenmp`; smoke de dos hilos correcto en los tres nodos |
| OpenMPI instalado y probado | **Cumple** | Smoke MPI con tres ranks en tres nombres de host distintos y suma `1+2+3=6` |
| Correctitud matemática | **Cumple para el conjunto validado** | Cinco configuraciones comparadas con el oráculo JS: todos los campos coinciden |
| Determinación de memoria inicial | **Cumple** | RSS por proceso, informes GNU time y snapshot de contenedores desde el host |
| Primer borrador paralelo funcional | **Cumple** | OpenMP de uno/dos hilos y MPI de uno/tres procesos completan el lote |
| Estructura oficial del repositorio | **Cumple en esta entrega** | Directorios reales `src/`, `infrastructure/`, `data/`, `scripts/`, `docs/`, además de los módulos web existentes |
| README con contexto, clonación y arranque | **Cumple** | Introducción, contextualización, URL GitHub, `git clone` y `docker compose up -d` |

Repositorio: [PROYECTO-FINAL-INTEGRADOR](https://github.com/joj31690-spec/PROYECTO-FINAL-INTEGRADOR). La estructura y los comandos descritos corresponden a la entrega que contiene este documento.

### 1. Despliegue y topología

Se construyeron las dos imágenes y se ejecutó `docker compose up -d --wait`. Los tres nodos quedaron saludables. La red `cultura-chaquena_cluster` contiene exclusivamente Master y Workers, no expone SSH al host y está marcada como interna. El videojuego usa otra red bridge y publica HTTP en el puerto 8080.

Estos son nodos virtualizados mediante **contenedores**: comparten el kernel y las CPU del mismo host. Se satisface el despliegue Docker solicitado, no un despliegue en tres equipos físicos. El Master lanza MPI y participa también en el procesamiento.

### 2. Prueba de conectividad

Se probaron estas rutas, todas con resultado `PASS DNS + ping + SSH`:

| Desde / hacia | master | worker1 | worker2 |
|---|---|---|---|
| master | PASS | PASS | PASS |
| worker1 | PASS | PASS | PASS |
| worker2 | PASS | PASS | PASS |

Resultado: `CONNECTIVITY PASS: 9/9 routes, including 6/6 inter-node routes.` Cada ruta incluye SSH desde el nodo origen al destino, sin contraseña y con el nombre de host esperado. Las claves del usuario `hpc` se generan al arrancar en un volumen compartido; no se versionan. La prueba registra inicialmente las claves de host de la red local y después mantiene su comprobación estricta.

### 3. Smoke tests y ejecución paralela

En cada nodo se observaron GCC/G++ 11.4.0, OpenMPI 4.1.2 y:

```text
OpenMP OK: threads=2 sum=2
```

El smoke MPI produjo, en orden de llegada variable:

```text
MPI rank=0/3 host=master
MPI rank=1/3 host=worker1
MPI rank=2/3 host=worker2
MPI OK: ranks=3 sum=6
```

Además del smoke elemental, `src/batch.cpp` procesó evaluaciones reales del formato del juego con OpenMP y MPI. La distribución MPI es estática y cíclica; el rank 0 consolida. OpenMP distribuye un bucle entre hilos. No se implementan planificación dinámica ni balanceo avanzado.

### 4. Correctitud matemática

El lote contiene ocho evaluaciones con IDs estables, opciones incorrectas, omisiones y valores de cero a cinco aciertos. El oráculo `data/demo-expected.json` se exportó desde `engine/sequential.mjs`. La entrada se conserva en `data/demo-input.json`; no se vuelve a sortear para cada configuración.

| Configuración | Comparación con referencia JS |
|---|---|
| C++ secuencial | PASS |
| OpenMP, 1 hilo | PASS |
| OpenMP, 2 hilos | PASS |
| MPI, 1 proceso en Master | PASS |
| MPI, 3 procesos, uno por nodo | PASS |

La comparación revisa el JSON completo: pregunta, opción elegida, opción correcta, acierto, puntuación y aprobación de cada evaluación, más los agregados. No compara solo el total. Resultado común:

```text
evaluations = 8
correct     = 23
questions   = 40
passed      = 5
totalScore  = 460
```

Esto corresponde a `23 × 20 = 460` puntos, con aprobación desde tres aciertos. Las sumas enteras y el orden final por ID evitan dependencia del orden de llegada. La validación cubre este lote y sus configuraciones; no se presenta como prueba exhaustiva para todos los datos posibles.

### 5. Huella inicial de memoria

**Máximo RSS observado internamente hasta el punto de registro de cada proceso**, mediante `getrusage`, en KiB:

| Ejecución | Proceso / rank | RSS (KiB) |
|---|---|---:|
| C++ secuencial | proceso único | 4096 |
| OpenMP, 1 hilo | proceso único | 4224 |
| OpenMP, 2 hilos | proceso único | 4224 |
| MPI, 1 proceso | rank 0 | 17424 |
| MPI, 3 procesos | rank 0 / master | 17644 |
| MPI, 3 procesos | rank 1 / worker1 | 17128 |
| MPI, 3 procesos | rank 2 / worker2 | 17156 |

GNU time, que observa la ejecución desde fuera, registró máximos RSS de **4224 KiB** para el secuencial y **4352 KiB** para cada ejecución OpenMP. Su intervalo de observación incluye el final del proceso y puede diferir del registro interno. Para MPI se registraron **25600 KiB** con un rank y **26496 KiB** con tres, correspondientes al alcance del comando `mpirun` observado por GNU time, **no a la suma de memoria de los ranks ni al total del clúster**. Todos los comandos terminaron con código cero.

Instantánea de memoria de contenedores al finalizar, obtenida con `docker compose stats --no-stream` desde el host:

| Servicio | Memoria observada |
|---|---:|
| master | 6,516 MiB |
| worker1 | 2,699 MiB |
| worker2 | 2,691 MiB |
| web | 17,04 MiB |

Esta captura refleja contenedores en reposo después del lote. No es un máximo durante el procesamiento. RSS por proceso y memoria del contenedor miden alcances diferentes y no se deben comparar como si fueran lo mismo. Tampoco se deben sumar máximos de distintos procesos como si hubieran ocurrido simultáneamente.

En esta ejecución OpenMPI emitió ocasionalmente una advertencia `plm:rsh: ... setpgid ... Permission denied(13)` al iniciar procesos. No impidió el arranque, el uso de los tres nodos ni la finalización con código cero; se conserva en los logs, junto con los registros de RSS.

### 6. Videojuego y nombre

`pnpm test`: **27 pruebas aprobadas**, incluyendo la comprobación de que el oráculo versionado siga coincidiendo con las reglas JS actuales. `pnpm build`: compilación correcta; imagen Docker de la web construida. Se comprobó en Chromium el título **Cultura Chaqueña · Cuaderno del Chaco** y el nombre visible **Cultura Chaqueña** en http://localhost:5173. La vista móvil de 390 px tiene ancho de contenido igual al viewport, sin desbordamiento horizontal. En http://localhost:8080 se completó otra partida y se abrió el sobre para acceder a la corrección y a los controles de revisión.

## Alcance y pendientes

El laboratorio paralelo funciona de manera independiente del juego. El backend de las partidas continúa utilizando la referencia secuencial JS; conectar su adaptador al motor C++ queda pendiente. El JSON se carga completo en cada rank y la recolección MPI usa tamaños `int`: este borrador es apropiado para la demostración pequeña, no para archivos arbitrariamente grandes. Tampoco hay tres hosts físicos, scheduler Slurm, balanceo dinámico ni estudio de rendimiento. No se han calculado speedup, eficiencia ni leyes de escalabilidad.

## Procedimiento reproducible

Desde la raíz del repositorio:

```sh
bash scripts/cluster-up.sh
bash scripts/test-connectivity.sh
bash scripts/demo.sh
docker compose stats --no-stream
```

El README contiene el contexto, la estructura oficial, la clonación, los comandos individuales y la interpretación de cada reporte. Los logs detallados se guardan en `docs/evidence/` y se regeneran en cada presentación.
