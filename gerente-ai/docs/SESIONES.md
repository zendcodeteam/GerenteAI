# Sesiones y enlaces de recuperación

## Enlace de recuperación: un solo uso

El correo de "Olvidé mi contraseña" lleva un JWT de una hora. Antes servía
todas las veces que uno quisiera dentro de esa hora: si el correo se reenviaba,
quedaba en un buzón compartido o alguien lo interceptaba, se podía volver a
entrar a la cuenta.

Ahora el token incluye `pwd`, una huella (SHA-256 recortado) del **hash de la
contraseña vigente cuando se pidió el enlace**. Al usarlo, la contraseña
cambia, el hash cambia y la huella deja de coincidir, así que:

- El mismo enlace no sirve dos veces.
- Pedir un enlace nuevo invalida los anteriores.
- Un enlace queda muerto si la contraseña cambió por cualquier otro camino.

No hace falta guardar los tokens usados en la base. La huella es del hash, no
de la contraseña, y va recortada: el payload de un JWT se lee sin ninguna clave,
así que ahí no puede viajar nada que sirva para atacar el hash.

El cambio se escribe con la contraseña vieja en el `WHERE`, de modo que dos
peticiones simultáneas con el mismo enlace no puedan aplicarse las dos.

**Al desplegar:** los enlaces que ya estén en el correo de alguien dejan de
funcionar, porque no llevan la huella. Como duran una hora, basta con pedir uno
nuevo.

## Cambiar la contraseña cierra las sesiones abiertas

`Usuario.passwordChangedAt` guarda la fecha del último cambio, y `JwtStrategy`
la compara contra la fecha de emisión (`iat`) de cada token de sesión: lo
firmado antes se rechaza con 401. Si alguien entró con la contraseña vieja,
cambiarla lo echa de inmediato en vez de dejarlo dentro hasta que su token
expire solo (un día).

Detalles:

- **Nadie pierde la sesión por desplegar esto.** Quien nunca ha cambiado su
  contraseña tiene la fecha vacía y sus tokens siguen valiendo.
- **Quien cambia la contraseña también sale**, incluida la pestaña desde la que
  lo hizo. Es lo correcto: no se sabe cuál de las sesiones abiertas es del
  intruso. El frontend ya maneja el 401 mandando al login.
- `iat` viene en segundos, así que la comparación es por segundos cumplidos: un
  token firmado en el mismo segundo del cambio se acepta. Sin esa holgura,
  cambiar la contraseña e iniciar sesión un instante después dejaría fuera a la
  sesión recién creada.
- El re-hasheo de la contraseña durante el login (cuando venía con un factor
  bajo) **no** toca `passwordChangedAt`: la contraseña es la misma y nadie
  debería salirse por eso.

## Costo

`JwtStrategy` hace una lectura del usuario por petición autenticada (por id,
indexada). Es el precio de poder revocar una sesión al instante: guardarlo en
memoria haría que la expulsión tardara, y con varias réplicas cada una
expulsaría a destiempo.

## Qué no cubre

Los tokens de verificación de correo y de cambio de correo siguen siendo
reutilizables dentro de su vigencia. No abren sesión (`JwtStrategy` solo acepta
`type: 'session'`), pero si algún día se quiere que también sean de un solo uso,
sirve la misma idea de la huella.
