# Fase 1 — Análisis y definición del alcance del MVP

> Estado: propuesta para validación. Ninguna línea de código de producto se escribe
> antes de cerrar este documento.

## 1. La hipótesis que el MVP tiene que validar

El caso de negocio pide "consultar información sobre lanzamientos y hacer seguimiento
a las misiones de interés", para "usuarios de diferentes países". Traducido a una
hipótesis falsable:

> **H1 — Existe demanda de un catálogo consolidado de lanzamientos espaciales, y una
> parte medible de esos visitantes quiere volver: se registrarán y marcarán misiones
> para seguirlas.**

De ahí salen las dos únicas métricas que el MVP debe poder producir:

- **Activación**: % de visitantes anónimos que se registran.
- **Retención / intención de seguimiento**: nº de misiones seguidas por usuario y
  % de usuarios que vuelven a la vista "Mis misiones".

Todo lo que no contribuya a mover o medir esas dos cosas es backlog. Ese es el filtro
que uso abajo para separar must-have de nice-to-have.

## 2. El problema no obvio: cómo se cruzan las dos APIs

Este es el punto donde el caso se puede resolver bien o se puede resolver de adorno,
y conviene decidirlo explícitamente antes de arquitectura.

**La SpaceX API v4 no tiene un campo de país en los lanzamientos.** Ni en `launches`,
ni en `launchpads` (que expone `locality`, `region`, `timezone`, `latitude`,
`longitude` — "Florida", "California", "Marshall Islands" — pero **ningún código ISO**).
Es decir: el join entre "lanzamientos" y "países" **no viene dado, hay que construirlo**.

La salida fácil sería poner una bandera decorativa en algún lado y declarar
"integradas las dos APIs". Rechazo esa opción. Propongo dos puentes reales, ambos con
semántica de negocio:

| Puente | Origen del dato | Fiabilidad | Qué le da al usuario |
|---|---|---|---|
| **A. País del sitio de lanzamiento** | Mapeo curado `launchpad.id → ISO-3166-1 alpha-2`. Son ~6 pads, conjunto cerrado y estable. | Alta (curado, versionado en el repo, testeado) | "Lanzamientos desde suelo de X" |
| **B. Nacionalidad de la carga útil** | `payloads[].nationalities[]` de SpaceX v4 → resolución por nombre contra REST Countries | Media (texto libre, requiere normalización y un bucket de no resueltos) | "Lanzamientos que llevaron una carga de mi país" |

El puente B es el que hace que la app tenga sentido para "usuarios de diferentes
países": un usuario en Alemania no tiene sitios de lanzamiento de SpaceX, pero sí
tiene satélites suyos volando. Es también el que genera el trabajo técnico honesto:
`nationalities` es texto libre y sucio. Casos reales que hay que resolver:
`"European Union"` (no es un país), `"Isle of Man"`, `"Republic of Korea"` vs
`"South Korea"`, entradas multi-país, entradas vacías.

**Decisión de diseño**: la resolución de nacionalidad → país es una función de dominio
pura, con tabla de alias explícita, y **todo lo que no resuelve va a un bucket
`unresolved` visible**, nunca se descarta en silencio ni se adivina. La cobertura de
resolución es un dato que la propia app expone (métrica de calidad de datos).

REST Countries v3.1 aporta entonces: nombre común y oficial, `cca2`/`cca3`, bandera
(SVG + PNG), región/subregión, capital y `latlng`. Se consume **con `?fields=`
obligatorio** (v3.1 rechaza `/all` sin `fields`), lo que además reduce payload.

## 3. Perfiles de usuario

| Perfil | Puede | No puede |
|---|---|---|
| **Visitante anónimo** | Explorar catálogo completo, buscar, filtrar, ver detalle de lanzamiento, explorar países, ver estadísticas | Seguir misiones, ver "Mis misiones" |
| **Usuario registrado** | Todo lo anterior + seguir/dejar de seguir misiones, ver su panel de seguimiento, fijar su país (que personaliza la app) | Administrar el catálogo |
| *(Operador — fuera de alcance MVP)* | *Forzar re-sincronización, ver salud de las fuentes* | — |

**El catálogo es público y navegable sin registro.** Poner un muro de registro delante
del contenido mataría la métrica de activación: no se puede medir qué % se registra si
nadie puede ver antes qué está comprando. El registro se pide **solo en el momento en
que el usuario intenta seguir una misión** — que es exactamente el evento que H1 quiere
medir.

El **país del usuario** vive en su perfil y no es decorativo: determina la zona horaria
de presentación por defecto y alimenta una sección "relevante para ti". Es lo que
convierte a REST Countries en producto en lugar de en adorno.

## 4. Alcance — Must-have (MVP)

