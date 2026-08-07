# Fase 2 — Decisiones técnicas (ADR)

Formato: Architecture Decision Record. Cada registro tiene contexto, opciones
consideradas, decisión y consecuencias asumidas — incluidas las malas.

Las decisiones **ADR-000** (stack base) venían dadas como restricción del ejercicio;
se documentan igualmente porque un lector externo necesita entender el porqué.

---

## ADR-000 — Stack base: Node + TypeScript en todo el proyecto

**Estado**: aceptada (restricción de partida)

**Contexto.** Mi stack de dominio profesional real es **PHP/Laravel y C#/.NET**. Esta
es la elección que, a igualdad de tiempo, produciría mi mejor código. Aun así el
proyecto se implementa en Node + TypeScript.

**Decisión.** React + Vite + TypeScript en frontend, Node + TypeScript en backend,
SQLite como base de datos.

**Razonamiento.** El criterio dominante aquí no es "en qué soy más fuerte", sino
**cuánta fricción de instalación soporta quien va a evaluar el repositorio**. React ya
obliga a tener Node instalado; usar Node también en el servidor significa que el
evaluador no instala **ningún otro runtime, SDK ni gestor de paquetes**: nada de PHP +
Composer, nada de .NET SDK, nada de Python. Un único `node`, un único `npm`.

SQLite refuerza lo mismo: es un fichero. No hay servidor que arrancar, ni usuario,
contraseña, puerto o `CREATE DATABASE` que configurar. Elimina el punto de fricción
más común de "clonar y levantar" — y el más común de que alguien abandone antes de ver
la aplicación.

**Consecuencia asumida, dicha sin adornos.** Estoy priorizando conscientemente la
experiencia de instalación del evaluador por encima de demostrar mi stack de mayor
dominio. Es una decisión de producto sobre el propio ejercicio: un proyecto que no
arranca no se evalúa, por bueno que sea el código de dentro.

**Versiones fijadas** (nada abierto):

| Elemento | Versión | Dónde se fija |
|---|---|---|
| Node.js | **22.x LTS** | `.nvmrc` + `engines` en `package.json` + README |
| Gestor de paquetes | **npm** (sin mezclar pnpm/yarn) | `packageManager` + workspaces |
| SpaceX API | **v4** (la v3 está deprecada) | ADR-005 |
| REST Countries API | **v3.1** (la v2 fue descontinuada) | ADR-005 |
| Testing | **Vitest** + Testing Library + Supertest | ADR-010 |

---

## ADR-001 — Backend: NestJS

**Estado**: **confirmada en checkpoint de Fase 2** · **Opciones**: NestJS · Express · Fastify

**Confirmación del checkpoint.** Decisión ratificada con esta justificación: arquitectura
modular con inyección de dependencias, similar en espíritu a Laravel/.NET, más consistente
y profesional de cara a un evaluador, y **sin añadir ninguna dependencia de instalación
adicional** — este último punto es el que cierra el debate, porque el argumento más fuerte
a favor de Express era la ligereza, y NestJS no cuesta un solo paso más de setup
(ADR-008): es una dependencia npm más dentro del mismo `npm install`.

**Contexto.** El enunciado exige "separación real de capas (no todo en un
controlador)". Además el proyecto tiene bastantes preocupaciones transversales reales:
autenticación, validación de entrada, caché, tareas programadas de sincronización,
timeouts y reintentos contra terceros, y mapeo homogéneo de errores.

**Decisión: NestJS.**

**Por qué, frente a Express.** El argumento habitual a favor de Express es "menos
boilerplate para un MVP". Ese argumento se sostiene solo mientras la aplicación no
necesita nada transversal. Aquí necesita: inyección de dependencias (para poder
sustituir los proveedores externos por dobles en tests), validación declarativa,
programación de tareas, guards de autenticación e interceptores de error. Con Express
acabaría **ensamblando a mano una versión peor de lo que Nest ya trae probado**, y la
ventaja de minimalismo se evapora justo cuando el proyecto empieza a importar.

