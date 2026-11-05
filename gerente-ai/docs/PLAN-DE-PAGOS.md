# Plan de pagos de una deuda con proveedor

Cómo se calcula el calendario de cuotas de una `DeudaProveedor` (SCRUM-36):
fecha y valor de cada cuota, con o sin interés.

El plan **no se guarda**: se calcula al consultarlo con
`GET /deudas-proveedores/:id/plan`, a partir de los datos de la deuda. Tiene el
mismo control de acceso que `GET /deudas-proveedores/:id`.

> **Ojo con las dos cuentas por pagar.** Hay dos modelos y no son lo mismo:
>
> | Modelo | De dónde nace | ¿Plan guardado? |
> |---|---|---|
> | `CuentaPorPagarProveedor` | Una compra a crédito (`POST /compras` con proveedor y vencimiento) | Sí, en `CuotaPorPagarProveedor` |
> | `DeudaProveedor` | El usuario marca un suministro como pendiente de pago | No, se calcula al vuelo |
>
> Las dos usan la misma función, [calcularPlanDePagos](../src/services/plan-pagos-proveedor.ts).
> Si el plan de una `DeudaProveedor` debe guardarse (por ejemplo para marcar qué
> cuotas ya se avisaron, SCRUM-39), eso es una tabla nueva y cambia el esquema:
> requiere review del ingeniero de BD.

---

## Las reglas

| Regla | Qué hace |
|---|---|
| Pago único | Una sola cuota por el total, que vence en `fechaLimite`. |
| Cuotas | `numeroCuotas` cuotas mensuales iguales; la suma de las cuotas es el total a pagar. |
| Interés | Solo si `aplicaInteres`. El `porcentajeInteres` es **mensual y se cobra sobre el saldo pendiente** (cuota fija, como un crédito). Sin interés, el capital se reparte parejo. |
| Pago único con interés | Lleva un período del porcentaje: 1.000.000 al 2 % da 1.020.000. |
| Redondeo | Dos decimales; la **última cuota absorbe el residuo** para que la suma cuadre exacto. |
| Fechas | `fechaLimite` es la fecha de la **última** cuota. Las anteriores van un mes antes cada una. |
| Fin de mes | El día siempre se toma de `fechaLimite` y se recorta si el mes no lo tiene (30 abr → 28 feb, 29 feb en año bisiesto). El recorte de un mes no se arrastra al siguiente. |

## Un ejemplo

1.000.000 en 3 cuotas, 2 % mensual, `fechaLimite` el 31 de diciembre de 2026:

| Cuota | Vence | Capital | Interés | Valor |
|---|---|---|---|---|
| 1 | 2026-10-31 | 326.754,67 | 20.000,00 | 346.754,67 |
| 2 | 2026-11-30 | 333.289,76 | 13.464,91 | 346.754,67 |
| 3 | 2026-12-31 | 339.955,57 | 6.799,11 | 346.754,68 |

Total a pagar: 1.040.264,02, de los cuales 40.264,02 son interés. La cuota 3 es
un centavo mayor porque absorbe el redondeo.

## La respuesta del endpoint

```json
{
  "deudaId": "…",
  "capital": 1000000,
  "interesTotal": 40264.02,
  "total": 1040264.02,
  "cuotas": [
    { "numero": 1, "fechaVencimiento": "2026-10-31T12:00:00.000Z", "capital": 326754.67, "interes": 20000, "monto": 346754.67 }
  ]
}
```

Las fechas conservan la hora de `fechaLimite`; para mostrarlas basta el día
calendario en UTC (`toISOString().slice(0, 10)`).

---

## Pendiente de confirmar con negocio

La regla de interés (mensual sobre saldo) es la que ya usa el plan de las
compras a crédito. El criterio de SCRUM-36 pide que esté **acordada con
negocio**: mientras no haya confirmación, esta es la regla vigente, no una
decisión cerrada.

- **Mensual o total.** `porcentajeInteres` se interpreta como mensual. Si negocio
  lo entiende como un porcentaje sobre todo el plazo, cambia el resultado.
- **Cuotas en el pasado.** Como las fechas se cuentan hacia atrás desde
  `fechaLimite`, con pocos días de plazo y muchas cuotas las primeras caen antes
  de hoy (en el ejemplo, la cuota 1 vence el 31 de octubre, y hoy es noviembre).
  Hoy el plan las devuelve tal cual; quien lo muestre (SCRUM-37) debe avisar o
  pedir otra fecha.
- **Sin validación de la fecha.** Los DTO de deuda no validan que `fechaLimite`
  sea una fecha válida ni que `porcentajeInteres` tenga tope. Una fecha inválida
  llega hasta Prisma y falla allí.
