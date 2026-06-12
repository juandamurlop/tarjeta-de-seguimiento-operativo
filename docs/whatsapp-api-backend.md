# WhatsApp Business API (Meta Cloud) — Backend listo

Blueprint para activar de golpe cuando lleguen las credenciales de Meta.
Mientras tanto **no cambia nada en la operación**. Ver memoria `whatsapp-api-cliente`.

## 0. Lo que falta para activar (de Meta)
- `PHONE_NUMBER_ID` (pantalla WhatsApp → API Setup)
- `WABA_ID`
- `ACCESS_TOKEN` permanente (System User) → va **en credenciales de n8n**, no en el repo
- `VERIFY_TOKEN` (lo inventas tú; se usa para validar el webhook con Meta)

## 1. Base de datos
Ejecutar `docs/sql-confirmacion-repuesto.sql`. Agrega a `solicitudes_repuesto`:
`cliente_respuesta` (null|pendiente|aceptado|rechazado), `confirmacion_enviada_por`,
`confirmacion_enviada_en`, `cliente_respondio_en`, `confirmacion_wamid`.

## 2. Plantillas Meta (categoría Utilidad)
**ingreso_vehiculo** — cuerpo con {{1}}=nombre, {{2}}=vehículo, {{3}}=placa, y botón URL
dinámico "Ver mi vehículo" → `https://freimanautos-web-seguimiento-operativo.qs0sgf.easypanel.host/?cliente={{1}}` (var = cédula).

**confirmar_repuesto** — cuerpo {{1}}=nombre, {{2}}=vehículo, {{3}}=placa, {{4}}=repuesto,
{{5}}=valor; botones de respuesta rápida: `✅ Sí, autorizo` y `❌ No autorizo`.

## 3. n8n — FLUJO DE ENVÍO (app → n8n → Meta)
La app hará POST al webhook (mismo patrón que hoy) con `evento`:

- **aviso_ingreso** (automático al crear orden): nombre, vehiculo, placa, cedula.
  → HTTP POST `https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`
    header `Authorization: Bearer {ACCESS_TOKEN}`, body template `ingreso_vehiculo` con sus componentes.

- **confirmar_repuesto** (manual, botón jefe/gerente): solicitud_id, nombre, vehiculo, placa,
  repuesto, valor, telefono_cliente, enviada_por.
  → HTTP POST a Meta con template `confirmar_repuesto`.
  → De la respuesta de Meta se obtiene el `wamid` (messages[0].id).
  → PATCH `solicitudes_repuesto?id=eq.{solicitud_id}`:
    `cliente_respuesta='pendiente'`, `confirmacion_enviada_por`, `confirmacion_enviada_en=now`,
    `confirmacion_wamid={wamid}`.

## 4. n8n — FLUJO DE RECEPCIÓN (Meta webhook → n8n → Supabase → Telegram)
Registrar en Meta el webhook → URL de un Webhook node de n8n (GET para verify con `VERIFY_TOKEN`,
POST para eventos).
1. Llega la respuesta del botón. Extraer:
   - `wamid_origen` = `entry[].changes[].value.messages[].context.id`  (id del mensaje que enviamos)
   - `respuesta` = texto/payload del botón (`✅ Sí, autorizo` / `❌ No autorizo`)
2. Buscar la solicitud: `solicitudes_repuesto?confirmacion_wamid=eq.{wamid_origen}`.
3. PATCH: `cliente_respuesta = aceptado|rechazado`, `cliente_respondio_en = now`.
4. **Si rechazado** → enviar Telegram (gratis, mismo bot) a los 3 del taller:
   jefe, asesora, gerente — con placa, repuesto y "el cliente NO autorizó, decidan qué hacer".
   (Definir los 3 chat IDs; reutiliza el patrón del grupo de procesos/repuestos.)

## 5. App (se construye al activar; HOY no se toca)
- Disparador `aviso_ingreso` al crear la orden (en el guardado de orden nueva).
- Botón "📲 Pedir confirmación al cliente" en la vista del jefe de repuestos,
  protegido con `esJefe()` (ya incluye gerente). Setea estado y hace POST `confirmar_repuesto`.
- Mostrar estado: Sin enviar → Enviado, esperando… → ✅ Aceptó / ❌ Rechazó
  (lee `cliente_respuesta`).
- Posible config nueva: `CONFIG.N8N_WEBHOOK_WHATSAPP` (o reusar el webhook actual con los
  eventos nuevos).

## 6. Correlación (importante)
La respuesta del cliente se liga a la solicitud por `context.id` (wamid del mensaje enviado),
guardado en `confirmacion_wamid`. Por eso el flujo de envío DEBE guardar ese id.