**El argumento decisivo, que es de equipo y no de framework.** Vengo de Laravel y
.NET. NestJS está modelado sobre exactamente esas ideas: módulos, controladores,
servicios, contenedor de inyección de dependencias, decoradores, *pipes* y *guards*
como equivalentes de *middleware* y *form requests*. Para quien mantiene este código
—yo— la curva de aprendizaje de Nest es **más corta** que la de aprender a estructurar
bien un Express desnudo, porque el modelo mental ya está construido. Elegir Express
"porque es más simple" sería optimizar una simplicidad que no es la mía.

**Descartadas.** *Express*: ver arriba. *Fastify*: más rápido, pero comparte con
Express el problema de ensamblaje, y el rendimiento bruto no es la restricción de este
MVP (lo es la latencia de terceros, ADR-005).

**Consecuencia asumida.** Más ficheros y más ceremonia que un Express de 200 líneas, y
un arranque algo más lento. Se acepta: el coste es fijo y pequeño; el beneficio de
estructura crece con el tiempo de vida del proyecto.

---

## ADR-002 — ORM: Prisma 7

**Estado**: **confirmada en checkpoint de Fase 2** · **Opciones**: Prisma 7 · Prisma 6 · TypeORM · Drizzle

**Decisión: Prisma 7 con `@prisma/adapter-better-sqlite3`.**

**Confirmación del checkpoint — Prisma 7 frente a fijar Prisma 6.** El debate abierto era
si pinchar la major anterior por tener documentación pública alineada. Se elige **Prisma 7**
por tres razones: es la versión estable y recomendada actualmente, tiene soporte activo, y
**el cliente ya no lleva motor en Rust por defecto**, lo que lo hace más liviano y reduce
fricción de instalación.

Ese tercer punto no es una suposición, se comprobó en el spike: el cliente generado incluye
un **compilador de consultas en WebAssembly** (`query_compiler_fast_bg.wasm`) y la búsqueda
de binarios nativos en `node_modules` tras instalar **no devolvió ningún motor de Prisma** —
el único `.node` presente era el de `@node-rs/argon2`. Es decir, la arquitectura de driver
adapters de v7 (la misma que obliga al `prisma.config.ts` documentado abajo, y que a primera
vista parecía solo un coste) es justamente lo que elimina la descarga de motor. **El
inconveniente y la ventaja son la misma decisión de diseño de Prisma.**

Contrapartida asumida: la documentación pública y las respuestas de StackOverflow escritas
para v5/v6 **no coinciden** con este repositorio. Se mitiga documentándolo explícitamente
aquí y en el README, que es exactamente para lo que existe este ADR.

**Por qué.**
1. **Tipado end-to-end**, que es lo que hace cumplible el requisito de "nada de `any`".
   El cliente se genera desde el esquema, así que un cambio de modelo rompe en
   compilación, no en producción.
2. **El `schema.prisma` es documentación viva del modelo de dominio.** Para el criterio
   de éxito "un senior externo abre el repo sin contexto y lo entiende", un único
   fichero declarativo con todas las entidades y relaciones vale más que veinte clases
   con decoradores dispersas.
3. **Migraciones fiables y versionadas**, con `migrate deploy` reproducible.

**Descartadas.** *TypeORM*: sería el más familiar viniendo de EF Core y Eloquent
(patrón Active Record, decoradores), y ese es su mejor argumento — pero su tipado es
notablemente más débil y su historial de migraciones y mantenimiento es irregular. Aquí
pesa más la seguridad de tipos que la familiaridad, al revés que en ADR-001, porque el
requisito explícito de tipado estricto es del enunciado. *Drizzle*: excelente y muy
ligero, pero su ecosistema y documentación son todavía menores; para código que "debe
mantener un equipo durante años", Prisma tiene más superficie de conocimiento común.

**Hallazgos verificados en un spike, no supuestos** (Prisma 7.9.1, Node 22.22.2):

- Instalación de `prisma` + `@prisma/client` + `@node-rs/argon2`: **18,5 s**, sin
  compilación nativa.
- **Prisma 7 rompe con todos los tutoriales de v5/v6**: la `url` del datasource ya no
  puede estar en `schema.prisma`, va en un `prisma.config.ts`, y `PrismaClient` exige
  ahora un *driver adapter* explícito. Se verificó el ciclo completo
  (`migrate` → `generate` → *insert* → *query*) funcionando.
  Por eso este ADR existe: un lector que busque documentación de Prisma encontrará
  instrucciones que **no** coinciden con este repositorio si no se le avisa.
  *Efecto lateral positivo*: sacar la URL del esquema es mejor higiene de secretos.
