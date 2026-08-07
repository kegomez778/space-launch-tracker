# Supuestos realizados durante el desarrollo

Los 12 supuestos de partida están en [`01-alcance-mvp.md`](./01-alcance-mvp.md) §6. Este
documento recoge **qué pasó con ellos al implementar**: cuáles se confirmaron, cuáles
hubo que ajustar y qué supuestos nuevos aparecieron sólo al escribir código.

Un supuesto que nadie revisa después de asumirlo deja de ser un supuesto y pasa a ser
una creencia. Esta es la revisión.

---

## 1. Supuestos de partida: qué sobrevivió

| # | Supuesto | Resultado |
|---|---|---|
| S1 | Catálogo público, cuenta sólo para seguir | **Confirmado.** Implementado tal cual |
| S2 | Auth propia, Argon2id, JWT | **Confirmado y reforzado.** Ver §2.1 |
| S3 | Replicar en BD propia, no proxear | **Confirmado.** Fue además lo que hizo el proyecto construible en un entorno sin acceso a las APIs |
| S4 | Cadencias de sync diferenciadas | **Ajustado.** Ver §2.2 |
| S5 | Fixtures en el repositorio | **Confirmado, con una corrección de honestidad.** Ver §2.3 |
| S6 | Sólo SpaceX como proveedor | **Confirmado** |
| S7 | UTC en almacenamiento, local en presentación | **Confirmado** |
| S8 | UI en español | **Confirmado** |
| S9 | Escala de decenas de usuarios | **Confirmado.** Justifica SQLite y la paginación por offset |
| S10 | Sin datos personales más allá de email y país | **Confirmado** |
| S11 | Catálogo de solo lectura | **Confirmado.** Es lo que hace segura la desnormalización de §3.1 de arquitectura |
| S12 | Imágenes enlazadas, no rehospedadas | **Confirmado, y el riesgo se materializó.** Ver §2.4 |

---

## 2. Los que hubo que tocar

### 2.1 S2 — La auth necesitaba más de lo asumido

Se asumió "email + contraseña con hash y JWT". Al implementarlo aparecieron dos cosas
que el supuesto no cubría y que no son opcionales:

- **Enumeración de cuentas.** Si el login sólo verifica la contraseña cuando el email
  existe, un email inexistente responde mucho más rápido. Eso permite averiguar qué
  cuentas hay midiendo tiempos. Se resuelve verificando siempre contra un hash de
  descarte **real** (uno inventado fallaría al instante y no igualaría nada).
- **El `userId` nunca puede venir del cliente.** No basta con validarlo: se elimina la
  vía. Ninguna ruta lo acepta como parámetro, así que "comprobar que el usuario es el
  dueño" no es un paso que alguien pueda olvidar al añadir un endpoint.

### 2.2 S4 — Una sola cadencia, no tres

Se asumieron tres frecuencias distintas (próximos cada 15 min, históricos cada 24 h,
países cada 30 días). Al implementarlo resultó desproporcionado: la SpaceX API entrega
todos los lanzamientos en una sola respuesta, así que separar "próximos" de "históricos"
**no ahorra ninguna petición** — sólo añade tres planificadores y tres caminos de fallo
que mantener.

**Ajuste:** un único ciclo cada 15 minutos que sincroniza el catálogo completo, con
guarda de solapamiento para que un ciclo lento no pise al siguiente. Las cadencias
diferenciadas vuelven a tener sentido el día que la fuente permita pedir sólo los
cambios; hasta entonces son complejidad sin comprador.

### 2.3 S5 — Los fixtures no son capturas, y hay que decirlo

El supuesto decía "fixtures **capturados** de ambas APIs". No se pudieron capturar: el
entorno de desarrollo tiene ambos dominios bloqueados por política de red.

**Corrección:** están escritos a mano reproduciendo la forma exacta de cada API, y se
documenta explícitamente como tal en el README y en `fixtures/README.md`. Llamarlos
capturas habría sido una imprecisión pequeña pero del tipo que erosiona la confianza en
todo lo demás que dice el repositorio.

Efecto secundario positivo: al escribirlos a mano se pudieron **sembrar a propósito los
casos incómodos** —seis niveles de precisión de fecha, un registro corrupto, una carga
huérfana, `"European Union"`, un país inexistente— que una captura real quizá no habría
contenido.

### 2.4 S12 — El riesgo de las imágenes se materializó durante el desarrollo

Se asumió enlazar las imágenes de terceros aceptando el riesgo R7. Ese riesgo **ocurrió
de verdad** en este entorno: el CDN de banderas está bloqueado.

