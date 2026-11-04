# Auditoría y entrega de EduPulse Impact Lab

Fecha: 4 de noviembre de 2026. Alcance: el código del ZIP adjunto y pruebas locales con datos ficticios. No se modificó el repositorio remoto, el sitio publicado, cuentas externas, centros reales, compras ni licencias reales.

## 1. Resultado

Se conserva React 19, TypeScript, TanStack Start y sus rutas, Supabase, las migraciones existentes, las propuestas revisables, planes, contratación, notificaciones y tres idiomas. Se implementa Impact Lab sobre el sistema de planes existente, sin una segunda lista de intervenciones desconectada.

La demo pública permite recorrer el flujo completo sin cuenta. La versión privada incluye persistencia mediante RPC y políticas PostgreSQL; requiere instalar las migraciones en el Supabase de pruebas. Las políticas y las transacciones se probaron en PostgreSQL local desechable. No se verificó una sesión contra el Supabase remoto.

## 2. Auditoría inicial y correcciones

| Hallazgo verificado | Consecuencia | Corrección |
| --- | --- | --- |
| README anunciaba React 18, una carpeta de backend inexistente y explicaciones locales exactas | La documentación no reflejaba el código | README nuevo con React 19, TanStack Start, SQL en Drizzle y estado real de cada función |
| El adaptador de predicción siempre devolvía desconectado | No había inferencia conectada pese al relato del README | Estado visible; reglas operativas separadas del experimento y del ejemplo visual |
| Demo fijaba precisión 89,4%, recall 91,2%, F1 0,9 y confianza 92 sin evaluación | Podían confundirse con evidencia | Se retiraron esos números de evaluación/confianza; las métricas leen el informe sintético reproducido |
| Script e informe afirmaban SHA-256 aunque los IDs eran secuenciales | Descripción falsa de privacidad | Se identifican como códigos ficticios; el hash del informe es del dataset para reproducibilidad, no de identidades |
| Heurística de desviaciones por importancia global descrita como explicación local | No era una atribución validada ni SHAP | Nombre, límites y documentación corregidos; protección frente a división por cero |
| Campo numérico vacío podía convertirse en cero por coerción | Observaciones ausentes parecían mediciones reales | Validación rechaza vacío, null, booleanos y valores no finitos; formularios nuevos comienzan vacíos |
| CSV auxiliar también convertía celdas numéricas vacías en cero | El importador podía aceptar métricas inexistentes | Rechazo explícito y prueba de regresión |
| Plan normal no propagaba el origen de ejemplo | Riesgo de mezclar datos ficticios con evidencia | Propagación cliente y sello servidor basado en el alumno; la marca de ejemplo no puede borrarse por un docente |
| Fecha de revisión ignoraba cambios en el detalle de la acción | Un cambio material no actualizaba el sello | Sello servidor corregido; la aprobación desde Impact Lab renueva la revisión |
| Agregados de dirección podían describir un solo alumno | Dirección podía inferir resultados individuales | Umbral de cinco alumnos reales y supresión complementaria de desgloses pequeños |
| Inicio sin configuración Cloud podía fallar en autenticación y llamadas públicas | La demo dependía de configuración externa | Detección de configuración, demo independiente y middleware que no exige sesión a las funciones públicas |
| Inicialización de sesión y cambio de identidad podían dejar una caché anterior o una espera sin fin | Datos visuales obsoletos o pantalla bloqueada tras error | Control de eventos, limpieza de caché entre identidades y manejo de fallo de lectura de sesión |
| SSR compartía una instancia mutable de idioma; preferencia local podía diferir del HTML | Errores de hidratación y riesgo de mezcla entre peticiones | Instancia por petición, idioma del HTML en la primera hidratación y cookie/preferencia alineadas |
| Página de contingencia de error solo estaba en inglés | Fallo de traducción en errores del servidor | Usa las traducciones es/en/fr según cabecera/cookie, con escape de HTML |
| Paquete comercial anunciaba sincronización offline inexistente | Sobrepromesa durante contratación | Se presenta material de apoyo como servicio acordado y se explica lo disponible hoy |
| Nombre de producto de Stripe se tomaba siempre del español | Compra incoherente con el idioma elegido | Selección del nombre desde el idioma del checkout |
| Vite 8.1.5 y Zod 3 tenían avisos de seguridad altos | Dependencias con riesgos conocidos según npm audit | Vite 8.3.5 y Zod 4.6.7, con adaptación y pruebas; lockfiles actualizados |
| Análisis inicial tenía 1.332 errores de formato | El análisis estático no estaba limpio | Corrección automática de formato; sin errores al terminar |
| Cabecera y navegación ocupaban demasiado espacio en móvil | Menos espacio para el trabajo docente | Menú móvil desplegable; navegación completa en escritorio |
| Faltaban contraste y foco uniformes | Lectura y navegación menos claras | Paleta caramelo/espresso con tonos oscuros, foco visible, enlace al contenido y movimiento reducido |

