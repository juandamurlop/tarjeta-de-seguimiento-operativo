// ═══════════════════════════════════════════════════════════
// AUTENTICACIÓN Y SESIÓN
// ═══════════════════════════════════════════════════════════

async function doLogin() {
  const cedula = document.getElementById('login-cedula').value.trim();
  if (!cedula) { mostrarErrorLogin('Ingresa tu número de cédula.'); return; }

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Verificando...';
  document.getElementById('login-error').classList.remove('show');

  try {
    // 1. ¿Es el jefe?
    const config = await api(`/configuracion?clave=eq.jefe_cedula`);
    if (config?.[0]?.valor === cedula) {
      const nombreJefe = (await api(`/configuracion?clave=eq.jefe_nombre`))?.[0]?.valor || 'Jefe de Taller';
      iniciarSesion({ perfil: 'jefe', nombre: nombreJefe, cedula, id: null });
      return;
    }

    // 2. ¿Es mecánico/ejecutivo?
    const mecs = await api(`/mecanicos?cedula=eq.${cedula}&activo=eq.true`);
    if (mecs?.length) {
      iniciarSesion({ perfil: 'mecanico', nombre: mecs[0].nombre, cedula, id: mecs[0].id, datos: mecs[0] });
      return;
    }

    // 3. ¿Es cliente?
    const clientes = await api(`/clientes?cedula_nit=eq.${cedula}`);
    if (clientes?.length) {
      iniciarSesion({ perfil: 'cliente', nombre: clientes[0].nombre || 'Cliente', cedula, id: clientes[0].id, datos: clientes[0] });
      return;
    }

    mostrarErrorLogin('No encontramos ninguna cuenta con esa cédula. Contacta al taller.');
  } catch(e) {
    mostrarErrorLogin('Error de conexión. Intenta de nuevo.');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
}

function mostrarErrorLogin(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.classList.add('show');
}

function iniciarSesion(datos) {
  sesion = datos;
  sessionStorage.setItem('sesion_freiman', JSON.stringify(datos));
  montarApp();
}

function logout() {
  sessionStorage.removeItem('sesion_freiman');
  sesion = null;
  document.getElementById('app').classList.remove('show');
  document.getElementById('pantalla-login').style.display = 'flex';
  document.getElementById('login-cedula').value = '';
  document.getElementById('login-error').classList.remove('show');
}

function checkSesionGuardada() {
  try {
    const s = sessionStorage.getItem('sesion_freiman');
    if (s) { sesion = JSON.parse(s); montarApp(); }
  } catch(e) {}
}