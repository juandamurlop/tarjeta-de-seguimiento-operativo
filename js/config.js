// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN DEL ENTORNO
// Versionado en el repo para que cada deploy de EasyPanel lo incluya.
// La clave SUPABASE_KEY es la 'anon' pública (viaja al navegador); la
// seguridad real va por las políticas RLS de Supabase, no por ocultarla.
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Supabase — Settings → API
  SUPABASE_URL: 'https://xjavnpwuhpmvpjdbjdeg.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqYXZucHd1aHBtdnBqZGJqZGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njc5MDcsImV4cCI6MjA5MjQ0MzkwN30.07f6cGVrFhtm-B-I7iBLaHnPSuozFDpEf9vOHrliGRs',
  BUCKET: 'fotos-etapas',

  // Webhooks n8n (notificaciones Telegram / PDF).
  // TODO: reemplazar por las URLs reales de n8n. Mientras tanto, las
  // notificaciones quedan inactivas, pero la app funciona normalmente.
  N8N_WEBHOOK_ETAPA:    'https://n8n.invalid/webhook/notificar-etapa',
  N8N_WEBHOOK_PDF:      'https://n8n.invalid/webhook/cotizacion-pdf',
  N8N_WEBHOOK_REPUESTO: 'https://n8n.invalid/webhook/notificar-etapa',
};