| # | Funcionalidad | Por qué es must-have |
|---|---|---|
| M1 | **Catálogo de lanzamientos** paginado, con búsqueda por nombre de misión y filtros (próximo/pasado, éxito/fallo, cohete, año, país) y orden por fecha | Es el producto. Sin esto no hay nada que validar |
| M2 | **Detalle de lanzamiento**: misión, cohete, sitio + país, cargas útiles y sus nacionalidades, resultado o motivo de fallo, enlaces oficiales, parche | Es la unidad de decisión: aquí el usuario decide si le interesa seguirla |
| M3 | **Manejo honesto de fechas**: respetar `date_precision` y `tbd`/`net`. Si la precisión es `month`, se muestra "Febrero 2026 (fecha por confirmar)", nunca una hora falsa. Render en zona horaria del usuario | Un tracker que miente con las fechas no sirve para seguir nada. Es el detalle que separa esto de un CRUD |
| M4 | **Registro / login** (email + contraseña, JWT) con país de perfil | Habilita y mide H1 |
| M5 | **Seguir / dejar de seguir** una misión, persistido en servidor | Es la acción central del caso de negocio |
| M6 | **Panel "Mis misiones"**: seguidas ordenadas por proximidad, con cuenta atrás para la siguiente y separación entre pendientes y ya lanzadas | Es el motivo para volver. Sin esto, seguir una misión no tiene retorno |
| M7 | **Directorio de países + vista de país**: bandera y datos de REST Countries, lanzamientos desde su suelo y lanzamientos con carga suya | Es la integración real de la 2ª fuente |
| M8 | **Sincronización + caché en BD propia**: la app sirve siempre desde su modelo de dominio normalizado, nunca proxea en vivo al usuario | Es la respuesta al riesgo R1/R2 y lo que hace la app usable con las fuentes caídas |
| M9 | **Degradación explícita**: si la fuente externa falla, se sirve lo cacheado con indicador de antigüedad ("datos de hace 3 h"), no un error en blanco | Requisito explícito del enunciado y lo más visible en una demo |

## 5. Alcance — Nice-to-have (backlog priorizado)

Orden = valor/coste, no capricho.

1. **Alertas de lanzamiento** (email o web-push a T-24 h / T-1 h) — es la evolución natural de M6 y probablemente la funcionalidad que más retención compra. Fuera de MVP porque exige infraestructura de envío y gestión de consentimiento.
2. **Exportar misiones seguidas a calendario (.ics)** — barato y muy útil; candidato nº 1 a entrar en Fase 5.
3. Comparador de cohetes (Falcon 9 vs Falcon Heavy vs Starship) con datos de `/rockets`.
4. Catálogo de cápsulas, cores y reutilización (historial de aterrizajes de booster).
5. OAuth (Google/GitHub) además de email+contraseña.
6. i18n completo ES/EN (el MVP fija un idioma, ver S8).
7. Panel de operador: estado de las fuentes, última sync, cobertura de resolución de países, re-sync manual.
8. Segunda fuente de lanzamientos no-SpaceX (Launch Library 2) para dejar de ser "tracker de SpaceX" y ser "tracker de lanzamientos".
9. PWA / offline.
10. Feed social o comentarios por misión.

## 6. Supuestos

Cada supuesto es una decisión que el caso no especifica; si alguno es falso, se ajusta
antes de Fase 2.

| # | Supuesto | Justificación |
|---|---|---|
| S1 | El catálogo se consulta **sin registro**; solo seguir misiones requiere cuenta | Sin esto no hay embudo de activación medible (§3) |
| S2 | Autenticación **propia, email + contraseña con hash Argon2id, sesión por JWT** de vida corta | Es el mínimo que permite que el seguimiento sea portable entre dispositivos. Un "favorito" en `localStorage` no valida retención: se pierde al cambiar de navegador y no se puede medir por usuario |
| S3 | Los datos externos se **replican en BD propia**; el usuario nunca golpea SpaceX/REST Countries en su request | Aísla latencia y caídas de terceros, permite filtrar/ordenar/paginar en SQL en vez de en memoria, y hace la app demostrable sin red |
| S4 | **Sincronización programada**: lanzamientos próximos cada 15 min, lanzamientos pasados cada 24 h, países cada 30 días (cambian casi nunca), más un *sync* de arranque si la BD está vacía | Los datos que cambian rápido son los futuros; re-descargar 200+ lanzamientos históricos cada cuarto de hora es desperdicio puro |
| S5 | El repositorio incluye un **seed de fixtures** capturado de ambas APIs | Garantiza que el evaluador vea la app con datos aunque esté sin red, tras un firewall corporativo o con las fuentes caídas. En este entorno de desarrollo ambas APIs están bloqueadas por política de red, así que además es la única forma de trabajar aquí |
| S6 | El único proveedor de lanzamientos del MVP es **SpaceX v4** | El caso lo fija como mínimo. Añadir fuentes antes de tener el modelo de dominio sólido es la vía rápida a un modelo que no encaja con ninguna |
| S7 | **Almacenamiento en UTC, presentación en la zona del usuario** (detectada del navegador, con el país de perfil como respaldo) | "Usuarios de diferentes países" implica que la hora local importa. Guardar en local es un bug esperando su turno |
| S8 | **UI en español**, con textos centralizados en un módulo de copy para no bloquear i18n futuro | El interlocutor y la documentación son en español. No monto infraestructura de i18n para un idioma, pero no disperso strings por los componentes |
| S9 | Escala objetivo del MVP: **decenas de usuarios concurrentes**, ~5-10 k filas | Es un prototipo de validación. Justifica SQLite y descarta complejidad que solo paga a otra escala |
| S10 | **Sin datos personales más allá de email y país**; sin pagos, sin subida de ficheros | Reduce superficie legal (RGPD) y de seguridad al mínimo |
| S11 | El **catálogo es de solo lectura** para todo usuario; nadie crea ni edita lanzamientos | La fuente de verdad es externa. Permitir edición local crearía divergencia irreconciliable en la siguiente sync |
| S12 | Las **imágenes** (parches, banderas) se enlazan desde su origen, no se rehospedan | Ahorra almacenamiento y complejidad; a cambio se asume el riesgo R7 y se maneja con *fallback* visual |

