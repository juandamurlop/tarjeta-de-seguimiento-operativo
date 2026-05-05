// ═══════════════════════════════════════════════════════════
// CONEXIÓN A SUPABASE
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://xjavnpwuhpmvpjdbjdeg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYXZucHd1aHBtdnBqZGJqZGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njc5MDcsImV4cCI6MjA5MjQ0MzkwN30.07f6cGVrFhtm-B-I7iBLaHnPSuozFDpEf9vOHrliGRs';
const BUCKET = 'fotos-etapas';
const N8N_WEBHOOK = 'https://automatizacionesfreimanautos-n8n.qs0sgf.easypanel.host/webhook/notificar-etapa';

async function api(path, method = 'GET', body = null, extra = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...extra }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(SUPABASE_URL + '/rest/v1' + path, opts);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || res.statusText); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function storageUpload(file, path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Error subiendo foto'); }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}