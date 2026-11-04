# EduPulse Intelligence — Fase 1 (solo frontend, sin Lovable Cloud)

Mascota: un camello amigable ("Pulsi"), estilo ilustración tipo storybook, coherente con el DESIGN.md (blanco papel, verde intenso, azul acento, botones "pegatina" con borde grueso y tipografía redondeada).

## Qué se construye
1. **Landing (/)**: eslogan "Anticipamos desafíos. Impulsamos oportunidades.", camello mascota, flujo del producto (ingesta → predicción → intervención → seguimiento), principios éticos y CTA a la demo.
2. **Panel (/panel)**: indicadores clave del centro, semáforo de atención por grupo, gráficos de evolución (asistencia, rendimiento) con datos de ejemplo claramente etiquetados como "datos demo".
3. **Carga de datos (/datos)**: subir un CSV, validación en el navegador (columnas obligatorias, errores por fila) y vista previa. Los datos viven en la sesión (sin servidor).
4. **Alertas (/alertas)**: lista de alertas por reglas transparentes (no IA simulada), con filtros y el motivo de cada alerta.
5. **Predicciones (/predicciones)**: pantalla preparada para el futuro modelo; muestra estado "modelo no conectado" honestamente, sin resultados inventados.
6. **Planes de intervención (/planes)**: crear, editar y seguir planes con revisión humana (guardado local en el navegador por ahora).
7. **Ética y transparencia (/etica)**: uso responsable de datos, la decisión final es siempre del profesional.

La mascota camello aparece en la landing, estados vacíos, carga de datos y pantalla de "modelo no conectado".

## Detalles técnicos
- TanStack Router (no React Router), TanStack Query, Zod, React Hook Form, Recharts, shadcn/ui, Lucide, framer-motion.
- Capa de servicios con interfaces + adaptadores (adaptador local/CSV ahora; adaptador Cloud y adaptador FastAPI de inferencia más adelante) para no acoplar la UI.
- Tokens del DESIGN.md en `src/styles.css` (oklch), fuente Nunito vía `<link>`.
- Lógica de reglas de alerta y validación CSV con tests unitarios.
- Ilustraciones del camello generadas (varias poses).
- Sin autenticación ni base de datos en esta fase.
