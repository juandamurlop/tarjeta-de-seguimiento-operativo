// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — Plantilla para nuevo entorno
// 1. Copia este archivo como: js/config.js
// 2. Rellena los valores reales
// 3. Nunca subas config.js al repositorio
// ═══════════════════════════════════════════════════════════

const CONFIG = {
  // Supabase — obtén estos valores en: supabase.com → Settings → API
  SUPABASE_URL: 'https://TU_PROYECTO.supabase.co',
  SUPABASE_KEY: 'TU_ANON_KEY',
  BUCKET: 'fotos-etapas',

  // Webhooks n8n — URLs de tus workflows
  N8N_WEBHOOK_ETAPA:    'https://TU_N8N/webhook/notificar-etapa',
  N8N_WEBHOOK_PDF:      'https://TU_N8N/webhook/cotizacion-pdf',
  N8N_WEBHOOK_REPUESTO: 'https://TU_N8N/webhook/notificar-etapa',
};