Las 72 pruebas locales originales y la compilación inicial pasaban. Los 33 casos de integración externa ya se omitían por falta de fixtures/credenciales. No se interpretaron como aprobados.

## 3. Implementación de Impact Lab

### Flujo docente

El contexto muestra asistencia, nota, entregas, conectividad y observaciones disponibles para el docente autorizado. No se rellenan faltas consecutivas, formación docente u otros campos ausentes para simular una inferencia.

El catálogo utiliza los cuatro tipos de apoyo ya existentes. Cada opción describe objetivo, recursos, duración orientativa e indicadores. El docente combina o retira opciones, personaliza objetivo/notas y elige duración y prioridad.

Los controles de escenarios exploran metas, sin asociar un porcentaje de eficacia inventado a cada intervención. Esas metas nunca se envían al guardado del plan ni al registro de seguimiento. Cambiar las metas no modifica la ficha del alumno.

La aprobación exige revisión explícita. Una edición material desmarca la revisión en la interfaz. El servidor vuelve a comprobar rol, centro, propiedad y confirmación. Puede vincularse un plan existente; en ese caso no se duplica.

### Persistencia

- `intervention_plans`: continúa siendo la entidad de intervención. Se añade el estado `descartado`.
- `impact_studies`: una fila por plan, apoyos seleccionados, duración y línea de base copiada por el servidor desde las métricas disponibles.
- `impact_followups`: observaciones añadidas por el docente, fecha UTC, métricas y notas. Una fila por plan y día. No hay edición o borrado directo de evidencia por el cliente.
- `edu_save_impact_plan`: crea o actualiza el plan y vincula la evaluación de forma atómica. Reutilizar el plan conserva su primera línea de base.
- `edu_record_impact`: rechaza fechas futuras, anteriores a la línea de base, planes descartados y usuarios sin propiedad.
- `edu_impact_summary`: selecciona una sola evaluación reciente por alumno y publica exclusivamente cohortes permitidas.

Los seguimientos no actualizan automáticamente las métricas principales del alumno. Esta separación evita convertir el registro de una evaluación en una sobrescritura de otros datos del centro. El docente explica el período de observación en las notas.

La fecha de línea de base es la de actualización del registro de métricas, no una fecha de intervención reconstruida artificialmente. Las observaciones pueden registrarse durante el plan; su duración prevista no equivale al tiempo transcurrido ni a un resultado garantizado.

### Aprendizaje institucional

Dirección no obtiene filas individuales, notas ni identificadores de evaluación. El agregado agrupa por apoyo principal, cuenta alumnos distintos, excluye ejemplos y planes descartados y exige cinco alumnos. Se conserva la combinación en el diseño, pero el agregado no aísla el efecto de sus componentes.

El panel anterior de dirección también queda protegido: si el centro no reúne cinco alumnos reales se retienen sus indicadores. Si un desglose contiene grupos pequeños se oculta el desglose completo para evitar deducir el grupo oculto por diferencia con el total. Ciertos recuentos y la retención se suprimen cuando revelarían una categoría pequeña.

Son medidas de reducción de exposición. Repetir consultas a lo largo del tiempo, información externa o notas con información identificativa pueden plantear riesgos adicionales. No se afirma anonimización irreversible, privacidad diferencial ni certificación RGPD.

## 4. Mejoras visuales y accesibilidad

Se mantiene la identidad caramelo y la mascota existente. Se ajustan contraste, fondo, tarjetas, tipografía, espacios y títulos. Los niveles de alerta tienen texto además de color. La navegación móvil se despliega a demanda y conserva las funciones del escritorio.

Los controles tienen etiquetas, foco visible y tamaños utilizables. Hay un enlace para saltar al contenido. Los gráficos de seguimiento usan ejes separados para porcentajes y notas, junto a una tabla de los mismos valores. Las tablas anchas desplazan dentro de su contenedor. Se respeta la preferencia de movimiento reducido.

Se han inspeccionado capturas de escritorio y móvil. Los recorridos de navegador verifican ausencia de desbordamiento horizontal del documento en la demo. No se ha realizado una auditoría exhaustiva con lector de pantalla, todos los dispositivos físicos ni todos los criterios WCAG.

## 5. IA: evidencia y límites

Se ejecutó `python model/train_model.py`. El experimento usa 600 filas sintéticas, distribuidas en clases 96/232/272, con 480 de entrenamiento, 120 de prueba y cinco particiones de validación cruzada dentro de entrenamiento. El identificador no entra como característica.

