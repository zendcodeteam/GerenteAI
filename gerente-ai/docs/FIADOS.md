# Fiados y abonos

Cómo queda registrada una venta a crédito, cómo se cobra y qué hay que correr
una sola vez sobre los datos que ya existen.

## El criterio: base caja

Una venta fiada **no es un ingreso**. Es una cuenta por cobrar. El ingreso nace
el día en que el cliente paga.

```
"Le fié $300.000 a doña Rosa"   -> Venta FIADO, saldoPendiente 300.000
                                   Cliente.saldoPendiente += 300.000
                                   NO suma a los ingresos

"Doña Rosa me abonó $100.000"   -> Abono de 100.000 con la fecha del pago
                                   Venta.saldoPendiente  -> 200.000
                                   Cliente.saldoPendiente -> 200.000
                                   SÍ suma a los ingresos, como "cobros"

"Doña Rosa ya me pagó todo"     -> Abonos hasta saldar sus ventas abiertas
                                   Venta.saldoPendiente  -> 0
                                   Cliente.saldoPendiente -> 0
                                   deja de ser cuenta por cobrar
```

Mezclar las dos cosas —contar el fiado como ingreso— es el error más común al
llevar las cuentas a mano: infla los ingresos y da un balance que no cuadra con
la plata que hay en el cajón.

## Dónde vive cada cosa

| Dato | Tabla | Quién lo escribe |
|---|---|---|
| Lo que se vendió a crédito | `Venta.total` | no cambia nunca |
| Lo que falta por cobrar de esa venta | `Venta.saldoPendiente` | baja con cada abono |
| Lo que el cliente debe en total | `Cliente.saldoPendiente` | espeja la suma de sus ventas abiertas |
| Cada pago recibido | `Abono` | uno por venta que salda |

`Venta.saldoPendiente` es lo que permite calcular la **antigüedad** de la deuda:
`Cliente.saldoPendiente` dice cuánto debe, pero no desde cuándo.

El plazo estándar es de **30 días desde la fecha de la venta**. El recordatorio
automático se programa cuando faltan cinco días o menos para el vencimiento; los
avisos ya guardados en `RecordatorioFiado` no se vuelven a enviar.

Un pago se reparte **de la venta más antigua a la más reciente**. Si no, un
fiado viejo se quedaría abierto para siempre mientras se abonan los recientes.

## Backfill: fiados registrados antes de este arreglo

Hasta la versión `asistente-whatsapp/v10`, cuando Luka registraba un fiado
creaba la `Venta` con su `saldoPendiente` pero **no incrementaba
`Cliente.saldoPendiente`**. Los dos números quedaron desalineados: el reporte de
fiados del panel y la hoja "Cuentas por cobrar" del Excel leen el del cliente, y
por eso mostraban cero.

Esto lo deja bien, y se corre **una sola vez** contra la base de Neon:

```sql
UPDATE "Cliente" c
SET "saldoPendiente" = COALESCE(
  (
    SELECT SUM(v."saldoPendiente")
    FROM "Venta" v
    WHERE v."clienteId" = c.id
      AND v."saldoPendiente" > 0
  ),
  0
);
```

Antes de correrlo, para ver a quiénes va a afectar:

```sql
SELECT c.nombre,
       c."saldoPendiente" AS segun_cliente,
       COALESCE(SUM(v."saldoPendiente"), 0) AS segun_ventas
FROM "Cliente" c
LEFT JOIN "Venta" v
  ON v."clienteId" = c.id AND v."saldoPendiente" > 0
GROUP BY c.id, c.nombre, c."saldoPendiente"
HAVING c."saldoPendiente" <> COALESCE(SUM(v."saldoPendiente"), 0);
```

Si la segunda consulta no devuelve filas, no hace falta correr la primera.

No es una migración de esquema: no cambia ninguna tabla, solo recalcula un
campo. No hay que tocar `prisma db push`.

La migración `20261105130000_payment_plans_and_credit_due_dates` asigna a los
fiados históricos que no tienen vencimiento la fecha de venta más 30 días. No
borra sus registros de `RecordatorioFiado`, por lo que un aviso ya enviado no se
repite. Se aplica junto con el resto de migraciones con `npx prisma migrate deploy`.

## Recomendaciones de IA

`getSnapshot` entrega al modelo, por cliente: cuánto debe, cuánto ya abonó,
cuántos días lleva la deuda y hace cuánto no paga. Con eso las recomendaciones
del panel pueden decir "Rosa te debe $200.000 desde hace 47 días y no ha abonado
nada" en vez de "tienes cartera vencida", que no le sirve a nadie porque no dice
a quién llamar.