- **SQLite no soporta `enum` en Prisma** → los enumerados del dominio se modelan como
  `String` en la BD y como *union types* de TypeScript en el dominio, con la conversión
  validada en un único punto.
- **La búsqueda LIKE de SQLite es insensible a mayúsculas en ASCII pero sensible a
  acentos**: `"mision"` **no** encuentra `"Misión"`. Verificado. Consecuencia de diseño:
  cada entidad buscable guarda una **columna normalizada** (minúsculas, sin
  diacríticos) que es contra la que se busca. Deja de ser una optimización y pasa a ser
  un requisito funcional de M1.

---

## ADR-003 — Frontend: estado servidor, estado cliente, URL y routing

**Estado**: aceptada

**Decisión.** Cuatro tipos de estado, cuatro herramientas distintas, deliberadamente:

| Tipo de estado | Herramienta | Por qué |
|---|---|---|
| **Estado de servidor** (lanzamientos, países) | **TanStack Query v5** | Caché, deduplicación, reintentos, *stale-while-revalidate* y estados de carga/error como ciudadanos de primera. Además su `dataUpdatedAt` da **gratis** el indicador de antigüedad que exige M9 |
| **Filtros, búsqueda, paginación** | **La URL** (`useSearchParams`) | Decisión de producto, no técnica: hace que una vista filtrada sea **compartible y marcable**, que el botón "atrás" funcione, y elimina de raíz la clase de bugs de sincronizar estado con navegación |
| **Sesión de usuario** | **React Context** + reducer | Es *un* objeto. Añadir una librería de estado global para un objeto es coste sin beneficio |
| **Estado local de UI** | `useState` | — |

**Descartadas.** *Zustand/Redux*: resuelven un problema que este MVP no tiene una vez
que el estado de servidor vive en TanStack Query y los filtros viven en la URL. Meter
un store global sería confundir "app seria" con "app compleja". *useEffect + fetch a
mano*: es reimplementar peor caché, reintentos y cancelación.

**Routing: React Router v7.** Frente a TanStack Router (mejor tipado de rutas, pero
más nuevo y con menos ecosistema): se prioriza ubicuidad y facilidad de relevo del
proyecto.

**Estilos: CSS Modules + design tokens en CSS custom properties.** Esto es
consecuencia directa de un requisito del enunciado: *prohibido el look genérico de demo
generada por IA*. Tailwind empuja hacia sus escalas y paleta por defecto, y las
librerías de componentes (MUI, shadcn) traen una identidad visual **reconocible a
simple vista** — exactamente lo que hay que evitar cuando se pide "identidad propia y
coherente". Escribir tokens a mano obliga a decidir tipografía, escala de espaciado y
paleta con intención, y a poder justificar cada una. Coste: más CSS escrito a mano. Se
acepta, porque el diseño es criterio de evaluación explícito.

---

## ADR-004 — Autenticación: JWT en cookie httpOnly, sin CORS

**Estado**: aceptada

**Decisión.** Email + contraseña, hash **Argon2id** vía `@node-rs/argon2`, sesión en
**JWT dentro de cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción**. El
frontend habla con el backend por **`/api`, mismo origen**, gracias al proxy del dev
server de Vite y a servir ambos tras el mismo origen en producción.

**Por qué esta combinación.**
- **Token en cookie `httpOnly` y no en `localStorage`**: un XSS no puede leer la
  sesión. Guardar JWT en `localStorage` es el patrón más extendido en tutoriales y el
  más difícil de defender ante un comité técnico.
- **Mismo origen vía proxy**: elimina **toda** la configuración de CORS y hace que
  `SameSite=Lax` sea suficiente frente a CSRF para las rutas de este MVP, sin montar
  maquinaria de tokens anti-CSRF. Menos piezas, menos superficie de error.
- **`@node-rs/argon2` y no `argon2`/`bcrypt` clásicos**: verificado en el spike que
  instala **binario prebuilt napi sin `node-gyp`**. Los paquetes que compilan con
  node-gyp son una de las causas más frecuentes de que un `npm install` falle en la
  máquina de otro — y el objetivo de <20 min de ADR-008 no sobrevive a un fallo de
  compilación.

