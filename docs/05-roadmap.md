# Roadmap post-MVP

Qué haría a continuación, en qué orden y por qué. Ordenado por valor sobre coste, no por
apetencia técnica.

Un roadmap sin criterio de priorización es una lista de deseos. El criterio aquí es el
mismo que definió el alcance: **¿mueve la hipótesis de negocio?** — que existe demanda
de un catálogo consolidado y que una parte medible de los visitantes volverá.

---

## 1. Funcionalidades

### Prioridad alta — mueven la retención directamente

**1. Alertas de lanzamiento (T-24 h y T-1 h).**
Es la evolución natural del panel de seguimiento y, con diferencia, lo que más
retención compra: convierte una aplicación que hay que recordar visitar en una que
avisa. Sin esto, "seguir" una misión sólo tiene valor si el usuario vuelve por su
cuenta.
*Coste:* infraestructura de envío (email o web-push), gestión de consentimiento, y una
cola con reintentos. Fuera del MVP por eso, no por dificultad.
*Detalle que no se puede pasar por alto:* sólo tienen sentido para fechas con precisión
de hora. Avisar "tu misión despega en 24 h" cuando la fuente sólo conoce el mes sería
exactamente el tipo de mentira que el resto del producto evita.

**2. Exportar misiones seguidas a calendario (.ics).**
Barato y muy útil. Un fichero `.ics` generado en el servidor mete las misiones seguidas
en el calendario del usuario, que es donde ya mira. Es la forma más barata de
retención: no hay que construir el canal, se usa el que ya existe.
*Mismo cuidado con la precisión:* un evento de calendario para una fecha con precisión
de trimestre debe ser de día completo y decirlo en el título.

**3. Segunda fuente de lanzamientos (Launch Library 2).**
Deja de ser "tracker de SpaceX" y pasa a ser "tracker de lanzamientos", que es lo que el
caso de negocio pedía de verdad. La arquitectura ya está preparada: el modelo de dominio
es agnóstico de proveedor y la capa anticorrupción aísla los DTO, así que es **añadir un
adaptador, no reescribir el dominio**.
*Ganancia lateral:* el eje de países se vuelve mucho más rico, porque entran despegues
desde Kourou, Baikonur, Tanegashima y Sriharikota. Hoy el 100 % de los lanzamientos sale
de territorio estadounidense, lo que limita mucho la vista de país.

### Prioridad media

4. **Comparador de cohetes** con los datos de `/rockets`, que ya se sincronizan y hoy se
   usan sólo para mostrar un nombre.
5. **OAuth (Google/GitHub)** junto al email y contraseña. Reduce fricción de registro,
   que es la métrica de activación.
6. **Historial de reutilización de boosters** — es lo que hace singular a SpaceX y hoy no
   se aprovecha (`cores`, aterrizajes, número de vuelos por núcleo).
7. **i18n completo ES/EN.** El copy ya está centralizado, así que es traducir y añadir el
   selector, no refactorizar.

### Prioridad baja

8. Panel de operador (forzar sincronización, ver salud de las fuentes).
9. PWA con caché offline.
10. Comentarios o feed social por misión.

---

## 2. Deuda técnica consciente

Todo lo de esta lista se decidió a sabiendas. Ninguna es una sorpresa.

| Deuda | Por qué se asumió | Cuándo pagarla |
|---|---|---|
| **Sesión sin refresh token** | Rotación, revocación y almacenamiento para un MVP de riesgo bajo | Antes de abrir a usuarios reales. Es la primera de la lista |
| **Paginación por offset** | A esta escala el coste es irrelevante y hace falta el total y el salto a página | Cuando el catálogo crezca un par de órdenes de magnitud. La vía es keyset sobre `(dateUtc, id)` |
| **Sin E2E (Playwright)** | Coste de mantenimiento alto para un flujo que aún cambiará | Cuando el flujo de seguimiento se estabilice. Empezar por: entrar como demo → seguir → aparece en el panel |
| **`ts-node` sólo para el seed** | `tsx` no emite metadatos de decorador y rompe la DI de Nest | Se resuelve solo migrando a SWC, que sí los emite |
| **Ratio de sincronización única** | Separar próximos de históricos no ahorra peticiones con esta API | Cuando la fuente permita pedir sólo cambios |
| **Sin observabilidad estructurada** | El logger de Nest y la bitácora de sincronización bastan para un MVP | Al desplegar: logs en JSON, trazas y una alerta cuando el circuito se abra |
| **Un único fichero de tokens de diseño** | No hay suficientes componentes para justificar más estructura | Cuando el equipo crezca: documentar el sistema con Storybook |