## 7. Riesgos y huecos del caso de negocio

| # | Riesgo | Impacto | Mitigación en el MVP |
|---|---|---|---|
| R1 | **Rate limiting / bloqueo de las fuentes externas.** SpaceX v4 no documenta límite duro pero puede cortar; REST Countries ha tenido incidentes de disponibilidad y ya exige `?fields=` | Sync fallida, datos que no entran | Sync en servidor (no por usuario), *backoff* exponencial con jitter, límite de concurrencia, timeout agresivo, y `/query` de SpaceX en modo paginado para no pedir todo de golpe |
| R2 | **Fuente caída o lenta** en el momento de la demo | La app parece rota | S3 + M9: se sirve desde BD con indicador de antigüedad. La ruta degradada se prueba explícitamente en tests |
| R3 | **La SpaceX API v4 está en modo mantenimiento**: su dataset de lanzamientos futuros puede estar desactualizado, con "próximos" que ya ocurrieron | Un *tracker* sin futuro que seguir — mata la demo de M6 | No confiar en el flag `upcoming`: derivar el estado comparando `date_utc` con `now`, y reconciliar ambos. Documentar la discrepancia como limitación de la fuente. **A confirmar con red disponible** |
| R4 | **`launchpad` no tiene país** (§2) | El eje "país" no existe si no se construye | Mapeo curado versionado y testeado, conjunto cerrado de ~6 pads |
| R5 | **`payloads[].nationalities` es texto libre**: entidades no-país ("European Union"), sinónimos, multi-valor | Falsos negativos y falsos positivos en la vista de país | Tabla de alias explícita + bucket `unresolved` visible + cobertura como métrica. Nunca adivinar |
| R6 | **Datos incompletos**: `success` es `null` mientras no se lanza, `details` suele venir vacío, algunos lanzamientos no tienen parche, cargas útiles sin masa | Huecos y `undefined` en la UI | Tipado que modela la ausencia (`null` explícito, no `any`), y estados vacíos diseñados por caso, no un "N/D" genérico |
| R7 | **Imágenes de terceros** (parches en `imgur`, banderas en `flagcdn`) que pueden desaparecer o bloquearse | UI rota | `onError` con *placeholder* propio y `alt` correcto. Nunca un icono roto |
| R8 | **Fechas TBD / precisión variable** (`date_precision` ∈ hour…year, `tbd`, `net`) | La app miente al usuario | M3: el nivel de precisión es parte del modelo de dominio y del formateo, no un detalle de presentación |
| R9 | **Sesgo del alcance**: el caso dice "lanzamientos espaciales" pero la fuente obligatoria es solo SpaceX | Expectativa mal calibrada | Nombrarlo en la UI y en el README con honestidad; dejar el modelo de dominio agnóstico de proveedor para admitir una 2ª fuente (backlog nº 8) |
| R10 | **Cuentas de usuario = superficie de seguridad** (credenciales, JWT) | Riesgo real aunque sea MVP | Argon2id, validación de entrada en el borde, rate limit en login/registro, JWT de vida corta, secretos por entorno. Sin "seguridad después" |
| R11 | **Zonas horarias y DST** | Cuentas atrás y agrupaciones por día incorrectas | S7 + una única capa de formateo con `Intl`, testeada con casos límite |

## 8. Lo que queda explícitamente fuera del MVP

Notificaciones, OAuth, comentarios, i18n multi-idioma, panel de administración,
segunda fuente de lanzamientos, PWA/offline, y cualquier escritura sobre el catálogo.
Todo está en §5 con su orden de entrada.

## 9. Definition of Done de la Fase 1

- [x] Hipótesis de negocio formulada y falsable
- [x] Puente real entre las dos fuentes identificado y decidido (§2)
- [x] Perfiles de usuario y regla de acceso definidos
- [x] 9 must-have acotados y justificados contra la hipótesis
- [x] Backlog priorizado por valor/coste
- [x] 12 supuestos documentados con justificación
- [x] 11 riesgos con mitigación concreta asignada al MVP
