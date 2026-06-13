// ═══════════════════════════════════════════════════════════
// CONEXIÓN A SUPABASE — valores definidos en js/config.js
// ═══════════════════════════════════════════════════════════
const SUPABASE_URL = CONFIG.SUPABASE_URL;
const SUPABASE_KEY = CONFIG.SUPABASE_KEY;
const BUCKET       = CONFIG.BUCKET;
const N8N_WEBHOOK  = CONFIG.N8N_WEBHOOK_ETAPA;
const API_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]);

// ═══════════════════════════════════════════════════════════
// SUPABASE AUTH
// ═══════════════════════════════════════════════════════════

// Retorna { access_token, refresh_token, expires_in } o null si falla
async function supabaseLogin(cedula, password) {
  try {
    // Exige contraseña real. Antes caía a `password || cedula` (la cédula como
    // contraseña), lo que permitía entrar conociendo solo la cédula. Eliminado.
    if (!password) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ email: `${cedula}@freimanautos.com`, password })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function supabaseSignOut(accessToken) {
  if (!accessToken) return;
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` }
  }).catch(() => {});
}

// Crea una cuenta nueva en Supabase Auth (primer login de un cliente).
// Retorna el objeto de sesión o null si falla (ej: cuenta ya existe).
async function supabaseSignUp(cedula) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({
        email: `${cedula}@freimanautos.com`,
        password: cedula,
        data: { perfil: 'cliente' }
      })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Retorna nuevos tokens o null si el refresh_token expiró
async function supabaseRefreshToken(refreshToken) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Devuelve el token activo: JWT del usuario si existe, anon key si no
function _getBearer() {
  return (typeof sesion !== 'undefined' && sesion?.access_token)
    ? sesion.access_token
    : SUPABASE_KEY;
}

// ═══════════════════════════════════════════════════════════
// VALIDACIONES
// ═══════════════════════════════════════════════════════════
function validarApiPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\r\n]/.test(path)) {
    throw new Error('Ruta de API invalida');
  }
  return path;
}

function extensionSegura(file) {
  const porMime = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf'
  };
  return porMime[file.type] || '';
}

function validarArchivo(file) {
  if (!file) throw new Error('Archivo invalido');
  if (!ALLOWED_UPLOAD_MIME.has(file.type)) throw new Error('Tipo de archivo no permitido');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Archivo demasiado grande. Maximo 10 MB');
}

function normalizarStoragePath(file, path) {
  const ext = extensionSegura(file);
  if (!ext) throw new Error('Extension de archivo no permitida');
  const limpio = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .map(p => p.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/');
  if (!limpio || limpio.includes('..')) throw new Error('Ruta de archivo invalida');
  return limpio.replace(/\.[^./]+$/, `.${ext}`);
}

// ═══════════════════════════════════════════════════════════
// API — usa JWT del usuario cuando está disponible
// ═══════════════════════════════════════════════════════════
async function api(path, method = 'GET', body = null, extra = {}) {
  const verb = String(method || 'GET').toUpperCase();
  if (!API_METHODS.has(verb)) throw new Error('Metodo no permitido');

  const _buildOpts = () => ({
    method: verb,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${_getBearer()}`,
      ...extra
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const _exec = async () => {
    const res = await fetch(SUPABASE_URL + '/rest/v1' + validarApiPath(path), _buildOpts());
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = String(err.message || err.error_description || res.statusText || '');
      // Devuelve el mensaje y el status para que el llamador decida
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  try {
    return await _exec();
  } catch (err) {
    // Si el JWT expiró → intentar refrescar y reintentar UNA vez
    const esJwtExp = err.status === 401
      || /jwt expired|invalid jwt|jwt/i.test(err.message);

    if (esJwtExp && typeof sesion !== 'undefined' && sesion?.refresh_token) {
      const ok = typeof refrescarToken === 'function' ? await refrescarToken() : false;
      if (ok) return await _exec();           // Reintento con token nuevo
      // Si el refresh falla → cerrar sesión limpiamente
      if (typeof logout === 'function') await logout();
      throw new Error('Tu sesión expiró. Por favor vuelve a iniciar sesión.');
    }
    throw err;
  }
}

async function storageUpload(file, path) {
  validarArchivo(file);
  const safePath = normalizarStoragePath(file, path);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(BUCKET)}/${safePath}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${_getBearer()}`,
      'Content-Type': file.type,
      'x-upsert': 'true'
    },
    body: file
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || 'Error subiendo foto'); }
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${safePath}`;
}