**Autorización.** Trivial en alcance pero explícita en implementación: el `userId`
**siempre** se deriva del token, **nunca** del cuerpo de la petición. Un usuario solo
puede leer y modificar sus propios seguimientos. Es la regla que impide el fallo
clásico de "seguir misiones en nombre de otro", y tiene test de integración propio.

**Descartado.** *Refresh tokens con rotación*: correcto para producción, pero añade
almacenamiento, revocación y rotación para un MVP cuyo riesgo real es bajo. Se usa un
único token de vida moderada y **se documenta como deuda técnica consciente** en el
roadmap. *OAuth*: dependería de configurar credenciales de terceros para poder
arrancar el proyecto, lo que contradice frontalmente ADR-008.

**Protección de fuerza bruta.** Rate limiting (`@nestjs/throttler`) sobre login y
registro. No es opcional aunque sea un MVP.

**Usuario demo.** El seed precarga `demo@demo.com` / `demo1234` y el login ofrece
"Entrar como demo" en un clic. Razón: el evaluador debe poder ver la funcionalidad de
seguimiento —que es el núcleo del caso de negocio— sin rellenar un formulario de
registro. Es una credencial de demostración pública y así se documenta.

---

## ADR-005 — Integración con APIs externas: replicar, no proxear

**Estado**: aceptada · **La decisión más importante del proyecto**

**Contexto.** SpaceX API v4 y REST Countries v3.1 son servicios públicos, gratuitos,
sin garantía de disponibilidad ni latencia, y ya han tenido incidentes.

**Decisión.** El backend es un **BFF que replica**, no un proxy. Un proceso de
sincronización programada trae los datos, los valida, los normaliza a un modelo de
dominio propio y los persiste en SQLite. **Las peticiones del usuario nunca tocan una
API externa.**

**Por qué no proxear en vivo.** Un proxy hace que la latencia y la disponibilidad de la
aplicación sean, como máximo, las del peor tercero. Además obligaría a filtrar,
ordenar y paginar en memoria sobre respuestas completas, en lugar de en SQL. Y haría
la aplicación **imposible de demostrar sin red** — lo que en este entorno de desarrollo,
con ambas APIs bloqueadas por política de red, la haría imposible de construir.

**Piezas concretas del diseño:**

1. **Capa anticorrupción.** Los DTO de cada proveedor viven en `infrastructure` y
   **nunca** cruzan hacia el dominio. Mappers explícitos traducen a entidades propias.
   Si mañana entra Launch Library 2 como segunda fuente, cambia un adaptador, no el
   dominio.
2. **Validación del dato externo con Zod en el borde.** Una API de terceros es entrada
   no confiable: un cambio de esquema aguas arriba debe fallar **ruidosamente y
   localmente**, no corromper la BD en silencio. La validación es **por registro**, de
   modo que un lanzamiento malformado no tumba el lote entero: se cuenta como
   rechazado y se reporta.
3. **Resiliencia por llamada saliente**: timeout con `AbortSignal.timeout`, reintentos
   acotados con backoff exponencial + *jitter*, límite de concurrencia y **circuit
   breaker** para que un proveedor caído no deje cada ciclo de sync colgado.
4. **Escrituras idempotentes** (*upsert* por ID de proveedor): la sincronización puede
   repetirse sin duplicar, y un fallo parcial es seguro de reintentar.
5. **Tabla de metadatos de sincronización**: última sync correcta por recurso, estado,
   duración, registros rechazados y error. Es lo que alimenta el indicador de
   antigüedad de M9 y lo que hace la degradación **observable** en vez de silenciosa.
6. **Cadencias diferenciadas** (S4): próximos cada 15 min, históricos cada 24 h, países
   cada 30 días. Re-descargar el histórico completo cada cuarto de hora sería
   desperdicio y una forma rápida de que nos corten.

**Campos consumidos, documentados explícitamente:**

