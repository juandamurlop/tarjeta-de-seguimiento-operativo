// ═══════════════════════════════════════════════════════════
// INICIALIZACIÓN Y NAVEGACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════

function montarApp() {
  console.log('=== montarApp() ejecutándose ===');
  console.log('sesion:', sesion);
  console.log('sesion.perfil:', sesion?.perfil);
  console.log('typeof montarJefe:', typeof montarJefe);
  console.log('typeof montarMecanico:', typeof montarMecanico);
  console.log('typeof montarCliente:', typeof montarCliente);

  document.getElementById('pantalla-login').style.display = 'none';
  document.getElementById('app').classList.add('show');

  document.getElementById('sb-nombre').textContent = sesion.nombre;
  document.getElementById('sb-avatar').innerHTML = '<img src="logoFreimanpfp.png" style="width:100%;height:100%;object-fit:contain;border-radius:50%">';
  document.getElementById('sb-rol').textContent =
    sesion.perfil === 'jefe' ? 'Jefe de Taller' :
    sesion.perfil === 'mecanico' ? 'Mecánico' : 'Cliente';

  const capEl = document.getElementById('sidebar-capacidad');
  if (capEl) capEl.style.display = sesion.perfil === 'jefe' ? 'block' : 'none';

  if (sesion.perfil === 'jefe') {
    console.log('✅ Llamando a montarJefe()');
    montarJefe();
  } else if (sesion.perfil === 'mecanico') {
    console.log('✅ Llamando a montarMecanico()');
    montarMecanico();
  } else {
    console.log('⚠️ Perfil no reconocido, llamando a montarCliente()');
    montarCliente();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM listo, revisando sesión guardada...');
  checkSesionGuardada();
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    lightbox.addEventListener('click', function(e) {
      if (e.target === this) cerrarLightbox();
    });
  }
});