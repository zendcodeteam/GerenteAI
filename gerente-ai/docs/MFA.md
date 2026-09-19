# MFA obligatorio para MASTER

El rol MASTER ve todos los negocios, así que su login exige un segundo factor
(TOTP de 6 dígitos: Google Authenticator, Microsoft Authenticator, Authy…).
Los usuarios CLIENTE no cambian.

## Flujo

1. `POST /auth/login` (o `/auth/google`) con la contraseña correcta **no**
   devuelve `access_token` a un MASTER: devuelve un `mfaToken` temporal (10 min)
   con `mfaRequiredAction`:
   - `setup`: todavía no tiene MFA. El frontend llama `POST /auth/mfa/activar`,
     muestra el QR y confirma con `POST /auth/mfa/verificar-activacion`.
   - `verify`: ya lo tiene. El frontend pide el código y llama
     `POST /auth/mfa/verificar`.
2. Solo un código correcto entrega el JWT de sesión. El `mfaToken` no sirve
   como sesión: `JwtStrategy` rechaza todo lo que no sea `type: 'session'`.

## Protecciones

- **Límite de intentos**: 5 códigos incorrectos bloquean la verificación
  15 minutos (HTTP 429). El contador vive en el usuario, así que un login nuevo
  no lo reinicia. Un acierto lo pone en cero.
- **Sin reuso**: un código aceptado no vuelve a servir (se guarda su paso de
  tiempo en `mfaUltimoPaso`).
- **Secreto cifrado** con AES-256-GCM (`mfaSecret` = `iv:authTag:cifrado`).

## Despliegue

1. `MFA_ENCRYPTION_KEY` en el servidor: 64 caracteres hexadecimales.

   ```bash
   openssl rand -hex 32
   ```

   Sin ella el login MASTER responde 500. **No se puede cambiar ni perder**:
   los secretos ya guardados solo se descifran con la misma clave. Si cambia,
   hay que resetear el MFA de cada MASTER (ver abajo).
2. Migraciones de MFA en `Usuario`: `20260917221349_add_mfa_to_users` y la
   que agrega `mfaIntentosFallidos`, `mfaBloqueadoHasta` y `mfaUltimoPaso`.
3. Node 22.12 o superior (el Dockerfile usa `node:22-alpine`): `otplib` depende
   de paquetes solo-ESM que se cargan con `require()`.
4. Cada MASTER debe configurar su MFA apenas se despliegue. Mientras no lo
   haga, quien tenga su contraseña podría registrar su propio autenticador.

## Recuperación (MASTER perdió el celular)

No hay códigos de respaldo. Después de verificar la identidad de la persona
por otro canal, alguien con acceso a la base ejecuta:

```sql
UPDATE "Usuario"
SET "mfaActivado" = false,
    "mfaSecret" = NULL,
    "mfaActivadoEn" = NULL,
    "mfaUltimoPaso" = NULL,
    "mfaIntentosFallidos" = 0,
    "mfaBloqueadoHasta" = NULL
WHERE email = '<correo del MASTER>' AND "rolGlobal" = 'MASTER';
```

En su siguiente login el sistema le pedirá configurar el MFA de nuevo.

Para levantar solo un bloqueo por intentos (sin resetear el MFA):

```sql
UPDATE "Usuario"
SET "mfaBloqueadoHasta" = NULL, "mfaIntentosFallidos" = 0
WHERE email = '<correo del MASTER>';
```