El resultado fue peor que "no se ve la bandera". El navegador renderiza el texto
alternativo dentro de la caja de la imagen, y con un `alt` descriptivo en una caja de
20 px de ancho, **cada tarjeta pasó de 80 a 400 px de alto**. La retícula entera se
deshizo.

Estaba previsto el sustituto para el parche de misión, pero no para la bandera. Corregido
con un componente `CountryFlag` que cae al código ISO del país: cabe siempre, es
información real y ocupa exactamente lo mismo que la bandera que reemplaza.

**Lección aplicable más allá de este caso:** un *fallback* de imagen no es sólo un tema
estético. Sin alto acotado, una imagen rota es un problema de layout.

---

## 3. Supuestos nuevos, aparecidos al implementar

| # | Supuesto | Por qué |
|---|---|---|
| N1 | **El sitio de Kwajalein se mapea a Estados Unidos**, no a Islas Marshall | Es un atolón del Pacífico usado como instalación estadounidense. Cualquiera de las dos respuestas es defendible; se elige la que refleja quién opera el sitio, y queda en una tabla curada de un vistazo para poder cambiarla en un diff |
| N2 | **Un país sólo aparece en el directorio si tiene vínculo real** con algún lanzamiento | Un directorio de 250 banderas de las que 240 no llevan a ningún sitio no es un directorio, es ruido |
| N3 | **Los `altSpellings` de dos letras se descartan** como alias | Se solapan entre países y generarían falsos positivos. Un alias ambiguo es peor que ningún alias |
| N4 | **Ante dos países que comparten un alias, gana el primero** y no se sobrescribe | Hace el índice determinista independientemente del orden de llegada de los datos, que es lo que permite que los tests signifiquen algo |
| N5 | **Una precisión de fecha desconocida degrada a `year`**, la más conservadora | Si la fuente añade un valor nuevo, la aplicación muestra menos precisión de la real. El error contrario —mostrar más— es el que engaña al usuario |
| N6 | **Las nacionalidades se recomponen enteras en cada sincronización** en vez de actualizarse | Es la única forma de que un cambio en la tabla de alias se refleje sin arrastrar resoluciones antiguas |
| N7 | **Un lanzamiento que referencia un cohete o sitio ausente se guarda sin esa referencia**, no se descarta | El lanzamiento sigue siendo información válida y útil. Perderlo entero por un dato secundario sería peor |
| N8 | **Los datos se consideran envejecidos a las 6 horas** | Cuatro veces la cadencia de sincronización: suficiente para absorber fallos puntuales sin alarmar, poco para que un problema real pase inadvertido |

---

### 2.5 El supuesto que el mundo invalidó: las fuentes no piden credenciales

No aparecía numerado porque no parecía un supuesto: las dos APIs del enunciado eran
públicas y abiertas, y sobre eso se construyó el argumento central de instalación sin
fricción (ADR-000, ADR-008).

El 6 de agosto de 2026, al poder ejecutar por primera vez la sincronización contra las
APIs reales, resultó falso: **REST Countries v3.1 fue deprecada** y su sustituta exige
registro y clave de API.

Es el recordatorio de que un supuesto sobre un tercero **caduca sin avisar**. Y de que el
mecanismo que lo detectó no fue un test —los fixtures no podían detectarlo, porque
reproducen el contrato antiguo por definición— sino ejecutar contra el sistema real. Los
fixtures protegen de las regresiones propias; no protegen de que el mundo cambie.

Consecuencia asumida para el MVP: la sincronización real de países queda inoperativa,
con un error explícito, y el modo por defecto sigue cubriendo toda la funcionalidad. Las
tres salidas posibles están evaluadas en [`05-roadmap.md`](./05-roadmap.md) §0.

---

## 4. Lo que sigue sin resolverse, a propósito

- **La resolución de nacionalidades no llega al 100 %**, y no es objetivo que llegue. La
  cobertura con los fixtures es del 91,7 %. Lo que falta es visible en la aplicación con
  su recuento. Era el acuerdo de alcance: una cobertura honestamente medida vale más que
  un 100 % fingido.
- **El mapeo de sitios a países es curado y finito.** Si SpaceX añade un pad nuevo, hay
  un respaldo por región normalizada; si tampoco encaja, el sitio queda sin país en vez
  de asignarle uno por proximidad geográfica.
- **No hay refresco de sesión.** Un único token de vida moderada. Recogido como deuda
  consciente en el roadmap.