- **SpaceX v4** — `/launches`: `id`, `name`, `flight_number`, `date_utc`, `date_unix`,
  `date_precision`, `tbd`, `net`, `upcoming`, `success`, `failures[]`, `details`,
  `rocket`, `launchpad`, `payloads[]`, `links.patch.{small,large}`, `links.webcast`,
  `links.wikipedia`, `links.article`. `/rockets`: `id`, `name`, `type`, `active`,
  `stages`, `first_flight`, `height`, `mass`, `description`. `/launchpads`: `id`,
  `name`, `full_name`, `locality`, `region`, `timezone`, `latitude`, `longitude`,
  `status`. `/payloads`: `id`, `name`, `type`, `mass_kg`, `orbit`, `customers[]`,
  `nationalities[]`, `manufacturers[]`.
> **Actualización del 6 de agosto de 2026 — REST Countries v3.1 ha sido deprecada.**
>
> Comprobado ejecutando la sincronización contra las APIs reales. Sus endpoints
> responden ahora `HTTP 200` con un sobre `{success:false, errors:[…]}` que remite a una
> **v5 alojada en `api.restcountries.com` y con clave de API obligatoria**.
>
> Dos consecuencias que este ADR debe recoger:
>
> 1. **La forma de fallar importaba más que el fallo.** Devolver el error con estado 200
>    esquiva todas las protecciones de ADR-005 —reintento, circuito, mapeo de errores—
>    porque todas se disparan con códigos de error. Se corrigió exigiendo que la
>    respuesta sea una colección y extrayendo el mensaje del proveedor. Es un refuerzo
>    real de la capa anticorrupción: **un 200 no significa que la respuesta sea válida.**
> 2. **No se migra a v5 en el alcance del MVP.** Exigiría una credencial de terceros en
>    el arranque, lo que contradice ADR-000 y ADR-008, que son la razón de ser de todo
>    el stack elegido. Evaluado en el roadmap.
>
> El campo `?fields=` documentado abajo sigue siendo correcto para v3.1; se conserva la
> descripción original porque describe el contrato con el que se construyó el proyecto.

- **REST Countries v3.1** — `/alpha` y `/all` **siempre con `?fields=`** (v3.1 rechaza
  `/all` sin él): `cca2`, `cca3`, `name.common`, `name.official`, `flags.svg`,
  `flags.png`, `flags.alt`, `region`, `subregion`, `capital`, `latlng`, `altSpellings`.
  `altSpellings` se consume específicamente para alimentar la resolución de
  nacionalidades del puente B.

---

## ADR-006 — Los dos puentes entre lanzamientos y países

**Estado**: aceptada (confirmada en checkpoint de Fase 1, con acotación de alcance)

**Contexto.** Detallado en Fase 1 §2: **la SpaceX API v4 no expone país** en ninguna
parte. `launchpads` tiene `region` en texto libre, nunca un código ISO.

**Decisión.**
- **Puente A — país del sitio**: mapeo curado `launchpad.id → ISO 3166-1 alpha-2`,
  versionado en el repositorio y cubierto por tests. Es un conjunto cerrado de ~6 pads.
  Alta fiabilidad.
- **Puente B — nacionalidad de la carga útil**: `payloads[].nationalities[]` resuelto
  contra REST Countries por nombre común, nombre oficial y `altSpellings`, más una
  **tabla de alias explícita** para los casos que ninguna de esas vías resuelve.

**Reglas innegociables del puente B:**
1. Lo que no resuelve **va a un bucket `unresolved` visible en la interfaz**, no a un
   log. El usuario ve qué no se pudo clasificar y por qué. Nunca se adivina, nunca se
   descarta en silencio.
2. Entidades que **no son países** (`"European Union"`) se clasifican como tales de
   forma explícita, no se fuerzan a un país.
3. La **cobertura de resolución** (% de nacionalidades resueltas) se expone como métrica
   de calidad de datos dentro de la propia aplicación.

**Acotación de alcance acordada.** Si en Fase 4 el puente B consume tiempo
desproporcionado, se corta donde esté, se documenta como decisión de alcance y los
casos sucios restantes pasan al backlog. **No es objetivo resolver el 100 %.** Una
cobertura del 85 % honestamente medida y mostrada vale más que un 100 % fingido.

---

## ADR-007 — Arquitectura: monolito modular por capas

**Estado**: aceptada · **Opciones**: monolito modular · microservicios · monolito plano

