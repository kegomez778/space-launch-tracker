# Fixtures

Datos de arranque que permiten levantar la aplicación **con contenido y sin conexión**.

## Qué son exactamente

Ficheros escritos a mano que **reproducen la forma exacta** de las respuestas de
SpaceX API v4 y REST Countries v3.1, con identificadores, nombres de misión y
cohetes reales. **No son capturas literales de las APIs**: el entorno donde se
desarrolló este proyecto tiene ambos dominios bloqueados por política de red.

Se dice de forma explícita para que nadie los confunda con un volcado de producción.
Para regenerarlos desde las APIs reales, con red disponible:

```bash
npm run sync:once --workspace apps/api
```

## Por qué contienen casos incómodos a propósito

No son datos "bonitos". Cada rareza está puesta para que los tests y la interfaz
tengan que enfrentarse a ella:

| Caso incluido | Dónde | Qué obliga a resolver |
|---|---|---|
| `date_precision` en `hour`, `day`, `month`, `quarter` y `year` | `launches.json` | Que la interfaz no muestre una hora que la fuente no conoce |
| `success: null` en lanzamientos futuros | `launches.json` | Distinguir "todavía no se sabe" de "falló" |
| `upcoming: true` con fecha ya pasada | `launches.json` | El riesgo R3: el flag de la fuente contradice su fecha |
| `failures[]` con `reason: null` antes del motivo real | `launches.json` | Buscar el primer motivo útil, no el primer elemento |
| Cadenas vacías donde debería haber `null` | `launches.json` | Normalizar el hueco de verdad |
| Lanzamiento sin parche ni enlaces | `launches.json` | Estados vacíos en la tarjeta y en el detalle |
| `"European Union"` en `nationalities` | `payloads.json` | No forzar una entidad supranacional dentro de un país |
| `"Republic of Korea"`, `"UK"`, `"USA"` | `payloads.json` | Los pasos 2 y 4 de la cadena de resolución |
| `"Freedonia"` (país inexistente) | `payloads.json` | Que lo no resuelto se vea, en vez de desaparecer |
| Carga útil sin `launch` asociado | `payloads.json` | Descartarla en lugar de dejar una referencia rota |
| Registro con `flight_number` no numérico | `launches.json` | Que un registro corrupto no tumbe el lote |

El último es importante: el fichero incluye **a propósito un registro inválido**. El
sembrado debe descartarlo, contarlo y seguir. Si algún día deja de aparecer como
rechazado en `/api/data-quality`, es que la validación se rompió.