---

## 3. Rendimiento

Por orden de cuándo empezaría a doler:

1. **Cabeceras de caché HTTP (`ETag`, `Cache-Control`)** en los endpoints de catálogo.
   Están diseñadas (ADR-005) pero no implementadas: es lo más barato que queda.
2. **Paginación por keyset** (arriba).
3. **Índice de texto completo** (FTS5 de SQLite) si la búsqueda por nombre se queda
   corta. Hoy un `LIKE` sobre columna normalizada e indexada es más que suficiente.
4. **Sincronización incremental** en lugar de recomponer la proyección
   `launch_countries` entera. Con 16 lanzamientos es instantáneo; con 20.000 no.
5. **Virtualización de listas**, sólo si se adopta scroll infinito. Con páginas de 20
   elementos no hay nada que virtualizar.

---

## 4. Seguridad

Por orden de gravedad si el proyecto saliera a producción mañana:

1. **Rotar `JWT_SECRET`** y sacarlo de la configuración por defecto. El README ya explica
   cómo generarlo; el despliegue debe **fallar** si no está definido, en lugar de caer
   al valor de desarrollo.
2. **Refresh tokens con rotación y revocación**, para poder cerrar sesiones comprometidas.
3. **Cabeceras de seguridad** (`helmet`): CSP, `X-Content-Type-Options`, HSTS.
4. **Verificación de email** en el registro. Hoy cualquier email es válido sin comprobar.
5. **Política de contraseñas** más allá del mínimo de 8 caracteres: contraste contra
   listas de filtradas conocidas.
6. **Auditoría de accesos** a los endpoints de autenticación, para detectar fuerza bruta
   distribuida que el límite por IP no atrapa.
7. **Revisión del `alt` de imágenes de terceros**: hoy se muestra texto que viene de una
   API externa. No es ejecutable, pero es contenido no controlado en el DOM.

---

## 5. Escalabilidad

Los tres umbrales donde la arquitectura actual deja de servir, y qué hacer en cada uno:

| Umbral | Qué se rompe | Movimiento |
|---|---|---|
| **Más de una instancia de API** | SQLite es un fichero local; dos instancias divergen | Migrar a PostgreSQL. Con Prisma es cambiar el `provider` y regenerar migraciones — el proyecto no queda encerrado |
| **Sincronización más larga que su ventana** | Los ciclos se solapan (hoy hay guarda, pero degrada) | Sacar la sincronización a un worker con cola (BullMQ) |
| **Catálogo de cientos de miles de lanzamientos** | La proyección completa y el offset dejan de ser gratis | Sincronización incremental + paginación por keyset |

**Docker** entra aquí, no en la instalación local: como imagen de despliegue estandariza
el entorno de producción y simplifica el pipeline. Mantenerlo fuera del `README` de
instalación sigue siendo correcto — exigirlo para desarrollar añadiría un runtime que el
proyecto no necesita.

---

## 6. Si sólo hubiera tiempo para tres cosas

1. **Alertas de lanzamiento.** Es lo único de esta lista que cambia la naturaleza del
   producto en lugar de mejorarlo.
2. **Refresh tokens.** Es la deuda que impide abrir a usuarios reales con tranquilidad.
3. **Launch Library 2 como segunda fuente.** Es lo que hace que el producto responda al
   caso de negocio completo y no sólo a su fuente obligatoria.