**Decisión.** **Monolito modular** en monorepo npm workspaces, con capas explícitas
dentro de cada módulo:

```
domain/          entidades, value objects, puertos (interfaces). Cero dependencias externas
application/     casos de uso, orquestación. Depende solo de domain
infrastructure/  repositorios Prisma, clientes HTTP, mappers. Implementa los puertos
presentation/    controladores, DTOs de entrada/salida, guards
```

La regla de dependencia apunta **siempre hacia dentro**: `presentation → application →
domain`, y `infrastructure` implementa interfaces de `domain` sin que `domain` sepa de
su existencia.

**Descartados.** *Microservicios*: para dos fuentes de datos y decenas de usuarios
concurrentes (S9), es coste operativo y de despliegue puro sin ningún beneficio.
Repartir esto en servicios sería confundir "arquitectura seria" con "arquitectura
grande". *Monolito plano* (lógica en controladores): incumple el requisito explícito
de separación de capas y es exactamente lo que hace un proyecto inmantenible al año.

**Patrones aplicados y por qué cada uno:** Repository (aislar Prisma del dominio y
poder falsearlo en tests) · Anti-Corruption Layer + Mapper (ADR-005) · Strategy sobre
`LaunchProvider`/`CountryProvider` (permite una segunda fuente sin tocar dominio) ·
Circuit Breaker (ADR-005) · DTO con validación en el borde.

**Puertos y adaptadores, aplicados con criterio.** Se define una interfaz **donde hay
una segunda implementación real o una necesidad real de doble en test**: proveedores
externos y repositorios. **No** se crea una interfaz por cada clase: eso es *cargo cult*
y añade indirección sin comprador. Esta distinción es deliberada y defendible.

**Monorepo:**
```
apps/api    backend NestJS
apps/web    frontend React
packages/shared   tipos del contrato HTTP compartidos entre ambos
```
`packages/shared` existe para que el contrato de la API tenga **una sola fuente de
verdad** y el frontend no pueda desviarse del backend sin romper en compilación.

---

## ADR-008 — Instalación local: dos comandos, sin Docker

**Estado**: aceptada · **Objetivo: <20 min. Estimación real: 3-5 min.**

**Decisión.**
```bash
nvm use                 # opcional; .nvmrc fija Node 22
npm install             # raíz: instala api + web vía workspaces
npm run setup           # copia .env, migra SQLite y siembra desde fixtures
npm run dev             # levanta api y web en paralelo (concurrently)
```

**Cómo se sostiene el objetivo de tiempo:**
- **npm workspaces** → un solo `npm install` en la raíz para los dos proyectos.
- **`.env.example` con valores por defecto que funcionan tal cual**. La ruta de SQLite
  y el secreto JWT de desarrollo vienen rellenos: no hay que conseguir ninguna
  credencial de terceros para arrancar (ninguna de las dos APIs externas requiere clave
  — otra razón por la que este caso encaja).
- **Seed desde fixtures del repositorio**: la aplicación arranca **con datos y sin
  red**. Esto deja de ser un plan B y pasa a ser el camino principal, dado el bloqueo
  de red de este entorno.
- **Cero dependencias nativas que compilen** — verificado en el spike (ADR-002, ADR-004).

**Sin Docker en la ruta de instalación**, por restricción del ejercicio y porque
exigirlo añadiría un runtime más que instalar. Se recoge en el roadmap como mejora de
estandarización de entornos.

---

## ADR-009 — Despliegue y CI/CD

**Estado**: aceptada (propuesta; no se despliega en el alcance del MVP)

**Propuesta.** Frontend estático en **Vercel o Netlify** (build de Vite, plan gratuito).
Backend en **Fly.io** (o Render).

**La advertencia honesta que hay que dar aquí.** SQLite es un fichero, y la mayoría de
PaaS tienen **sistema de ficheros efímero**: cada redespliegue borraría la base de
datos. Ignorar esto sería el fallo clásico de llevar a producción un stack elegido para
desarrollo local. Opciones reales, en orden:

1. **Fly.io con volumen persistente** — mínimo cambio, válido mientras haya una sola
   instancia. Recomendado para el MVP.
