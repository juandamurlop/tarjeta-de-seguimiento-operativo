// ─────────────────────────────────────────────────────────────
// OCR de tarjeta de propiedad — Supabase Edge Function (sin n8n)
// Usa Gemini 1.5 Flash (visión): rápido, barato y preciso.
// La API key va como SECRETO del servidor, nunca en el navegador.
//
// Desplegar:
//   - Dashboard de Supabase → Edge Functions → New function → "ocr-tarjeta"
//     → pega este código → Deploy.
//   - Settings → Edge Functions → Secrets → agrega: GEMINI_API_KEY = <tu key>
//     (la key gratis se obtiene en https://aistudio.google.com/app/apikey)
//
// Recibe:  { imagen: "<base64 sin prefijo>", tipo: "image/jpeg" }
// Devuelve:{ datos: { placa, marca, linea, modelo, color, vin, propietario } }
// ─────────────────────────────────────────────────────────────

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const MODELO = "gemini-1.5-flash";

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
    if (!GEMINI_KEY) return json({ error: "Falta el secreto GEMINI_API_KEY" }, 500);

    const prompt =
      "Eres un extractor de datos de TARJETAS DE PROPIEDAD de vehículos de Colombia. " +
      "Lee la imagen y devuelve SOLO un JSON válido con estas claves (string; vacío si no aparece): " +
      "placa, marca, linea, modelo, color, vin, propietario. " +
      "'modelo' es el AÑO del vehículo. 'linea' es la referencia/línea. " +
      "La placa en mayúsculas. No agregues texto fuera del JSON.";

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: tipo || "image/jpeg", data: imagen } },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const t = await res.text();
      return json({ error: `Gemini ${res.status}: ${t.slice(0, 200)}` }, 502);
    }

    const data = await res.json();
    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let datos: Record<string, string> = {};
    try { datos = JSON.parse(texto); } catch { datos = {}; }

    return json({ datos });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
