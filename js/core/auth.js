// ═══════════════════════════════════════════════════════════
// AUTENTICACIÓN Y SESIÓN
// ═══════════════════════════════════════════════════════════

// Perfiles que requieren Supabase Auth una vez que estén migrados.
// 'taller' queda EXCLUIDO — es la pantalla de TV del taller, siempre abierta.
const PERFILES_CON_AUTH = new Set(['jefe', 'mecanico', 'repuestos', 'cliente', 'encuestador']);

// true = modo cliente (sin contraseña), false = modo staff (cédula + contraseña)
let _loginModoCliente = false;

function toggleModoCliente() {
  _loginModoCliente = !_loginModoCliente;
  const passWrap  = document.getElementById('login-pass-wrap');
  const sub       = document.getElementById('login-sub');
  const btn       = document.getElementById('login-cliente-btn');
  const passInput = document.getElementById('login-pass');

  if (_loginModoCliente) {
    passWrap.classList.add('oculto');
    if (passInput) passInput.value = '';
    if (sub)  sub.innerHTML = '<span class="login-modo-badge">Modo cliente</span><br>Ingresa tu cédula para ver el estado de tu vehículo';
    if (btn)  btn.textContent = '← Volver al acceso del taller';
  } else {
    passWrap.classList.remove('oculto');
    if (sub)  sub.textContent = 'Ingresa tus credenciales para continuar';
    if (btn)  btn.textContent = '¿Eres cliente? Consulta tu vehículo sin contraseña →';
  }
  document.getElementById('login-error').classList.remove('show');
}

