# EduPulse · Impact Lab

Aplicación para el Reto 13 de Hack4Edu 2026: **«La escuela que aprende de sus datos»**.

EduPulse conecta señales educativas comprensibles, decisiones docentes y seguimiento de resultados. Impact Lab añade comparación de apoyos, escenarios ilustrativos, planes revisados y aprendizaje institucional con protección de grupos pequeños.

**Estado de esta entrega:** código mejorado y verificado localmente. La demo ficticia funciona sin cuenta ni Supabase. La versión privada necesita las migraciones y la configuración de un entorno Supabase. Esta entrega no ha modificado el despliegue publicado ni datos reales.

## Probar la aplicación

Usa Node.js 22.12 o superior; la verificación se realizó con Node.js 24.22.1.

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 8080
```

Abre **http://localhost:8080/demo/impacto**. No hace falta copiar `.env.example` para esta demostración. Los cambios en la demo viven en memoria y desaparecen al recargar. Todos sus alumnos, seguimientos y agregados son ficticios y están identificados como tales.

El archivo `package-lock.json` permite una instalación reproducible con npm. También se ha actualizado `bun.lock` conservando la protección de antigüedad de versiones de `bunfig.toml`.

## Qué está implementado

| Ruta | Función | Requisito |
| --- | --- | --- |
| `/demo/impacto` | Comparar apoyos, explorar metas, aprobar un plan ficticio y ver su seguimiento | Ninguna cuenta; datos ficticios |
| `/panel` | Indicadores del docente o agregados protegidos de dirección | Supabase, sesión y centro |
| `/datos` | Alta y edición de alumnos seudonimizados y métricas | Docente autorizado |
| `/alertas` | Señales basadas en umbrales explicados | Docente autorizado |
| `/estudiantes/:studentId` | Ficha, métricas, propuestas y planes del alumno autorizado | Docente propietario |
| `/planes` | Validar propuestas, gestionar planes revisados y su estado | Docente autorizado |
| `/impacto` | Evaluación persistente de planes; dirección recibe solo agregados | Migraciones 0009 y 0010 |
| `/predicciones` | Informe de entrenamiento sintético y ejemplo visual separado | Sesión docente; inferencia no conectada |
| `/contratacion` | Paquetes y contratación institucional | Stripe y Supabase de servidor para cobrar en pruebas |
| `/etica` | Compromisos de transparencia y responsabilidad docente | Pública |

La interfaz está disponible en español, inglés y francés. El menú móvil, los formularios y el flujo de demo se han comprobado en navegador en escritorio, tableta y móvil.

## Impact Lab, paso a paso

1. El docente abre un alumno desde las alertas, el panel o su ficha.
2. Compara tutorías, recursos/conectividad, coordinación familiar y acompañamiento académico. Puede combinar apoyos, retirar opciones y adaptar duración, objetivo y notas.
3. Explora metas con controles visuales. **No hay un modelo validado del efecto de las intervenciones:** los valores son hipótesis elegidas por la persona, no predicciones. No se guardan como observaciones.
4. Revisa y aprueba explícitamente. Puede crear un plan o utilizar uno existente. La operación guarda el plan y su línea de base de forma atómica.
5. Añade observaciones con fecha, asistencia, nota y tareas entregadas. La línea de base no se sobrescribe al editar el diseño. La participación usa las tareas entregadas como indicador parcial, señalado en pantalla.
6. El centro consulta cambios medios observados por apoyo principal. Cada alumno cuenta una sola vez, se excluyen ejemplos y se publican únicamente grupos de al menos cinco alumnos distintos.

Una mejora observada **no demuestra causalidad**. Los cambios se describen sin atribuirlos científicamente al apoyo. El umbral de cinco reduce la exposición de grupos pequeños; no equivale a anonimato garantizado ni a privacidad diferencial.

## Configurar el centro privado

1. Crea o utiliza un proyecto Supabase de pruebas.
2. Copia `.env.example` a `.env` y configura la URL y la clave pública en las variables `VITE_` y sus equivalentes de servidor.
3. Configura la conexión PostgreSQL del entorno de pruebas en `LOVABLE_DB_MIGRATION_URL`.
4. Aplica las migraciones con el mecanismo que ya gestione ese entorno:

```bash
npm run db:migrate
```

**Instalación nueva:** necesita toda la secuencia SQL `0000`–`0010`, incluyendo Auth y Realtime de Supabase. **Entorno existente con `0000`–`0008` ya aplicado:** instala solamente `0009` y `0010` mediante su historial de migración existente. No vuelvas a ejecutar las migraciones antiguas ni mezcles historiales distintos.

El esquema autoritativo son los SQL de `drizzle/migrations/`. El `drizzle/schema.ts` original es un archivo generado vacío: **no utilices `drizzle-kit push` para reconstruir esta base**. `db:migrate` aplica los SQL registrados; no calcula un reemplazo de esquema. Las dos migraciones nuevas se ejecutaron completas en PostgreSQL local desechable con el resto de la cadena.

5. Inicia sesión y crea un centro propio o acepta una invitación de dirección. Un docente accede exclusivamente a sus alumnos. Dirección consulta agregados. No existe un rol confiable tomado de metadatos editables del perfil.
6. Comprueba el circuito con cuentas y alumnos ficticios antes de utilizar un centro real. La demo pública funciona aunque estas configuraciones estén vacías.

Si falta la migración de Impact Lab, su página muestra un error recuperable y no inventa registros. El resto de los apartados conserva sus consultas existentes.

## Qué hace realmente la IA

- Las alertas operativas son **reglas**, no inferencia de abandono: asistencia <75/85%, nota <5/6 y entregas <60/75% para prioridad/seguimiento.
- `model/train_model.py` entrena un Random Forest con **600 registros completamente sintéticos**: 480 de entrenamiento y 120 de prueba. La búsqueda de hiperparámetros utiliza validación cruzada en entrenamiento.
- El entrenamiento se ejecutó de nuevo para esta entrega. El informe, el CSV y el modelo se encuentran en `artifacts/`. Las métricas de la interfaz leen ese informe; ya no proceden de números ilustrativos fijados en el código.
- El servicio `prediction-service.ts` devuelve `connected: false`. No existe en esta entrega una API de inferencia conectada, validación con alumnos reales ni un modelo causal de intervenciones.
- Los pesos del ejemplo visual no son SHAP. La heurística del script tampoco es una atribución local validada. Se han corregido sus nombres y advertencias y su división por cero.

Para reproducir el experimento (Python 3.12 recomendado):

```bash
python -m venv .venv
# Activa el entorno virtual según tu sistema.
pip install -r model/requirements.txt
python model/train_model.py
python -m unittest discover -s model -p 'test_*.py' -v
```

No cargues modelos `joblib` de procedencia desconocida. El entrenamiento reproduce y exporta el modelo sin cargar el binario adjunto.

## Contratación y sostenibilidad

Los paquetes son contratos de despliegue, soporte y formación que puede financiar una administración, fundación, ONG o patrocinador. Sus importes actuales son únicos e inclusivos según la configuración fiscal del pago:

| Paquete | Importe del paquete | Máximo de centros |
| --- | ---: | ---: |
| Piloto | 490 € | 1 |
| Distrito | 1.850 € | 5 |
| Regional | 4.500 € | 15 |

El precio no baja al seleccionar menos centros. La reserva de capacidad, el precio y la activación se verifican en servidor. El banco solidario conserva la asignación pendiente hasta designar beneficiarios reales. Una licencia registrada **no crea ni habilita cuentas de centros automáticamente**. La prestación de formación, soporte o integración requiere acuerdo y ejecución humana; no se anuncia una sincronización offline que el código no implementa.

Para comprobar la compra configura `SUPABASE_SERVICE_ROLE_KEY`, una `STRIPE_SECRET_KEY` **de pruebas**, los orígenes permitidos y Stripe Automatic Tax. Para el correo configura además las variables Resend/Lovable y un remitente válido. El trabajo de recuperación `POST /api/public/jobs/purchase-confirmations` exige el secreto del planificador; debe llamarse periódicamente con `{"kind":"purchase-confirmations"}` para reconciliar compras que no regresen del checkout.

**No se ejecutaron pagos, envíos de correo ni activaciones externas en esta revisión.** Las pruebas SQL verifican localmente la lógica de reserva, activación y outbox; no sustituyen una compra end-to-end con Stripe y un correo entregado.

## Verificación

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`test:e2e` inicia por sí mismo un servidor local con la configuración Cloud vacía. Cubre la demo, las rutas públicas, las redirecciones privadas y el aislamiento de idiomas del servidor. No prueba el inicio de sesión real ni el envío de un plan al Supabase remoto. La base local PGlite sí ejecuta y comprueba las políticas SQL y RPC con roles sintéticos.

Resultados y límites detallados: [docs/AUDITORIA_Y_ENTREGA.md](docs/AUDITORIA_Y_ENTREGA.md). Presentación de dos minutos: [docs/DEMO_2_MINUTOS.md](docs/DEMO_2_MINUTOS.md).

## Compilar y desplegar

Se verificaron ambos destinos sin publicarlos:

- **Lovable / Cloudflare:** `npm run build` conserva la configuración existente de TanStack Start y Nitro. Configura el entorno y los secretos en el proveedor y utiliza su proceso habitual de despliegue. No publiques `.env`.
- **Servidor Node:** `NITRO_PRESET=node-server npm run build`, seguido de `node .output/server/index.mjs`. Define `NITRO_HOST` y `NITRO_PORT` en el alojamiento si corresponde. En PowerShell, establece `$env:NITRO_PRESET="node-server"` antes de compilar.

Las variables `VITE_` se fijan durante la compilación. Construye de nuevo después de cambiarlas. Aplica las migraciones y verifica un entorno de pruebas antes de desplegar el nuevo código privado.

El flujo completo de demo, idiomas y rutas también se verificó sobre la compilación Node con `EDU_E2E_PRODUCTION=1 npm run test:e2e`. En esta revisión se proporcionó a Playwright un Chromium local mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, porque la descarga estándar del navegador falló en el entorno de ejecución.
