/** Tras NFD los diacríticos quedan como marcas combinantes independientes, que es
 *  justo la categoría Unicode `M`. Expresarlo así mantiene el fuente en ASCII. */
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Normaliza texto para búsqueda y comparación: minúsculas, sin diacríticos y con
 * espacios colapsados.
 *
 * No es cosmético. El LIKE de SQLite ignora mayúsculas en ASCII pero **no** ignora
 * acentos, así que sin esto "mision" no encontraría "Misión". Toda columna buscable
 * guarda su versión normalizada y las comparaciones se hacen contra ella.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
