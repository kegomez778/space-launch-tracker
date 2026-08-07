# SLT-1 · Seguimiento de lanzamientos espaciales

MVP de una plataforma para consultar lanzamientos espaciales, explorarlos por país y
seguir las misiones de interés. Integra **SpaceX API v4** y **REST Countries v3.1**.

> **Instalación medida: 29 s en Linux, 4 min 20 s en Windows**, desde `git clone` hasta
> la base sembrada. No son estimaciones: están cronometradas sobre clones limpios en
> ambos sistemas (§ Instalación).

---

## Puesta en marcha

**Requisito único: Node.js 22.12+ o 24+.** Sin Docker, sin servidor de base de datos,
sin claves de API. **La aplicación arranca completa y con datos sin registrarse en
ningún servicio de terceros** (ver § Estado de las fuentes externas para el matiz
sobre el modo de sincronización real).

> El mínimo no es negociable ni es un aviso: **Prisma aborta la instalación** por debajo
> de 22.12 (y rechaza toda la rama 23, que no es LTS). Comprobado: con Node 20.11 el
> `npm install` falla entero en el `preinstall`. Si tienes una versión anterior,
> `winget install OpenJS.NodeJS.LTS` en Windows o `nvm install 24` con nvm lo resuelve.

```bash
git clone <url-del-repositorio>
cd space-launch-tracker

nvm use          # opcional, .nvmrc fija Node 22
npm install      # instala api, web y el paquete compartido
npm run setup    # copia los .env, migra SQLite y siembra con datos
npm run dev      # arranca API y frontend en paralelo
```

Abre **http://localhost:5173**. La API queda en http://localhost:3000/api.

### Entrar sin registrarse

La aplicación se explora entera sin cuenta. Para probar el seguimiento de misiones, el
login ofrece un botón **"Entrar como demo"** que autentica en un clic:

```
demo@demo.com / demo1234
```

Es una credencial de demostración pública, sembrada a propósito y con un par de
misiones ya seguidas para que el panel no aparezca vacío.

### La aplicación arranca sin conexión

Por defecto (`SYNC_ENABLED=false`) el catálogo se siembra desde los ficheros de
`apps/api/fixtures/`, así que funciona **sin red**: detrás de un firewall corporativo,
en un avión o con SpaceX caída. Para traer datos reales, pon `SYNC_ENABLED=true` en
`apps/api/.env` y reinicia; la sincronización programada empezará a actualizar el
catálogo.

Los fixtures reproducen la forma exacta de ambas APIs e incluyen a propósito los casos
incómodos —fechas sin confirmar, un registro corrupto, nacionalidades que no resuelven—
para que la interfaz y los tests tengan que enfrentarse a ellos. Ver
[`apps/api/fixtures/README.md`](apps/api/fixtures/README.md).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | API (`:3000`) y frontend (`:5173`) en paralelo |
| `npm run setup` | Prepara entorno, base de datos y datos iniciales. Idempotente |
| `npm test` | Los 88 tests (61 de API + 27 de frontend) |
| `npm run test:api` / `npm run test:web` | Sólo uno de los dos |
| `npm run typecheck` | TypeScript estricto en los tres paquetes |
| `npm run build` | Build de producción |
| `npm run db:reset` | Rehace la base desde cero y vuelve a sembrar |

Ningún test toca la red: se apoyan en fixtures y en una base SQLite temporal, así que
pasan igual en un avión que en el CI.

---

## Variables de entorno

`npm run setup` crea los `.env` a partir de los `.env.example`, **con valores por
defecto que funcionan tal cual**. No hay que rellenar nada para empezar.

Las que importan (`apps/api/.env`):

| Variable | Por defecto | Para qué |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | Fichero SQLite. No hay servidor que arrancar |
| `JWT_SECRET` | valor de desarrollo | **Sustituir en producción** por uno generado |
| `SYNC_ENABLED` | `false` | `true` para traer datos reales de las APIs |
| `EXTERNAL_TIMEOUT_MS` | `10000` | Corte de las llamadas salientes |
| `EXTERNAL_MAX_RETRIES` | `3` | Reintentos con espera creciente |
| `CIRCUIT_BREAKER_THRESHOLD` | `5` | Fallos seguidos que abren el circuito |

Genera un secreto de producción con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Qué hace la aplicación