2. **Turso / LiteFS** — SQLite distribuido, si hace falta replicar.
3. **Migrar a PostgreSQL** cuando se necesiten varias instancias. Con Prisma es cambiar
   el `provider` y regenerar migraciones — **un punto adicional a favor de ADR-002**,
   porque la decisión de hoy no encierra al proyecto.

**CI/CD con GitHub Actions**: en cada PR, `lint` + `typecheck` + `test` + `build`
(matriz sobre Node 22). En merge a `main`, despliegue automático. Los tests no tocan la
red (ADR-010), así que el pipeline es determinista.

**Docker**: aquí sí tiene sentido mencionarlo, como mejora futura para estandarizar el
entorno de despliegue — **nunca como requisito de instalación local** (ADR-008).

---

## ADR-010 — Testing: qué se prueba y, sobre todo, qué no

**Estado**: aceptada · Herramientas ya fijadas: Vitest + Testing Library + Supertest

**Principio.** En un MVP no se persigue cobertura, se persigue **cubrir lo que rompe y
lo que se corrige a ciegas**. Prioridad por valor/coste:

| Prioridad | Qué | Con qué | Por qué es lo primero |
|---|---|---|---|
| 1 | **Normalización de datos externos**: DTO de SpaceX → dominio, `nationalities` sucias, `date_precision`, campos nulos | Vitest, funciones puras + fixtures | Son funciones puras: el test más barato y el que más regresiones atrapa. Es además donde vive la complejidad real del proyecto |
| 2 | **Fallos de terceros**: timeout, reintento con backoff, circuit breaker, lote con registros inválidos, proveedor caído con caché presente | Vitest + proveedor falso | Es un requisito explícito del enunciado y **la ruta que nunca se prueba a mano** porque no se puede provocar a voluntad |
| 3 | **Lógica de dominio**: formateo por precisión de fecha, derivación próximo/pasado (riesgo R3), resolución de país | Vitest | Es donde una regla de negocio mal puesta miente al usuario sin fallar |
| 4 | **Integración de endpoints**: registro/login, autorización de seguimientos (que un usuario **no** pueda seguir en nombre de otro), filtros y paginación | Supertest sobre SQLite temporal real | Contra base de datos real, no mocks: valida el SQL, no mi idea del SQL |
| 5 | **Frontend**: estados de carga/vacío/error/obsoleto y la interacción de seguir | Testing Library | Son los estados que en desarrollo casi nunca se miran, porque el camino feliz tapa los otros cuatro |

**Qué NO se prueba, y por qué (decisión, no descuido):**
- **E2E (Playwright)**: coste de mantenimiento alto para un MVP cuyo flujo cambiará.
  Va al roadmap.
- **Tests de snapshot de markup**: frágiles, se aprueban a ciegas, no detectan bugs
  reales.
- **Umbral de cobertura como objetivo**: incentiva probar getters. Se mide, no se
  convierte en meta.

**Regla dura: ningún test toca la red.** Todo se apoya en fixtures capturados. Los
tests deben pasar en un avión, en el CI y en este entorno con las APIs bloqueadas.

---

## Resumen de decisiones

| # | Decisión | Elegido | Principal descartado |
|---|---|---|---|
| 000 | Stack base | Node + TS + SQLite | PHP/Laravel, .NET (mi stack real) |
| 001 | Backend | NestJS ✔ confirmada | Express |
| 002 | ORM | Prisma 7 ✔ confirmada | Prisma 6, TypeORM |
| 003 | Estado frontend | TanStack Query + URL + Context | Zustand / Redux |
| 003 | Estilos | CSS Modules + tokens | Tailwind, MUI/shadcn |
| 004 | Auth | JWT en cookie httpOnly, Argon2id | JWT en localStorage, OAuth |
| 005 | APIs externas | Replicar en BD propia | Proxy en vivo |
| 006 | Cruce con países | Doble puente A + B | Bandera decorativa |
| 007 | Arquitectura | Monolito modular por capas | Microservicios |
| 008 | Instalación | npm workspaces, sin Docker | Docker Compose |
| 009 | Despliegue | Fly.io + volumen / Vercel | PaaS con FS efímero (rompe SQLite) |
| 010 | Testing | Pirámide invertida hacia normalización y fallos | E2E, snapshots, umbral de cobertura |
