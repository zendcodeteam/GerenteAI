import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * Validacion del tipo REAL del archivo que manda n8n.
 *
 * Hasta aqui se confiaba en `media.mimeType`, que es lo que declara quien
 * envia: cualquiera podia rotular un ejecutable o un PDF como "image/jpeg" y el
 * backend se lo pasaba al modelo tal cual. El tipo declarado sirve para elegir
 * como tratarlo, no para saber que es.
 *
 * Asi que antes de llegar al modelo se le miran los primeros bytes al archivo
 * (su firma, o "magic bytes") y se exige que sean los del tipo declarado. No se
 * agrego ninguna dependencia: las firmas de los formatos que WhatsApp puede
 * mandar caben en una tabla y no cambian.
 */

type Familia = 'audio' | 'image';

interface Firma {
  /** Tipo real, en su forma canonica. */
  readonly mimeType: string;
  readonly familia: Familia;
  /**
   * Tipos declarados que se aceptan para esta firma. Un mismo formato viaja
   * con varios nombres segun quien lo rotule (audio/mp3 y audio/mpeg son el
   * mismo archivo), y rechazar por el alias seria rechazar archivos validos.
   */
  readonly declarados: readonly string[];
  readonly coincide: (bytes: Buffer) => boolean;
}

/** ¿El archivo empieza por estos bytes exactos? */
function empiezaPor(bytes: Buffer, patron: readonly number[]): boolean {
  if (bytes.length < patron.length) return false;
  return patron.every((byte, i) => bytes[i] === byte);
}

/** ¿Hay este texto ASCII en esta posicion? (los contenedores lo usan mucho) */
function textoEn(bytes: Buffer, offset: number, valor: string): boolean {
  if (bytes.length < offset + valor.length) return false;
  return bytes.toString('latin1', offset, offset + valor.length) === valor;
}

/**
 * Firmas de los formatos que se aceptan. Todo lo que no este aqui se rechaza:
 * la lista blanca es a proposito, porque lo que se busca evitar es justamente
 * el formato que nadie previo.
 */
const FIRMAS: readonly Firma[] = [
  {
    mimeType: 'image/jpeg',
    familia: 'image',
    declarados: ['image/jpeg', 'image/jpg', 'image/pjpeg'],
    coincide: (bytes) => empiezaPor(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    mimeType: 'image/png',
    familia: 'image',
    declarados: ['image/png'],
    coincide: (bytes) =>
      empiezaPor(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mimeType: 'image/gif',
    familia: 'image',
    declarados: ['image/gif'],
    coincide: (bytes) =>
      textoEn(bytes, 0, 'GIF87a') || textoEn(bytes, 0, 'GIF89a'),
  },
  {
    // Los stickers y muchas fotos reenviadas llegan en WebP.
    mimeType: 'image/webp',
    familia: 'image',
    declarados: ['image/webp'],
    coincide: (bytes) => textoEn(bytes, 0, 'RIFF') && textoEn(bytes, 8, 'WEBP'),
  },
  {
    // Las notas de voz de WhatsApp: OGG con codec Opus.
    mimeType: 'audio/ogg',
    familia: 'audio',
    declarados: ['audio/ogg', 'audio/opus', 'audio/x-ogg', 'audio/vorbis'],
    coincide: (bytes) => textoEn(bytes, 0, 'OggS'),
  },
  {
    mimeType: 'audio/amr',
    familia: 'audio',
    declarados: ['audio/amr', 'audio/3gpp', 'audio/x-amr'],
    coincide: (bytes) => textoEn(bytes, 0, '#!AMR'),
  },
  {
    mimeType: 'audio/wav',
    familia: 'audio',
    declarados: ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/vnd.wave'],
    coincide: (bytes) => textoEn(bytes, 0, 'RIFF') && textoEn(bytes, 8, 'WAVE'),
  },
  {
    /*
     * MP4 de solo audio (el .m4a). Se piden las marcas "M4A"/"M4B" a proposito:
     * un video comparte el mismo contenedor `ftyp` y por los bytes de cabecera
     * no se distingue de otra forma, y un video rotulado como audio es
     * exactamente lo que no se quiere dejar pasar al modelo.
     */
    mimeType: 'audio/mp4',
    familia: 'audio',
    declarados: ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac'],
    coincide: (bytes) =>
      textoEn(bytes, 4, 'ftyp') &&
      (textoEn(bytes, 8, 'M4A') || textoEn(bytes, 8, 'M4B')),
  },
  {
    /*
     * Audio MPEG suelto: MP3 (con etiqueta ID3 o arrancando en un frame) y AAC
     * en ADTS. Van juntos porque comparten el sincronismo de frame (11 bits en
     * uno) y separarlos solo daria falsos rechazos entre dos formatos que de
     * todos modos se aceptan.
     */
    mimeType: 'audio/mpeg',
    familia: 'audio',
    declarados: [
      'audio/mpeg',
      'audio/mp3',
      'audio/mpeg3',
      'audio/x-mpeg',
      'audio/aac',
      'audio/x-aac',
    ],
    coincide: (bytes) =>
      textoEn(bytes, 0, 'ID3') ||
      (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0),
  },
];

/**
 * Bytes que hacen falta para decidir: 12 para las firmas mas largas (RIFF,
 * `ftyp`) y algo de margen.
 */
const CARACTERES_DE_CABECERA = 24;

/**
 * Solo se decodifica la cabecera, no el archivo entero: son hasta 7 MB que no
 * tiene sentido materializar en memoria en cada peticion para mirarle los
 * primeros bytes. Cada 4 caracteres de base64 son 3 bytes.
 */
function cabecera(dataBase64: string): Buffer {
  return Buffer.from(dataBase64.slice(0, CARACTERES_DE_CABECERA), 'base64');
}

/** El tipo MIME sin sus parametros: "audio/ogg; codecs=opus" -> "audio/ogg". */
function tipoBase(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

/** La firma que corresponde al contenido, o `undefined` si no es ninguna. */
function reconocer(dataBase64: string): Firma | undefined {
  const bytes = cabecera(dataBase64);
  return FIRMAS.find((firma) => firma.coincide(bytes));
}

/**
 * Exige que el contenido en base64 sea de verdad lo que dicen `media.kind` y
 * `media.mimeType`. Se aplica sobre el campo del archivo porque ahi es donde
 * esta la evidencia; el mensaje de error apunta al tipo declarado.
 */
export function ContenidoCoincideConElTipo(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'contenidoCoincideConElTipo',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (typeof value !== 'string' || value.length === 0) return false;

          const media = args.object as Partial<{
            kind: unknown;
            mimeType: unknown;
          }>;

          if (typeof media.mimeType !== 'string') return false;

          const firma = reconocer(value);

          // No es ninguno de los formatos permitidos: no se manda al modelo.
          if (!firma) return false;

          // Un audio rotulado como imagen (o al reves) tampoco pasa: `kind` es
          // lo que decide como se arma la parte que recibe el modelo.
          if (media.kind !== firma.familia) return false;

          return firma.declarados.includes(tipoBase(media.mimeType));
        },
        defaultMessage(): string {
          return 'El contenido del archivo no corresponde con el tipo declarado en media.mimeType.';
        },
      },
    });
  };
}