| | |
|---|---|
| **Catálogo** | Lanzamientos paginados, con búsqueda por misión y filtros por estado, resultado y orden. Los filtros viven en la URL, así que una vista filtrada se puede compartir |
| **Detalle** | Cohete, sitio y su país, cargas útiles con su nacionalidad, motivo del fallo si lo hubo, enlaces oficiales y cuenta atrás cuando la fecha lo permite |
| **Países** | Directorio y ficha por país, con los lanzamientos desde su suelo y los que llevaron carga suya |
| **Mis misiones** | Seguimiento persistido en servidor, ordenado por proximidad, con cuenta atrás de la siguiente |
| **Calidad de datos** | Qué parte de la integración no resuelve, y por qué |

### Tres decisiones que se notan usándola

**Las fechas no mienten.** La SpaceX API entrega siempre una fecha completa, pero
acompañada de una precisión que puede ser tan gruesa como el año. Con precisión de mes,
esa hora concreta es relleno. La aplicación muestra `Diciembre de 2026 · día por
confirmar` en lugar de inventar `3 dic 2026, 14:22`, y la cuenta atrás sólo aparece
cuando la hora se conoce de verdad. En un producto cuyo valor es *seguir* una misión,
esto no es un detalle.

**El cruce con países está construido, no fingido.** La SpaceX API **no expone país** en
ninguna parte: `launchpads` sólo tiene `region` en texto libre. Se construyen dos
vínculos: el país del sitio de lanzamiento (mapeo curado, conjunto cerrado) y la
nacionalidad de la carga útil (resuelta contra REST Countries en seis pasos). Un usuario
en Alemania no tiene sitios de SpaceX, pero sí satélites suyos volando.

**Lo que no se resuelve se enseña.** Las nacionalidades vienen como texto libre sucio.
La resolución no adivina nunca por aproximación: lo que no encaja se marca como *sin
resolver* y aparece en la página de calidad de datos con su recuento. Un país inventado
es peor que un hueco reconocido. La cobertura actual con los fixtures es del **91,7 %**,
y esa cifra se muestra en la propia aplicación.

---

## Arquitectura en un párrafo

Monolito modular en monorepo npm workspaces. El backend **replica** las fuentes externas
en su propia base en lugar de proxearlas: un proceso de sincronización valida, normaliza
y persiste, y las peticiones de usuario nunca tocan una API de terceros. Eso aísla la
latencia y las caídas ajenas, permite filtrar y paginar en SQL, y es lo que hace la
aplicación demostrable sin red.

```
apps/api          NestJS · capas domain / application / infrastructure / presentation
apps/web          React + Vite · CSS Modules con tokens propios
packages/shared   contrato HTTP compartido: si divergen, rompe en compilación
```

Documentación completa:

| Documento | Contenido |
|---|---|
| [`docs/01-alcance-mvp.md`](docs/01-alcance-mvp.md) | Hipótesis de negocio, alcance, 12 supuestos, 11 riesgos |
| [`docs/02-decisiones-tecnicas.md`](docs/02-decisiones-tecnicas.md) | 11 ADR con alternativas descartadas y consecuencias asumidas |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Diagramas, modelo de dominio y estrategia de rendimiento |
| [`docs/04-supuestos.md`](docs/04-supuestos.md) | Supuestos confirmados o corregidos durante la implementación |
| [`docs/05-roadmap.md`](docs/05-roadmap.md) | Qué haría con más tiempo, y qué deuda técnica queda |

---

## Instalación: los números medidos

Cronometrado sobre clones limpios en los dos sistemas, no estimado:

| Paso | Linux · Node 22 | Windows 11 · Node 24 |
|---|---|---|
| `npm install` | ~18 s (caché caliente) | ~2 min 15 s (caché fría) |
| `npm run setup` (build, migración y sembrado) | ~11 s | ~2 min 5 s |
| `npm test` (88 tests) | ~9 s | ~25 s |
| **Total hasta tener la app lista** | **~29 s** | **~4 min 20 s** |

**Windows es del orden de diez veces más lento en el `setup`.** El grueso se lo lleva
`ts-node` compilando la aplicación Nest entera para sembrar, sin caché incremental, más
la penalización del sistema de ficheros. Sigue muy por debajo del objetivo de 20
minutos, pero conviene no prometer los 29 segundos a quien vaya a instalarlo en Windows.