function toggleLoginPass() {
  const input = document.getElementById('login-pass');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  // En minúsculas: el correo de acceso y las reglas de seguridad usan el usuario
  // en minúsculas (Supabase normaliza el correo). Así "Repuestos" y "repuestos"
  // entran igual. Para cédulas numéricas no cambia nada.
  const cedula    = document.getElementById('login-cedula').value.trim().toLowerCase();
  const password  = document.getElementById('login-pass')?.value || '';

  if (!cedula) { mostrarErrorLogin('Ingresa tu número de cédula.'); return; }

  // Sin contraseña: solo permitir si es perfil taller (pantalla TV, siempre abierta)
  if (!_loginModoCliente && !password) {
    const tp = await detectarPerfil(cedula).catch(() => null);
    if (tp?.perfil === 'taller') { iniciarSesion({ ...tp, cedula }); return; }
    mostrarErrorLogin('Ingresa tu contraseña.');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Verificando...';
  document.getElementById('login-error').classList.remove('show');

  try {
    // ── MODO CLIENTE: solo cédula, sin contraseña ─────────────────────
    if (_loginModoCliente) {
      const perfil = await detectarPerfil(cedula);
      if (!perfil) {
        mostrarErrorLogin('No encontramos ninguna cuenta con esa cédula. Contacta al taller.');
        return;
      }
      if (perfil.perfil !== 'cliente') {
        mostrarErrorLogin('Esta cédula corresponde a personal del taller. Usa el acceso normal con contraseña.');
        return;
      }
      iniciarSesion({ ...perfil, cedula });
      return;
    }

    // ── MODO STAFF: cédula + contraseña vía Supabase Auth ─────────────
    const authData = await supabaseLogin(cedula, password);

    if (authData?.access_token) {
      sesion = { access_token: authData.access_token };
      const perfil = await detectarPerfil(cedula);
      if (perfil) {
        iniciarSesion({
          ...perfil,
          cedula,
          access_token:  authData.access_token,
          refresh_token: authData.refresh_token,
          expires_at:    Date.now() + (authData.expires_in ?? 3600) * 1000
        });
        return;
      }
      sesion = null;
    }

    // ── Excepción: perfil taller (pantalla TV) siempre entra ──────────
    const perfil = await detectarPerfil(cedula);
    if (perfil?.perfil === 'taller') {
      iniciarSesion({ ...perfil, cedula });
      return;
    }

    mostrarErrorLogin('Cédula o contraseña incorrectos. Contacta al administrador del taller.');
  } catch(e) {
    sesion = null;
    mostrarErrorLogin('Error de conexión. Intenta de nuevo.');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
}

// Determina perfil y datos del usuario a partir de la cédula.
// Usa la función segura `detectar_perfil` (SECURITY DEFINER) en vez de leer las
// tablas directamente: así el visitante anónimo NO necesita acceso a
// configuracion/mecanicos/roles_config/clientes (esas tablas quedan cerradas).
async function detectarPerfil(cedula) {
  const ced = String(cedula || '').trim();
  if (!ced) return null;
  const r = await api('/rpc/detectar_perfil', 'POST', { p_cedula: ced }).catch(() => null);
  return r || null;
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.classList.add('show');
}

let _tokenRefreshInterval = null;

// La sesión vive en sessionStorage (propia de CADA pestaña → puedes tener
// gerente en una pestaña y repuestos en otra sin que se pisen). En localStorage
// guardamos un respaldo de la ÚLTIMA sesión para NO sacar al usuario al cerrar y
// reabrir la app (PWA): una pestaña nueva sin sesión propia adopta ese respaldo.
const _SESION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

function _guardarSesion(datos) {
  const payload = JSON.stringify({ datos, guardadoEn: Date.now() });
  try { sessionStorage.setItem('sesion_freiman', payload); } catch(e) {}
  try { localStorage.setItem('sesion_freiman', payload); } catch(e) {}
}
function _leerSesionGuardada() {
  let raw = null;
  try { raw = sessionStorage.getItem('sesion_freiman'); } catch(e) {}
  if (!raw) {
    try { raw = localStorage.getItem('sesion_freiman'); } catch(e) {}
    if (raw) { try { sessionStorage.setItem('sesion_freiman', raw); } catch(e) {} }
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Soporte para formato antiguo (sin wrapper guardadoEn)
    if (!parsed.guardadoEn) return raw;
    if (Date.now() - parsed.guardadoEn > _SESION_TTL_MS) {
      // Sesión expirada por tiempo — limpiar ambos storages
      try { localStorage.removeItem('sesion_freiman'); } catch(e) {}
      try { sessionStorage.removeItem('sesion_freiman'); } catch(e) {}
      return null;
    }
    return JSON.stringify(parsed.datos);
  } catch(e) { return raw; }
}

function iniciarSesion(datos) {
  sesion = datos;
  _guardarSesion(datos);
  _iniciarRefreshPeriodico();
  montarApp();
}

// Refresca el token cada 45 minutos para evitar que expire (dura 1 hora)
function _iniciarRefreshPeriodico() {
  if (_tokenRefreshInterval) clearInterval(_tokenRefreshInterval);
  if (!sesion?.refresh_token) return;
  _tokenRefreshInterval = setInterval(async () => {
    if (!sesion?.refresh_token) { clearInterval(_tokenRefreshInterval); return; }
    await refrescarToken();
  }, 45 * 60 * 1000); // cada 45 minutos
}

async function logout() {
  // Detener timers antes de limpiar la sesión
  if (_tokenRefreshInterval) { clearInterval(_tokenRefreshInterval); _tokenRefreshInterval = null; }
  if (typeof detenerRealtime === 'function') detenerRealtime();
  if (typeof detenerSistemaAlertas === 'function') detenerSistemaAlertas();
  if (sesion?.access_token) await supabaseSignOut(sesion.access_token);
  localStorage.removeItem('sesion_freiman');
  sessionStorage.removeItem('sesion_freiman'); // limpiar también el viejo
  sesion = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('pantalla-login').style.display = 'flex';
  document.getElementById('login-cedula').value = '';
  document.getElementById('login-error').classList.remove('show');
}

async function checkSesionGuardada() {
  try {
    // Prefiere la sesión propia de esta pestaña (sessionStorage); si no hay,
    // adopta el respaldo persistente (localStorage).
    const s = _leerSesionGuardada();
    if (!s) return;
    sesion = JSON.parse(s);

    // Renovar token si le quedan menos de 5 minutos de vida. Si la renovación
    // falla (p. ej. sin internet momentáneo) NO se cierra la sesión: se entra
    // igual y el refresco periódico lo reintenta solo. Así no saca al usuario.
    if (sesion.refresh_token && sesion.expires_at) {
      const minutosRestantes = (sesion.expires_at - Date.now()) / 60000;
      if (minutosRestantes < 5) { try { await refrescarToken(); } catch(e) {} }
    }

    _iniciarRefreshPeriodico(); // mantener el token vivo tras restaurar la sesión
    montarApp();
  } catch(e) {
    localStorage.removeItem('sesion_freiman');
    sessionStorage.removeItem('sesion_freiman');
  }
}

async function refrescarToken() {
  if (!sesion?.refresh_token) return false;
  const data = await supabaseRefreshToken(sesion.refresh_token);
  if (!data?.access_token) return false;
  sesion.access_token  = data.access_token;
  sesion.refresh_token = data.refresh_token;
  sesion.expires_at    = Date.now() + (data.expires_in ?? 3600) * 1000;
  _guardarSesion(sesion);
  return true;
}