| Medida ejecutada | Valor | Alcance |
| --- | ---: | --- |
| Exactitud en prueba | 0,8083 | Dataset sintético |
| Recall ponderado en prueba | 0,8083 | Dataset sintético |
| F1 ponderado en prueba | 0,8057 | Dataset sintético |
| F1 macro en prueba | 0,7809 | Dataset sintético |
| F1 ponderado de entrenamiento | 0,9771 | Indica una brecha frente a prueba |
| F1 ponderado de validación cruzada | 0,7550 | Selección de parámetros en entrenamiento |
| F1 ponderado del clasificador mayoritario | 0,2793 | Comparación básica sintética |

La brecha entre entrenamiento y prueba indica riesgo de sobreajuste. Las etiquetas proceden de una fórmula con ruido y no de resultados reales de abandono: superar la comparación básica no valida utilidad educativa. No hay validación externa por escuela, temporal, de equidad ni de calibración. Los valores no permiten prometer precisión en escuelas.

El informe incluye matriz de confusión, resultados por clase, parámetros, versiones y hash del dataset. Los requisitos Python están fijados a las versiones del entrenamiento. No se presenta la importancia global por impureza como una explicación causal o SHAP. El servicio de inferencia sigue desconectado; faltan además variables requeridas por el experimento en el contrato actual del alumno.

## 6. Contratación y sostenibilidad

Se conservan los paquetes y el banco solidario. La lógica SQL fija importes y capacidad, separa inventarios sandbox/live y activa una sola licencia cuando el servidor aporta evidencia verificada de la sesión. Una confirmación privada se encola en la misma transacción. La reentrega utiliza claves de idempotencia y un trabajo autenticado de recuperación.

Se comprobó la lógica SQL con reservas y licencias **ficticias de una base local**, no contra Stripe. Una activación local en estos tests no es una compra ni evidencia de un pago externo. Las pruebas existentes de confirmaciones usan dobles controlados para la entrega; tampoco envían correo.

Los importes son una hipótesis comercial de contratos de servicio: 490/1.850/4.500 € por paquete. La rentabilidad no se ha medido. Se necesita contrastar con centros y financiadores el coste de infraestructura, formación, soporte y renovación. No existe una suscripción recurrente implementada ni provisión automática de centros por licencia. El material para baja conectividad puede entregarse como servicio humano; no hay sincronización offline de la aplicación.

## 7. Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| `npm run typecheck` | Aprobado; incluye aplicación, configuración Playwright y tests de navegador |
| `npm run lint` | 0 errores; 7 avisos de Fast Refresh en exportaciones compartidas de componentes/contextos |
| `npm test` | 114 aprobadas, 33 omitidas, 0 fallidas; 13 archivos aprobados y 5 externos omitidos |
| SQL real local mediante PGlite 0.5.14 | 14 pruebas dentro de Vitest, con toda la cadena de migraciones y roles ficticios |
| `npm run build` (destino original Cloudflare) | Compilación aprobada durante la revisión |
| `NITRO_PRESET=node-server ... npm run build` | Compilación final aprobada; genera servidor Node |
| Playwright sobre la compilación Node | 15 pruebas aprobadas: escritorio, tableta y móvil; es/en/fr; rutas y aislamiento SSR |
| `python model/train_model.py` | Ejecutado; artefactos e informe regenerados |
| `python -m unittest discover -s model -p 'test_*.py' -v` | 2 pruebas aprobadas |
| `npm audit --omit=dev --json` | 0 vulnerabilidades reportadas en dependencias de producción |
| `npm audit --json` | 18 avisos moderados de desarrollo; 0 altos y 0 críticos en el árbol analizado |
| Inspección visual | Capturas de escritorio y móvil revisadas; menú móvil corregido |

Las 14 pruebas SQL incluyen propiedad y roles, bloqueo de escrituras directas, revisión obligatoria, línea de base inmutable, fechas, duplicados, exclusión de ejemplos, umbral institucional, reserva de capacidad, importes, idempotencia, activación y outbox. Auth y Realtime son servicios simulados alrededor de PostgreSQL; la entrega de sus notificaciones no se verifica con ellos.

Playwright comprueba que la demo no solicita `/auth/v1` ni `/rest/v1`, que las metas no se convierten en observaciones, que recargar borra la demo, que el menú móvil funciona y que las rutas privadas conservan el destino de vuelta al login. Se ejecutaron también peticiones SSR simultáneas con distintos idiomas. Son pruebas de la demo y de las barreras públicas, no un test end-to-end del centro privado remoto.

Se entregan registros de las comprobaciones en `docs/verification/`. Las advertencias de npm sobre el proxy del entorno y los avisos de Fast Refresh no se han contado como fallos. La descarga convencional de Chromium falló; para la ejecución se utilizó un Chromium 153 local, sin añadir ese binario ni su paquete al producto.

## 8. Pendientes y causas