Se sostiene sobre cuatro decisiones: un único `npm install` gracias a workspaces, SQLite
(que es un fichero, sin servidor ni credenciales), `.env.example` con valores
funcionales, y **cero dependencias nativas que compilen** — el hash de contraseñas usa
binarios precompilados, porque un fallo de `node-gyp` en la máquina de otro es la causa
más común de que una instalación se atasque. Esa última decisión se comprobó en Windows:
`@node-rs/argon2` resolvió su binario `win32-x64-msvc` sin intervenir `node-gyp`.

---

## Despliegue

No se despliega dentro del alcance del MVP, pero la propuesta está cerrada:

- **Frontend** estático en Vercel o Netlify (build de Vite, plan gratuito).
- **Backend** en Fly.io o Render.
- **CI/CD** con GitHub Actions: `lint`, `typecheck`, `test` y `build` en cada PR;
  despliegue al fusionar en `main`. Como ningún test toca la red, el pipeline es
  determinista.

**Advertencia que conviene no saltarse:** SQLite es un fichero, y la mayoría de PaaS
tienen sistema de ficheros efímero, así que **cada redespliegue borraría la base de
datos**. Para producción: Fly.io con volumen persistente (mínimo cambio, válido con una
sola instancia), Turso/LiteFS si hace falta replicar, o migrar a PostgreSQL cuando se
necesiten varias instancias — con Prisma es cambiar el `provider` y regenerar
migraciones.

Docker no forma parte de la instalación local a propósito: exigirlo añadiría un runtime
más. Está en el roadmap como mejora para estandarizar entornos de despliegue.

---

## Estado de las fuentes externas

Comprobado el **6 de agosto de 2026** ejecutando `npm run sync:once` con
`SYNC_ENABLED=true` contra las APIs reales. Ambas fuentes que el ejercicio fijaba como
obligatorias están hoy degradadas, y conviene decirlo antes de que alguien lo descubra
al arrancar:

| Fuente | Estado | Efecto |
|---|---|---|
| **REST Countries v3.1** | **Deprecada.** Devuelve `HTTP 200` con `{success:false, errors:[…]}` remitiendo a una v5 que vive en otro host y **exige clave de API** previo registro | La sincronización real de países falla con un error explícito |
| **SpaceX API v4** | Intermitente. Respondió `525` (fallo de handshake TLS en su CDN) durante la comprobación | La sincronización real de lanzamientos puede fallar |

**Nada de esto impide usar la aplicación.** El modo por defecto se sirve de los fixtures
del repositorio y funciona por completo: catálogo, países, seguimiento y calidad de
datos. Es justamente el escenario para el que se diseñó la arquitectura (ADR-005), y la
caída sirvió para verificarlo con una avería real en lugar de simulada: con **las dos
fuentes caídas a la vez**, la aplicación conservó sus 16 lanzamientos, sus 20 países y su
91,7 % de nacionalidades clasificadas, y registró el fallo en `/api/data-quality`.

**Por qué no se migró a v5.** La v5 exige registrarse y propagar una credencial, lo que
contradice frontalmente el principio que gobierna todo el proyecto: que el evaluador
clone y arranque sin conseguir nada de nadie (ADR-000, ADR-008). Cambiar eso a última
hora sería sacrificar la propiedad más valiosa del MVP por una funcionalidad que el modo
por defecto ya cubre. La migración está evaluada en el roadmap
([`docs/05-roadmap.md`](docs/05-roadmap.md)) con su coste y sus implicaciones.

El enunciado fijó v3.1 cuando era la versión vigente; que haya sido deprecada después es
una circunstancia sobrevenida, no una decisión del proyecto.

---

## Limitaciones conocidas

- **El catálogo es sólo de SpaceX.** La fuente obligatoria del ejercicio lo es, y la
  interfaz lo dice. El modelo de dominio es agnóstico de proveedor para admitir una
  segunda fuente sin reescribirlo.
- **La SpaceX API v4 está en mantenimiento** y su dataset de lanzamientos futuros
  arrastra registros cuyo flag `upcoming` contradice su propia fecha. La aplicación
  deriva el estado de la fecha y **cuenta las contradicciones** en la página de calidad
  de datos, en vez de propagarlas.
- **La sesión usa un único token sin refresco.** Suficiente para el alcance del MVP,
  documentado como deuda consciente en el roadmap.
- Los fixtures **no son capturas literales** de las APIs: el entorno donde se desarrolló
  el proyecto tiene ambos dominios bloqueados por política de red. Reproducen su forma
  exacta y se dice explícitamente para que nadie los confunda con un volcado real.
