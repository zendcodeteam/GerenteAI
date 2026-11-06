/**
 * Cómo se compara el nombre de un producto con lo que dicta el tendero.
 *
 * Sin acentos, sin mayúsculas y con un solo espacio entre palabras: quien
 * escribe "arroz diana", "Arroz Diana" o "Arróz  Diana" por WhatsApp está
 * hablando del mismo producto, y el bot tiene que resolverlo igual en los tres
 * casos.
 *
 * Vive aquí y no dentro del adaptador porque lo necesitan los dos lados de la
 * misma regla: el bot para RESOLVER un producto a partir de un mensaje, y
 * `ProductosService` para no dejar REGISTRAR dos productos que el bot vería
 * como el mismo. Si cada lado tuviera su propia copia, acabarían discrepando y
 * el panel volvería a admitir duplicados que dejan al bot sin salida.
 */
export function normalizarNombreDeProducto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
