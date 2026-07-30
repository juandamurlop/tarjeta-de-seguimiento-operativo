// ─────────────────────────────────────────────────────────────
// OCR de tarjeta de propiedad — Supabase Edge Function (sin n8n)
// Usa OpenAI gpt-4o (visión): máxima precisión leyendo VIN, cédula y NIT.
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
// gpt-4o (completo): lee mucho mejor el texto fino (VIN, cédula, NIT) que el
// gpt-4o-mini. Cuesta un poco más por foto, pero la precisión es la prioridad.
const MODELO = "gpt-4o";

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

// Verifica que quien llama sea un USUARIO AUTENTICADO (personal del taller),
// no la llave 'anon' pública ni un anónimo. Evita que cualquiera de afuera
// gaste el saldo de OpenAI. Devuelve true si el token es de un usuario real.
async function esUsuarioAutenticado(req: Request): Promise<boolean> {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  // Sin token, o es exactamente la llave pública anon → no autorizado.
  if (!token || token === SB_ANON) return false;
  try {
    // Valida la firma del token contra Supabase Auth; solo pasa un usuario real.
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return false;
    const u = await r.json().catch(() => null);
    return !!(u && u.id && (u.role === "authenticated" || u.aud === "authenticated"));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!(await esUsuarioAutenticado(req))) return json({ error: "No autorizado" }, 401);

    const { imagen, tipo } = await req.json();
    if (!imagen) return json({ error: "Falta la imagen" }, 400);
    if (!OPENAI_KEY) return json({ error: "Falta el secreto OPENAI_API_KEY" }, 500);

    const prompt =
      "Eres un extractor EXPERTO de datos de TARJETAS DE PROPIEDAD de vehículos de Colombia. " +
      "Lee la imagen con MÁXIMO cuidado, carácter por carácter, y devuelve SOLO un JSON válido con estas " +
      "claves (todas string; usa '' si no aparece el dato): " +
      "placa, marca, linea, modelo, color, vin, propietario, documento, tipo_documento. " +
      "" +
      "PLACA: en MAYÚSCULAS, formato colombiano (3 letras + 3 dígitos, p.ej. ABC123). " +
      "" +
      "MODELO: el AÑO del vehículo, exactamente 4 dígitos (p.ej. 2019). " +
      "" +
      "LINEA: la referencia o versión del vehículo (p.ej. SPARK GT, SANDERO, TITAN). " +
      "" +
      "VIN (número de chasis/serie): EXACTAMENTE 17 caracteres alfanuméricos en MAYÚSCULAS. " +
      "NUNCA contiene I, O ni Q: si ves 'I' es '1', si ves 'O' es '0'. " +
      "En la tarjeta puede aparecer como 'No. Serie', 'Chasis', 'No. Chasis', 'VIN' o 'No. Motor'. " +
      "Si el campo tiene más de 17 caracteres, toma solo los 17 alfanuméricos principales. " +
      "Si tienes menos de 17 caracteres o no estás seguro, ponlos tal como los ves (no inventes). " +
      "" +
      "PROPIETARIO: nombre completo tal como aparece en la tarjeta (persona o razón social). " +
      "" +
      "DOCUMENTO: número de identificación del propietario. " +
      "- Si es cédula de ciudadanía (persona natural): solo los dígitos, sin puntos ni espacios. " +
      "- Si es NIT (empresa/persona jurídica): solo los dígitos sin guion ni dígito de verificación. " +
      "Léelo dígito a dígito con máximo cuidado; confundir 1/7, 5/6, 8/3 es un error grave. " +
      "" +
      "TIPO_DOCUMENTO: 'CC' si es cédula de ciudadanía (persona natural), 'NIT' si es empresa. " +
      "" +
      "No agregues texto, explicaciones ni comentarios fuera del JSON. " +
      "Devuelve SIEMPRE un JSON con exactamente esas 9 claves, aunque estén vacías.";

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
