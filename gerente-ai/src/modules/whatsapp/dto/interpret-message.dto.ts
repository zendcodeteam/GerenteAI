import { Type } from 'class-transformer';
import {
  IsBase64,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

import { ContenidoCoincideConElTipo } from './media-file-type.validator';

/**
 * Una nota de voz o una foto que el usuario mando por WhatsApp.
 *
 * Llega en base64 porque quien descarga el archivo de Meta es n8n, que ya tiene
 * el token: pedirle al backend que lo descargue obligaria a darle una segunda
 * copia de esa credencial.
 */
export class MediaDto {
  @IsIn(['audio', 'image'], {
    message: 'media.kind debe ser "audio" o "image".',
  })
  kind!: 'audio' | 'image';

  /**
   * Tipo MIME tal como lo reporta Meta.
   *
   * Puede traer parametros: las notas de voz llegan como
   * "audio/ogg; codecs=opus", no como "audio/ogg" pelado. Rechazarlas por eso
   * hacia que toda nota de voz respondiera "no pude procesar tu mensaje". El
   * backend se queda con el tipo base antes de mandarselo al modelo.
   */
  @IsString()
  @Matches(
    /^(audio|image)\/[a-zA-Z0-9.+-]{2,40}(?:\s*;\s*[a-zA-Z0-9.+=-]{1,60})*$/,
    { message: 'media.mimeType no es un tipo de audio o imagen valido.' },
  )
  mimeType!: string;

  /**
   * El archivo en base64, sin el prefijo `data:`.
   *
   * El tope son ~9,4 MB de base64 (unos 7 MB de archivo), por debajo del limite
   * de 12 MB del servidor. Meta ya no acepta imagenes de mas de 5 MB ni audios
   * de mas de 16, asi que lo que se corta aqui es lo que no deberia llegar.
   *
   * El `mimeType` de arriba es lo que DECLARA quien envia, y con eso no basta:
   * se le miran los primeros bytes al archivo y tienen que ser los del tipo
   * declarado. Lo que no se reconozca no llega al modelo.
   */
  @IsString()
  @IsNotEmpty()
  @Length(1, 9_400_000, {
    message: 'El archivo es demasiado grande.',
  })
  @IsBase64(undefined, { message: 'media.dataBase64 no es base64 valido.' })
  @ContenidoCoincideConElTipo({
    message:
      'El contenido del archivo no corresponde con el tipo declarado en media.mimeType.',
  })
  dataBase64!: string;
}

/**
 * Contrato de entrada de n8n.
 *
 * IMPORTANTE: el backend corre con `ValidationPipe({ forbidNonWhitelisted: true })`,
 * asi que un campo que no este declarado aqui hace que la peticion falle con 400.
 * Si n8n empieza a mandar un dato nuevo, primero se agrega en este DTO.
 */
export class InterpretMessageDto {
  /** Texto tal cual lo escribio el usuario en WhatsApp. */
  @IsString()
  @Length(1, 2_000, {
    message: 'El mensaje debe tener entre 1 y 2000 caracteres.',
  })
  message!: string;

  /**
   * Numero del remitente en formato internacional sin "+", como lo entrega
   * Meta en `entry[0].changes[0].value.messages[0].from`.
   *
   * OPCIONAL desde que Meta soporta nombres de usuario: las cuentas que
   * activaron esa opcion no exponen su telefono y llegan solo con `userId`.
   * Debe venir uno de los dos; lo verifica el servicio.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\+?\d{7,20}$/, {
    message:
      'phone debe ser un numero internacional (solo digitos, sin espacios).',
  })
  phone?: string;

  /**
   * Identidad de WhatsApp del remitente cuando su telefono viene oculto
   * (`messages[0].from_user_id`, por ejemplo "CO.1710763673557397").
   *
   * Sirve para dos cosas: identificar la sede y responderle, porque la Graph
   * API acepta esta identidad como destinatario.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._:-]{3,63}$/, {
    message: 'userId no tiene el formato de una identidad de WhatsApp.',
  })
  userId?: string;

  /** Nombre de usuario publico de WhatsApp. Solo para logs y soporte. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  username?: string;

  /** Nombre del perfil de WhatsApp. Solo se usa para el saludo y los logs. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  /** Hilo de conversacion. Hoy n8n manda el mismo telefono; se acepta cualquiera. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  conversationId?: string;

  /**
   * `wamid` del mensaje de WhatsApp. Meta reintenta el webhook cuando no recibe
   * 200 a tiempo: con este id se descarta el duplicado y no se registra el gasto
   * dos veces. Muy recomendable enviarlo.
   */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  messageId?: string;

  /**
   * `wamid` del mensaje que el usuario esta citando, cuando responde a otro.
   *
   * Meta lo entrega en `messages[0].context.id`. Sin esto, un "pero esto es lo
   * que me dijiste" llegaba suelto y Luka contestaba cualquier cosa, porque no
   * tenia forma de saber a que se referia.
   */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  quotedMessageId?: string;

  /**
   * Nota de voz o foto que acompana al mensaje.
   *
   * Solo se atiende en los planes pagos; en el gratuito se responde con el
   * mensaje de mejora de plan sin llamar al modelo, que es lo caro.
   */
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MediaDto)
  media?: MediaDto;

  /**
   * Permite forzar el modo "solo interpretar, no guardar" desde n8n (pruebas).
   * Por defecto se guarda: el bot existe para registrar.
   */
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
