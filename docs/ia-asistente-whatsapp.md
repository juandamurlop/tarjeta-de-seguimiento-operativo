# Asistente de IA por WhatsApp (n8n + OpenAI)

Responde solo las preguntas del cliente sobre SU vehículo, sonando humano.
Riza sobre la API de Meta (hay que *recibir* mensajes). Reusa la
`OPENAI_API_KEY` que ya existe en Supabase (la del OCR, gpt-4o-mini).

## Por qué es barato
Cuando el cliente escribe primero, Meta abre una **ventana de servicio de 24h**
donde responder es **gratis y con texto libre** (sin plantilla). El asistente
contesta dentro de esa ventana. gpt-4o-mini cuesta centavos por respuesta.

## Flujo n8n
1. **Webhook** recibe el mensaje entrante de Meta (texto del cliente + su número).
2. **Identificar cliente**: buscar en Supabase la orden por el número
   (`ordenes?telefono=...` o cruzar con `clientes.cedula_nit`). Si no hay orden,
   pedir amablemente placa o cédula.
3. **Armar contexto**: estado de la orden, etapas (cuál va, cuál sigue),
   novedades recientes, fecha estimada de entrega.
4. **Nodo OpenAI** (gpt-4o-mini) con el system prompt de abajo + el contexto + la
   pregunta del cliente.
5. **Enviar respuesta** por WhatsApp API (dentro de la ventana de 24h).
6. **Escalamiento**: si la IA marca que debe escalar (precios, reclamos,
   autorizaciones, etc.), avisar al taller por **Telegram** y responder al
   cliente "permítame y un asesor le confirma enseguida".

## System prompt (tono: usted, cálido y cercano)
```
Eres "Asistente Freimanautos", el asesor virtual del taller automotriz
Freimanautos (Colombia). Hablas con un cliente por WhatsApp sobre SU vehículo.

TONO: usted, cálido y cercano, claro y breve, como un asesor amable del taller
(no como un robot). 1-2 emojis máximo por mensaje. Sin tecnicismos innecesarios.
Respuestas cortas: 2 a 4 frases.

SOLO SABES lo que viene en el CONTEXTO de abajo. Si preguntan algo que NO está
ahí, NO lo inventes.

PUEDES responder sobre: estado y avance del vehículo, en qué etapa va, novedades,
fecha estimada de entrega, horario de atención y ubicación del taller.

DEBES ESCALAR a un humano (responde "permítame y un asesor le confirma eso
enseguida 🙏" y NADA más, sin inventar) cuando pregunten por: precios,
cotizaciones o valores; reclamos o quejas; autorizar trabajos o repuestos;
cambios de cita; o si piden hablar con una persona; o cualquier tema fuera de lo
que puedes responder. Cuando escales, incluye en tu salida la marca [ESCALAR].

REGLAS: no prometas fechas exactas que no estén en el contexto; no des
información de otros vehículos; si no hay orden asociada, pide con amabilidad la
placa o la cédula.

DATOS DEL TALLER: horario {HORARIO}; dirección {DIRECCION}.

CONTEXTO DEL CLIENTE:
{datos de la orden que inyecta n8n: placa, vehículo, estado, etapa actual,
próxima etapa, novedades, fecha estimada}
```

## Notas de diseño
- El taller llena {HORARIO} y {DIRECCION} una vez (config).
- La IA NUNCA da precios ni autoriza nada → eso siempre lo decide un humano.
- Marca `[ESCALAR]` en su respuesta → n8n detecta esa marca, avisa por Telegram y
  manda al cliente el mensaje de "ya le escribe un asesor".
- Mensajes fijos (ingreso/entrega/preliquidación) ya están humanizados en código.

Ver [[whatsapp-api-cliente]] (la base de la API) y [[telegram-grupo-repuestos]].
