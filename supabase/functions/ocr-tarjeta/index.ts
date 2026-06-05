// ─────────────────────────────────────────────────────────────
// OCR de tarjeta de propiedad — Supabase Edge Function (sin n8n)
// Usa OpenAI gpt-4o-mini (visión): rápido, barato y preciso.
// La API key va como SECRETO del servidor, nunca en el navegador.
//
// Desplegar:
//   - Dashboard de Supabase → Edge Functions → New function → "ocr-tarjeta"
//     → pega este código → Deploy.
//   - Settings → Edge Functions → Secrets → agrega:
//       OPENAI_API_KEY = sk-...  (tu key de platform.openai.com, con saldo)
//
// Recibe:  { imagen: "<base64 sin prefijo>", tipo: "image/jpeg" }
// Devuelve:{ datos: { placa, marca, linea, modelo, color, vin, propietario } }
// ─────────────────────────────────────────────────────────────

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const MODELO = "gpt-4o-mini";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { imagen, tipo } = await req.json();
    if (!imagen) return json({ error: "Falta la imagen" }, 400);
    if (!OPENAI_KEY) return json({ error: "Falta el secreto OPENAI_API_KEY" }, 500);

    const prompt =
      "Eres un extractor de datos de TARJETAS DE PROPIEDAD de vehículos de Colombia. " +
      "Lee la imagen y devuelve SOLO un JSON válido con estas claves (string; vacío si no aparece): " +
      "placa, marca, linea, modelo, color, vin, propietario. " +
      "'modelo' es el AÑO del vehículo. 'linea' es la referencia/línea. " +
      "La placa en mayúsculas. No agregues texto fuera del JSON.";

    const dataUrl = `data:${tipo || "image/jpeg"};base64,${imagen}`;

    const body = {
      model: MODELO,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ],
        },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      return json({ error: `OpenAI ${res.status}: ${t.slice(0, 200)}` }, 502);
    }

    const data = await res.json();
    const texto = data?.choices?.[0]?.message?.content || "{}";
    let datos: Record<string, string> = {};
    try { datos = JSON.parse(texto); } catch { datos = {}; }

    return json({ datos });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
