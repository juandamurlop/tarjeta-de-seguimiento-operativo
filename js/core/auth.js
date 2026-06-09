// ═══════════════════════════════════════════════════════════
// AUTENTICACIÓN Y SESIÓN
// ═══════════════════════════════════════════════════════════

// Perfiles que requieren Supabase Auth una vez que estén migrados.
// 'taller' queda EXCLUIDO — es la pantalla de TV del taller, siempre abierta.
const PERFILES_CON_AUTH = new Set(['jefe', 'mecanico', 'repuestos', 'cliente']);

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
  const cedula    = document.getElementById('login-cedula').value.trim();
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

// Determina perfil y datos del usuario a partir de la cédula
async function detectarPerfil(cedula) {
  // Gerente tiene prioridad máxima
  const gerenteCfg = await api(`/configuracion?clave=eq.gerente_cedula`);
  if (gerenteCfg?.[0]?.valor && gerenteCfg[0].valor === cedula) {
    const nombreGerente = (await api(`/configuracion?clave=eq.gerente_nombre`))?.[0]?.valor || 'Gerente General';
    return { perfil: 'gerente', nombre: nombreGerente, id: null };
  }

  const config = await api(`/configuracion?clave=eq.jefe_cedula`);
  if (config?.[0]?.valor === cedula) {
    const nombreJefe = (await api(`/configuracion?clave=eq.jefe_nombre`))?.[0]?.valor || 'Jefe de Taller';
    return { perfil: 'jefe', nombre: nombreJefe, id: null };
  }

  const mecs = await api(`/mecanicos?cedula=eq.${cedula}&activo=eq.true`);
  if (mecs?.length) {
    const m   = mecs[0];
    const rol = m.rol || '';
    const perfil = rol === 'taller' ? 'taller' : rol === 'repuestos' ? 'repuestos' : 'mecanico';
    // Cargar permisos del rol personalizado si existe en roles_config
    let permisos = null;
    if (perfil === 'mecanico' && rol) {
      const rolCfg = await api(`/roles_config?nombre=eq.${encodeURIComponent(rol)}`).catch(() => null);
      if (rolCfg?.length) permisos = rolCfg[0].permisos || null;
    }
    return { perfil, nombre: m.nombre, id: m.id, datos: m, permisos };
  }

  const clientes = await api(`/clientes?cedula_nit=eq.${cedula}`);
  if (clientes?.length) {
    return { perfil: 'cliente', nombre: clientes[0].nombre || 'Cliente', id: clientes[0].id, datos: clientes[0] };
  }

  return null;
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.classList.add('show');
}

let _tokenRefreshInterval = null;

function iniciarSesion(datos) {
  sesion = datos;
  sessionStorage.setItem('sesion_freiman', JSON.stringify(datos));
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
  if (sesion?.access_token) await supabaseSignOut(sesion.access_token);
  sessionStorage.removeItem('sesion_freiman');
  sesion = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('pantalla-login').style.display = 'flex';
  document.getElementById('login-cedula').value = '';
  document.getElementById('login-error').classList.remove('show');
}

async function checkSesionGuardada() {
  try {
    const s = sessionStorage.getItem('sesion_freiman');
    if (!s) return;
    sesion = JSON.parse(s);

    // Renovar token si le quedan menos de 5 minutos de vida
    if (sesion.refresh_token && sesion.expires_at) {
      const minutosRestantes = (sesion.expires_at - Date.now()) / 60000;
      if (minutosRestantes < 5) {
        const ok = await refrescarToken();
        if (!ok) { await logout(); return; }
      }
    }

    montarApp();
  } catch(e) {
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
  sessionStorage.setItem('sesion_freiman', JSON.stringify(sesion));
  return true;
}