| Pendiente | Causa / siguiente paso concreto |
| --- | --- |
| Aplicar migraciones en Supabase remoto y probar una sesión docente/directora real | No había credenciales ni un entorno desechable remoto autorizado. Configurar staging, instalar 0009/0010 y repetir fixtures externos |
| Compra completa en Stripe de pruebas, impuestos y retorno | No se disponía de clave de Stripe de pruebas ni configuración fiscal verificable |
| Confirmación de correo entregada y trabajo periódico | Faltaban credenciales Resend/gateway, remitente y planificador externo |
| Asignación real del banco solidario | Requiere beneficiarios designados y un proceso humano; no se inventaron centros |
| Permisos del despliegue actual | La política local probada no demuestra el estado del servidor publicado. Revisar migraciones y grants en staging |
| Validación del modelo con datos educativos apropiados | Solo hay datos sintéticos y faltan variables del modelo en la ficha actual; necesita datos autorizados, evaluación externa y estudio de sesgos/calibración |
| Atribución causal de intervenciones | El registro antes/después es descriptivo; no hay diseño de evaluación causal ni modelo de tratamiento validado |
| Sincronización offline y conectores con sistemas escolares | No están implementados y se han retirado las promesas que los daban por disponibles |
| Provisión de cuentas a partir de una licencia | No existe asociación automática entre licencia, escuela y permisos; los contratos de servicio no son un control de acceso a cuentas |
| Avisos moderados en herramientas de desarrollo | Principalmente árbol de ESLint/minimatch y Drizzle/esbuild. Una resolución forzada sugería cambios incompatibles; no se aplicaron actualizaciones destructivas ni se presentaron como resueltos |
| Carga y accesibilidad completas | No se han ejecutado benchmarks de volumen ni una certificación de accesibilidad; la carga paginada y los índices no sustituyen mediciones |
| Revisión de protección de datos para un centro real | Seudónimos y RLS no certifican cumplimiento. Definir finalidad, permisos, minimización, conservación y revisión de notas con el centro |

## 9. Valoración para el jurado

Valoración cualitativa según los criterios solicitados, no una puntuación oficial ni una garantía de premio.

| Criterio | Fortaleza demostrable | Límite que explicar |
| --- | --- | --- |
| Innovación | Ciclo completo señal → apoyo combinado → decisión → evaluación → aprendizaje | No afirmar simulación causal mediante IA |
| Adecuación al Reto 13 | La escuela aprende de experiencias registradas, además de ver indicadores | Validar utilidad con docentes reales |
| Impacto social | Identifica barreras de conectividad y permite apoyos materiales y familiares | No atribuir una mejora real a los ejemplos de la demo |
| Utilidad docente | Datos, decisiones y seguimiento vinculados al mismo plan | La participación es un indicador parcial de tareas |
| Viabilidad técnica | Código compilado, pruebas de interfaz y PostgreSQL local | Confirmar integraciones con el entorno de staging |
| Implantación | Demo sin cuenta, tres idiomas y registro manual | Importaciones y conectores institucionales requieren trabajo adicional |
| Escalabilidad | RLS por propiedad/centro, índices y consultas paginadas | No se ha medido capacidad operativa a gran escala |
| Sostenibilidad | Financiador institucional con beneficiarios directos o solidarios | Contrastar costes, precios y prestación de servicios |
| Demostración | Recorrido preparado, reproducible y transparente en dos minutos | Distinguir datos ficticios de actividad externa |

### Las cinco características que conviene enseñar

1. **Un ciclo de apoyo completo:** pasar de una alerta a un plan revisado y a un seguimiento que conserva el punto de partida.
2. **Apoyos combinados y contexto:** una dificultad de conectividad no se confunde automáticamente con falta de esfuerzo o de capacidad.
3. **Transparencia de las cifras:** reglas, entrenamiento sintético, metas hipotéticas y observaciones quedan identificados y separados.
4. **Aprendizaje compartido con límites de privacidad:** dirección recibe experiencias agregadas; los ejemplos y grupos pequeños se excluyen.
5. **Acceso financiado por instituciones:** paquetes y banco solidario permiten plantear quién paga y quién recibe apoyo sin convertir cada escuela vulnerable en un cliente individual.

El guion y la secuencia exacta de clics están en `docs/DEMO_2_MINUTOS.md`.

## Referencias técnicas contrastadas

- Supabase, RLS y políticas: https://supabase.com/docs/guides/database/postgres/row-level-security
- TanStack Router, rutas basadas en archivos: https://tanstack.com/router/latest/docs/routing/file-based-routing
- scikit-learn, importancia de características en bosques y sus límites: https://scikit-learn.org/stable/auto_examples/ensemble/plot_forest_importances.html

Estas referencias explican mecanismos generales. La evidencia de esta entrega son el código y las pruebas incluidas; ninguna referencia valida por sí sola el efecto educativo del producto.
