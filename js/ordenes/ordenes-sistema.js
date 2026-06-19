// ═══════════════════════════════════════════════════════════
// ÓRDENES — ADMIN, PRELIQUIDACIÓN, REALTIME, ALERTAS
// ═══════════════════════════════════════════════════════════

async function cargarMecanicosVista() {
  const cont = document.getElementById('pag-mecanicos');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [mecsData, etapasActivas, califItems] = await Promise.all([
      api('/mecanicos?activo=eq.true&order=nombre.asc').catch(() => []) || [],
      api('/etapas?fin=is.null&inicio=not.is.null&select=id,orden_id,etapa,servicio,mecanico_id,inicio').catch(() => []) || [],
      api('/encuesta_items_mecanico?select=mecanico_id,puntos,resultado,creado_en').catch(() => []) || []
    ]);

    // Calificación por mecánico (promedio móvil de encuestas) — reusa el módulo Encuestas
    const statsCalif = {};
    if (typeof Encuestas !== 'undefined' && Encuestas.statsMecanico) {
      const porMec = {};
      califItems.forEach(it => { (porMec[it.mecanico_id] = porMec[it.mecanico_id] || []).push(it); });
      Object.entries(porMec).forEach(([mid, arr]) => { statsCalif[mid] = Encuestas.statsMecanico(arr); });
    }

    const ids = [...new Set(etapasActivas.map(e => e.orden_id))];
    const ordenes = ids.length
      ? await api(`/ordenes?id=in.(${ids.join(',')})&select=id,placa,marca,linea,propietario`).catch(() => []) || []
      : [];

    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const esGerente = sesion?.perfil === 'gerente';

    // Agrupar por rol
    const porRol = {};
    mecsData.forEach(m => {
      const rol = ROL_LABEL[m.rol] || m.rol || 'Técnico';
      if (!porRol[rol]) porRol[rol] = [];
      porRol[rol].push(m);
    });

    // Fila compacta por operario
    const filaOp = (m, esJefeTaller = false) => {
      const etapas = etapasActivas.filter(e => e.mecanico_id === m.id);
      const ocupado = etapas.length > 0;
      const primeraEtapa = etapas[0];
      const ord = primeraEtapa ? ordenes.find(o => o.id === primeraEtapa.orden_id) : null;
      const color = primeraEtapa ? (srvColor[primeraEtapa.servicio] || '#6B7280') : null;
      const mins = primeraEtapa?.inicio ? Math.round((new Date() - new Date(primeraEtapa.inicio)) / 60000) : 0;
      const dur = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${Math.floor(mins/1440)}d`;

      const indicador = ocupado
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22C55E;flex-shrink:0;box-shadow:0 0 0 2px #DCFCE7"></span>`
        : `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#D1D5DB;flex-shrink:0"></span>`;

      const estadoHtml = ocupado
        ? `<div style="display:flex;flex-direction:column;gap:3px;min-width:0;cursor:pointer" onclick="abrirOrden(${ord?.id||0})" title="Abrir orden">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <div style="width:3px;height:14px;background:${color};border-radius:99px;flex-shrink:0"></div>
              <span style="font-size:12px;font-weight:600;color:var(--texto);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(primeraEtapa.etapa)||'—'}</span>
              ${etapas.length > 1 ? `<span style="font-size:10px;color:var(--gris-mid);flex-shrink:0">+${etapas.length-1} más</span>` : ''}
              <span style="font-size:10px;font-weight:700;color:${color};background:${color}18;padding:1px 5px;border-radius:3px;font-family:'DM Mono',monospace;flex-shrink:0">${dur}</span>
            </div>
            ${ord ? `<div style="display:flex;align-items:center;gap:5px;min-width:0">
              <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--azul);flex-shrink:0">${escapeHtml(ord.placa)}</span>
              <span style="font-size:9px;color:var(--gris-mid);font-family:'DM Mono',monospace;flex-shrink:0">OT-${String(ord.id).padStart(4,'0')}</span>
              ${ord.marca||ord.linea ? `<span style="font-size:10px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${[ord.marca,ord.linea].filter(Boolean).map(escapeHtml).join(' ')}</span>` : ''}
            </div>` : ''}
            ${ord?.propietario ? `<div style="font-size:10px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${escapeHtml(ord.propietario)}</div>` : ''}
          </div>`
        : `<span style="font-size:11.5px;color:var(--gris-mid);font-style:italic">Libre</span>`;

      const acciones = esJefeTaller
        ? `<button class="btn btn-ghost btn-xs" onclick="abrirCambiarPassJefe()" title="Cambiar contraseña">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
           </button>`
        : `<button class="btn btn-ghost btn-xs" onclick="abrirCambiarPassMecanico(${m.id},'${escapeHtml(m.nombre)}')" title="Contraseña">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
           </button>
           ${esGerente ? `
           <button class="btn btn-ghost btn-xs" onclick="abrirModalOperario(${JSON.stringify(m).replace(/"/g,'&quot;')})" title="Editar">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           </button>
           <button class="btn btn-ghost btn-xs" style="color:var(--rojo)" onclick="eliminarOperario(${m.id},'${escapeHtml(m.nombre)}')" title="Desactivar">
             <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
           </button>` : ''}`;

      const rolLabel = esJefeTaller ? 'Jefe de taller' : escapeHtml(ROL_LABEL[m.rol]||m.rol||'—');
      // Calificación de satisfacción (solo si el operario tiene encuestas evaluadas)
      const stCalif = statsCalif[m.id];
      const califHtml = (stCalif && stCalif.evaluadas)
        ? `<div style="font-size:10.5px;font-weight:700;margin-top:1px;color:${Encuestas.colorScore(stCalif.promedio)}">★ ${stCalif.promedio != null ? stCalif.promedio.toFixed(1) : '—'}<span style="color:var(--gris-mid);font-weight:400"> · ${stCalif.evaluadas} enc.${stCalif.quejas ? ` · ${stCalif.quejas} queja${stCalif.quejas>1?'s':''}` : ''}</span></div>`
        : '';
      return `<div class="op-row">
        <span class="op-col-dot">${indicador}</span>
        <div class="op-col-nombre">
          <div style="width:26px;height:26px;border-radius:50%;background:${esJefeTaller ? '#1E3A5F' : (ocupado ? 'var(--azul)' : '#94A3B8')};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:white;flex-shrink:0">${escapeHtml(m.nombre.charAt(0).toUpperCase())}</div>
          <div style="min-width:0">
            <span style="font-size:12.5px;font-weight:${esJefeTaller?'700':'600'};color:var(--texto);overflow:hidden;text-overflow:ellipsis;display:block">${escapeHtml(m.nombre)}</span>
            <span class="op-rol-mobile">${rolLabel}</span>
            ${califHtml}
          </div>
        </div>
        <span class="op-col-rol">${rolLabel}</span>
        <div class="op-col-estado">${estadoHtml}</div>
        <div class="op-col-acc">${acciones}</div>
      </div>`;
    };

    // Leer datos del jefe desde config
    const cfgJefe = await api('/configuracion?clave=in.(jefe_nombre,jefe_cedula)').catch(() => []) || [];
    const jefeNombre = cfgJefe.find(c => c.clave === 'jefe_nombre')?.valor || 'Jefe de Taller';
    const jefeMock = { id: 0, nombre: jefeNombre, rol: 'jefe', telegram_chat_id: null };

    const totalActivos = mecsData.filter(m => etapasActivas.some(e => e.mecanico_id === m.id)).length;

    cont.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;font-weight:700;color:var(--texto)">${mecsData.length} operario${mecsData.length!==1?'s':''}</span>
          <span style="font-size:11px;color:#059669;background:#DCFCE7;padding:2px 8px;border-radius:20px;font-weight:700">${totalActivos} activo${totalActivos!==1?'s':''}</span>
          <span style="font-size:11px;color:var(--gris-mid);background:var(--gris-bg);padding:2px 8px;border-radius:20px">${mecsData.length - totalActivos} libre${mecsData.length-totalActivos!==1?'s':''}</span>
        </div>
        ${esGerente ? `
        <div style="display:flex;gap:7px">
          <button class="btn btn-primary btn-sm" onclick="abrirModalOperario(null)" style="display:flex;align-items:center;gap:5px">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Nuevo
          </button>
          <button class="btn btn-ghost btn-sm" onclick="abrirGestionRoles()" style="color:#7C3AED;border-color:#DDD6FE">Roles</button>
        </div>` : ''}
      </div>

      <div style="border:1.5px solid var(--gris-borde);border-radius:10px;overflow:hidden">
        <!-- Cabecera -->
        <div class="op-header">
          <span></span>
          <span>Nombre</span>
          <span class="op-col-rol">Rol</span>
          <span class="op-col-estado">Estado actual</span>
          <span></span>
        </div>

        <!-- Jefe de taller -->
        <div style="background:#F0F4FF;border-bottom:1.5px solid var(--gris-borde)">
          ${filaOp(jefeMock, true)}
        </div>

        <!-- Operarios agrupados por rol -->
        ${Object.entries(porRol).map(([rol, mecs]) => `
          <div style="background:var(--gris-bg);padding:4px 12px;border-bottom:1px solid var(--gris-borde)">
            <span style="font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--gris-mid);font-family:'DM Mono',monospace">${escapeHtml(rol)} (${mecs.length})</span>
          </div>
          ${mecs.map(m => filaOp(m)).join('')}
        `).join('')}
      </div>
    `;
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ─── CRUD OPERARIOS (solo gerente) ───────────────────────

async function abrirModalOperario(mec) {
  // mec = null → crear nuevo, mec = objeto → editar
  document.getElementById('modal-operario')?.remove();
  const esEditar = mec !== null && mec !== undefined;

  // Roles base + roles personalizados de la DB
  const rolesBase = [
    { val:'mecanico',  label:'Mecánico'  },
    { val:'pintor',    label:'Pintor'    },
    { val:'latonero',  label:'Latonero'  },
    { val:'detailing', label:'Detailing' },
    { val:'tot',       label:'T.O.T.'   },
    { val:'repuestos', label:'Repuestos' }
  ];
  const rolesCustom = await api('/roles_config?order=nombre.asc&select=nombre,color').catch(() => []) || [];
  const roles = [
    ...rolesBase,
    ...(rolesCustom.length ? [{ val:'_sep', label:'── Roles personalizados ──', disabled:true }] : []),
    ...rolesCustom.map(r => ({ val: r.nombre, label: r.nombre, color: r.color }))
  ];
  const m = document.createElement('div');
  m.id = 'modal-operario';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          ${esEditar ? 'Editar operario' : 'Nuevo operario'}
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-operario').remove()">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div class="field">
          <label>Nombre completo</label>
          <input id="op-nombre" type="text" placeholder="Nombre del operario" value="${esEditar ? escapeHtml(mec.nombre||'') : ''}">
        </div>
        <div class="field">
          <label>Cédula</label>
          <input id="op-cedula" type="text" placeholder="Número de cédula"
            value="${esEditar ? escapeHtml(mec.cedula||'') : ''}"
            ${esEditar ? 'readonly style="background:var(--gris-bg);color:var(--gris-mid)"' : ''}>
          ${esEditar ? '<div style="font-size:11px;color:var(--gris-mid);margin-top:3px">La cédula no se puede cambiar. Usa el candado 🔒 para cambiar contraseña.</div>' : ''}
        </div>
        <div class="field">
          <label>Perfil / Rol</label>
          <select id="op-rol">
            ${roles.map(r => r.disabled
              ? `<option value="" disabled>${r.label}</option>`
              : `<option value="${r.val}" ${esEditar && mec.rol===r.val ? 'selected':''}>${r.label}</option>`
            ).join('')}
          </select>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input id="op-es-asesor" type="checkbox" ${esEditar && mec.es_asesor ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
            <span>Es asesor de servicio <span style="font-weight:400;color:var(--gris-mid);font-size:11px">(aparece en las encuestas)</span></span>
          </label>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:6px">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.63a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            Telegram Chat ID
          </label>
          <input id="op-telegram" type="text" placeholder="Ej: 123456789 (dejar vacío si no usa Telegram)"
            value="${esEditar ? escapeHtml(mec.telegram_chat_id||'') : ''}">
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">
            Para obtenerlo: que el operario escriba <strong>/start</strong> al bot <strong>@userinfobot</strong> en Telegram y te pase el ID.
          </div>
        </div>
        ${!esEditar ? `
        <div class="field">
          <label>Contraseña inicial</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="op-pass" type="password" placeholder="Dejar vacío = usar cédula como clave" style="flex:1">
            <button type="button" onclick="const i=document.getElementById('op-pass');i.type=i.type==='password'?'text':'password'" style="flex-shrink:0;width:38px;height:38px;border:1.5px solid var(--gris-borde);border-radius:6px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gris-mid)">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
          <div style="font-size:11px;color:var(--gris-mid);margin-top:3px">Si lo dejas vacío, la cédula será la contraseña inicial.</div>
        </div>` : ''}
        <div id="op-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-operario').remove()">Cancelar</button>
          <button class="btn btn-primary" id="op-btn-save" onclick="guardarOperario(${esEditar ? mec.id : 'null'}, '${esEditar ? escapeHtml(mec.cedula||'') : ''}')">
            ${esEditar ? 'Guardar cambios' : 'Crear operario'}
          </button>
        </div>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(() => document.getElementById('op-nombre')?.focus(), 80);
}

async function guardarOperario(mecId, cedulaOriginal) {
  const nombre = document.getElementById('op-nombre')?.value.trim();
  const cedula    = mecId ? cedulaOriginal : document.getElementById('op-cedula')?.value.trim();
  const rol       = document.getElementById('op-rol')?.value;
  const esAsesor  = !!document.getElementById('op-es-asesor')?.checked;
  const pass      = document.getElementById('op-pass')?.value || '';
  const tgChatId  = document.getElementById('op-telegram')?.value.trim() || null;
  const errEl  = document.getElementById('op-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!nombre) { showErr('Ingresa el nombre del operario.'); return; }
  if (!cedula) { showErr('Ingresa la cédula.'); return; }
  if (!mecId && (!pass || pass.length < 6)) { showErr('Asigna una contraseña de al menos 6 caracteres (no uses la cédula).'); return; }

  const btn = document.getElementById('op-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (mecId) {
      // Editar: actualiza nombre, rol y telegram_chat_id
      await api(`/mecanicos?id=eq.${mecId}`, 'PATCH', { nombre, rol, es_asesor: esAsesor, telegram_chat_id: tgChatId });
      toast(`${nombre} actualizado ✓`);
    } else {
      // Crear: primero registrar en Supabase Auth (contraseña obligatoria, ya validada arriba)
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
        body: JSON.stringify({ email: `${cedula}@freimanautos.com`, password: pass })
      });
      const signupData = await signupRes.json().catch(() => ({}));
      if (!signupRes.ok && signupData?.msg !== 'User already registered') {
        console.warn('signup result:', signupData);
        // Continúa igual — puede que ya exista en auth pero no en mecanicos
      }
      // Insertar en tabla mecanicos
      await api('/mecanicos', 'POST', { nombre, cedula, rol, es_asesor: esAsesor, activo: true, telegram_chat_id: tgChatId }, { Prefer: 'return=minimal' });
      toast(`${nombre} creado ✓ — contraseña asignada`);
    }
    document.getElementById('modal-operario')?.remove();
    cargarMecanicosVista();
  } catch(e) {
    showErr('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = mecId ? 'Guardar cambios' : 'Crear operario'; }
  }
}

async function eliminarOperario(mecId, nombre) {
  if (!confirm(`¿Desactivar a ${nombre}?\n\nYa no podrá ingresar al sistema ni aparecerá en la lista de operarios.\nPuedes reactivarlo desde Supabase si es necesario.`)) return;
  try {
    await api(`/mecanicos?id=eq.${mecId}`, 'PATCH', { activo: false });
    toast(`${nombre} desactivado ✓`);
    cargarMecanicosVista();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}
// ═══════════════════════════════════════════════════════════
// GESTIÓN DE ROLES PERSONALIZADOS (solo gerente)
// ═══════════════════════════════════════════════════════════

async function abrirGestionRoles() {
  document.getElementById('modal-roles')?.remove();
  const roles = await api('/roles_config?order=nombre.asc').catch(() => []) || [];

  const m = document.createElement('div');
  m.id = 'modal-roles';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:680px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
          Roles y permisos
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-roles').remove()">✕</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1">
        <p style="font-size:13px;color:var(--gris-mid);margin-bottom:16px">
          Los roles personalizados permiten dar acceso limitado a ciertas secciones de la app a operarios que no son jefe ni mecánico tradicional.
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px" id="roles-lista">
          ${roles.length ? roles.map(r => _rolFila(r)).join('') : '<div style="font-size:13px;color:var(--gris-mid);text-align:center;padding:20px 0">Sin roles personalizados aún.</div>'}
        </div>
        <button class="btn btn-primary btn-sm" onclick="abrirModalRol(null)" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Crear nuevo rol
        </button>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
}

function _rolFila(r) {
  const perms = r.permisos || {};
  const cant  = Object.values(perms).filter(Boolean).length;
  return `<div style="background:white;border:1.5px solid var(--gris-borde);border-radius:8px;padding:12px 14px;display:flex;align-items:center;gap:12px">
    <div style="width:10px;height:10px;border-radius:50%;background:${r.color||'#6B7280'};flex-shrink:0"></div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px">${escapeHtml(r.nombre)}</div>
      <div style="font-size:11px;color:var(--gris-mid);margin-top:2px">${cant} permiso${cant!==1?'s':''} activado${cant!==1?'s':''}</div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-xs" onclick="abrirModalRol(${JSON.stringify(r).replace(/"/g,'&quot;')})">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn-ghost btn-xs" style="color:var(--rojo)" onclick="eliminarRol(${r.id},'${escapeHtml(r.nombre)}')">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`;
}

const _COLORES_ROL = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#0891B2','#BE185D','#6B7280'];

function abrirModalRol(rol) {
  document.getElementById('modal-rol-edit')?.remove();
  const esEditar = rol !== null && rol !== undefined;
  const perms    = rol?.permisos || {};

  // Agrupar permisos por grupo
  const grupos = {};
  PERMISOS_CATALOGO.forEach(p => {
    if (!grupos[p.grupo]) grupos[p.grupo] = [];
    grupos[p.grupo].push(p);
  });

  const gruposHtml = Object.entries(grupos).map(([grupo, items]) => `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid);margin-bottom:8px">${grupo}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${items.map(p => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--gris-bg);border-radius:6px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="perm-${p.key}" ${perms[p.key] ? 'checked' : ''} style="width:15px;height:15px;accent-color:#7C3AED">
            <span>${p.label}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');

  const colorPickerHtml = _COLORES_ROL.map(c =>
    `<button type="button" onclick="document.getElementById('rol-color-val').value='${c}';document.querySelectorAll('.rol-color-dot').forEach(d=>d.classList.remove('sel'));this.querySelector('div').classList.add('sel')"
      class="rol-color-dot" style="background:none;border:none;padding:2px;cursor:pointer">
      <div style="width:22px;height:22px;border-radius:50%;background:${c};outline:${(rol?.color||'#7C3AED')===c?'3px solid '+c:'2px solid transparent'};outline-offset:2px" class="${(rol?.color||'#7C3AED')===c?'sel':''}"></div>
    </button>`
  ).join('');

  const m = document.createElement('div');
  m.id = 'modal-rol-edit';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:500px;max-height:90vh;display:flex;flex-direction:column">
      <div class="modal-header">
        <div class="modal-titulo">${esEditar ? 'Editar rol' : 'Nuevo rol'}</div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-rol-edit').remove()">✕</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:16px">
        <div class="field">
          <label>Nombre del rol</label>
          <input id="rol-nombre" type="text" placeholder="Ej: Asesor comercial, Administración..." value="${esEditar ? escapeHtml(rol.nombre) : ''}" ${esEditar ? 'readonly style="background:var(--gris-bg);color:var(--gris-mid)"' : ''}>
          ${esEditar ? '<div style="font-size:11px;color:var(--gris-mid);margin-top:3px">El nombre del rol no se puede cambiar (se usa como identificador).</div>' : ''}
        </div>
        <div class="field">
          <label>Color identificador</label>
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${colorPickerHtml}</div>
          <input type="hidden" id="rol-color-val" value="${rol?.color||'#7C3AED'}">
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;color:var(--texto);display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            Permisos
            <button type="button" onclick="_rolToggleTodos(true)" class="btn btn-ghost btn-xs">Marcar todos</button>
          </label>
          ${gruposHtml}
        </div>
        <div id="rol-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-rol-edit').remove()">Cancelar</button>
          <button class="btn btn-primary" id="rol-btn-save" onclick="guardarRol(${esEditar ? rol.id : 'null'})">
            ${esEditar ? 'Guardar cambios' : 'Crear rol'}
          </button>
        </div>
      </div>
    </div>`;
  m.addEventListener('click', e => { if (e.target === m) m.remove(); });
  document.body.appendChild(m);
  setTimeout(() => document.getElementById('rol-nombre')?.focus(), 80);
}

function _rolToggleTodos(val) {
  PERMISOS_CATALOGO.forEach(p => {
    const el = document.getElementById('perm-' + p.key);
    if (el) el.checked = val;
  });
}

async function guardarRol(rolId) {
  const nombre = document.getElementById('rol-nombre')?.value.trim();
  const color  = document.getElementById('rol-color-val')?.value || '#6B7280';
  const errEl  = document.getElementById('rol-error');
  const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (!nombre) { showErr('Ingresa un nombre para el rol.'); return; }

  // Leer permisos marcados
  const permisos = {};
  PERMISOS_CATALOGO.forEach(p => {
    permisos[p.key] = !!(document.getElementById('perm-' + p.key)?.checked);
  });
  const algunoActivo = Object.values(permisos).some(Boolean);
  if (!algunoActivo) { showErr('Activa al menos un permiso para este rol.'); return; }

  const btn = document.getElementById('rol-btn-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    if (rolId) {
      await api(`/roles_config?id=eq.${rolId}`, 'PATCH', { color, permisos });
      toast(`Rol "${nombre}" actualizado ✓`);
    } else {
      await api('/roles_config', 'POST', { nombre, color, permisos }, { Prefer: 'return=minimal' });
      toast(`Rol "${nombre}" creado ✓`);
    }
    document.getElementById('modal-rol-edit')?.remove();
    abrirGestionRoles(); // recargar lista
  } catch(e) {
    showErr('Error: ' + e.message);
    if (btn) { btn.disabled = false; btn.textContent = rolId ? 'Guardar cambios' : 'Crear rol'; }
  }
}

async function eliminarRol(rolId, nombre) {
  if (!confirm(`¿Eliminar el rol "${nombre}"?\n\nLos operarios con este rol quedarán sin permisos especiales hasta que se les asigne otro rol.`)) return;
  try {
    await api(`/roles_config?id=eq.${rolId}`, 'DELETE');
    toast(`Rol "${nombre}" eliminado`);
    abrirGestionRoles();
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
// REGISTRO DE VEHÍCULOS
// ═══════════════════════════════════════════════════════════

let _vehiculosBusqueda = '';

async function cargarVehiculos() {
  const cont = document.getElementById('pag-vehiculos');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando vehículos...</div>';
  try {
    // Registro de vehículos (tabla vehiculos) + órdenes. Así la lista muestra
    // los vehículos registrados aunque no tengan órdenes.
    const [registro, ordenes] = await Promise.all([
      api('/vehiculos?select=placa,marca,linea,modelo,color,vin,propietario,cedula_nit,telefono,fecha_ingreso&order=placa.asc&limit=4000').catch(() => []) || [],
      api('/ordenes?select=id,placa,marca,linea,modelo,color,vin,propietario,telefono,correo_cliente,cedula_cliente,tipo_cliente,aseguradora,estado,creado_en,fecha_entrega_1&order=placa.asc,creado_en.desc&limit=2000').catch(() => []) || []
    ]);

    // Mapa por placa: primero el registro, luego las órdenes (sin perder datos del registro)
    const vehiculosMap = {};
    (registro || []).forEach(v => {
      const placa = (v.placa || '').toUpperCase();
      if (!placa) return;
      vehiculosMap[placa] = { info: { ...v, cedula_cliente: v.cedula_nit }, ordenes: [] };
    });
    ordenes.forEach(o => {
      const placa = (o.placa || '').toUpperCase();
      if (!placa) return;
      if (!vehiculosMap[placa]) vehiculosMap[placa] = { info: o, ordenes: [] };
      else vehiculosMap[placa].info = { ...o, ...vehiculosMap[placa].info };
      vehiculosMap[placa].ordenes.push(o);
    });

    const vehiculos = Object.values(vehiculosMap).sort((a, b) =>
      (a.info.placa || '').localeCompare(b.info.placa || '')
    );

    const _renderVehiculos = (lista) => {
      if (!lista.length) return `<div style="padding:40px;text-align:center;color:var(--gris-mid);font-size:13px">Sin vehículos encontrados.</div>`;

      const estadoColor = { Activa:'#2563EB', Entregada:'#059669', Archivada:'#6B7280', Programada:'#7C3AED' };

      // Agrupar por mes/año de la orden más reciente
      const grupos = {};
      lista.forEach(v => {
        const ultima = v.ordenes[0]; // ya viene desc por creado_en
        const dRef = ultima?.creado_en || v.info?.fecha_ingreso || null;
        const d = dRef ? new Date(dRef) : null;
        const key = d
          ? d.toLocaleDateString('es-CO',{month:'long',year:'numeric'})
          : 'Sin fecha';
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(v);
      });

      return Object.entries(grupos).map(([periodo, gVehiculos]) => {
        const cuadros = gVehiculos.map(v => {
          const info   = v.info;
          const ots    = v.ordenes;
          const activo = ots.some(o => o.estado === 'Activa');
          const vehiculo = [info.marca, info.linea, info.modelo].filter(Boolean).map(escapeHtml).join(' ');
          const ultimaOT = ots[0];
          const badgeCol = activo ? '#2563EB' : '#6B7280';
          const _plEsc = escapeHtml(info.placa || '');
          const clk = ultimaOT ? `abrirOrden(${ultimaOT.id});navJefe('detalle')` : `verHistorialVehiculo('${_plEsc}')`;

          return `<div class="hover-lift" style="background:white;border:1.5px solid var(--gris-borde);border-radius:8px;padding:9px 11px;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;margin-bottom:4px">
              <span onclick="${clk}" style="font-family:'DM Mono',monospace;font-size:13px;font-weight:800;color:var(--texto);letter-spacing:.05em;cursor:pointer">${escapeHtml(info.placa||'—')}</span>
              <span style="font-size:9px;font-weight:700;color:${badgeCol};background:${badgeCol}18;padding:1px 6px;border-radius:3px">${ots.length} OT${ots.length!==1?'s':''}</span>
            </div>
            <div style="font-size:10.5px;color:var(--gris-mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="${clk}">${vehiculo || '—'}</div>
            ${info.propietario ? `<div style="font-size:10.5px;font-weight:600;color:var(--gris-texto);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="${clk}">${escapeHtml(info.propietario)}</div>` : ''}
            <div style="margin-top:6px;padding-top:5px;border-top:1px solid var(--gris-borde);display:flex;align-items:center;gap:4px">
              <button onclick="event.stopPropagation();verHistorialVehiculo('${escapeHtml(info.placa||'')}')"
                style="flex:1;min-width:0;background:none;border:1px solid var(--gris-borde);border-radius:4px;padding:3px 4px;font-size:10px;cursor:pointer;color:var(--azul);display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;overflow:hidden"
                title="Ver historial de visitas">📋 Historial</button>
              <button onclick="event.stopPropagation();abrirPopupConsumibles('${escapeHtml(info.placa||'')}',${info.kilometraje||0})"
                style="flex:1;min-width:0;background:none;border:1px solid var(--gris-borde);border-radius:4px;padding:3px 4px;font-size:10px;cursor:pointer;color:var(--gris-mid);display:flex;align-items:center;justify-content:center;gap:3px;white-space:nowrap;overflow:hidden"
                title="Ver consumibles y documentos">🔧 <span style="overflow:hidden;text-overflow:ellipsis">Consumibles</span></button>
            </div>
          </div>`;
        }).join('');

        return `<div style="margin-bottom:20px">
          <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--gris-mid);font-family:'DM Mono',monospace;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--gris-borde)">
            ${escapeHtml(periodo.charAt(0).toUpperCase()+periodo.slice(1))}
            <span style="opacity:.6">(${gVehiculos.length})</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">
            ${cuadros}
          </div>
        </div>`;
      }).join('');
    };

    cont.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;position:relative">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--gris-mid);pointer-events:none"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Buscar por placa, propietario, marca..." id="veh-buscar"
            style="width:100%;padding:7px 12px 7px 30px;border:1.5px solid var(--gris-borde);border-radius:8px;font-size:13px;outline:none;box-sizing:border-box;background:white"
            oninput="_vehiculosFiltrar(this.value)" value="${escapeHtml(_vehiculosBusqueda)}">
        </div>
        <div style="font-size:12px;color:var(--gris-mid);flex-shrink:0">${vehiculos.length} vehículo${vehiculos.length!==1?'s':''}</div>
      </div>
      <div id="veh-list-inner">${_renderVehiculos(vehiculos)}</div>`;

    // Guardar para filtrado en memoria
    window._vehiculosData = vehiculos;
    window._vehiculosRender = _renderVehiculos;

    // Aplicar búsqueda pendiente si hay
    if (_vehiculosBusqueda) _vehiculosFiltrar(_vehiculosBusqueda);

  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

function _vehiculosFiltrar(q) {
  _vehiculosBusqueda = q;
  const inner = document.getElementById('veh-list-inner');
  if (!inner || !window._vehiculosData) return;
  const term = q.toLowerCase().trim();
  const filtrados = term
    ? window._vehiculosData.filter(v => {
        const i = v.info;
        return (i.placa||'').toLowerCase().includes(term)
          || (i.propietario||'').toLowerCase().includes(term)
          || (i.marca||'').toLowerCase().includes(term)
          || (i.linea||'').toLowerCase().includes(term)
          || (i.cedula_cliente||'').toLowerCase().includes(term)
          || (i.telefono||'').toLowerCase().includes(term);
      })
    : window._vehiculosData;
  inner.innerHTML = window._vehiculosRender(filtrados);
  const counter = document.querySelector('#pag-vehiculos [style*="registrado"]');
  if (counter) counter.textContent = `${filtrados.length} vehículo${filtrados.length!==1?'s':''} registrado${filtrados.length!==1?'s':''}`;
}

// ═══════════════════════════════════════════════════════════
// GESTIÓN DE CONTRASEÑAS (jefe/gerente)
// ═══════════════════════════════════════════════════════════
function _modalPass(titulo, cedula, nombre) {
  document.getElementById('modal-cambiar-pass')?.remove();
  const m = document.createElement('div');
  m.id = 'modal-cambiar-pass';
  m.className = 'modal-overlay show';
  m.innerHTML = `
    <div class="modal" style="max-width:380px">
      <div class="modal-header">
        <div class="modal-titulo">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          ${titulo}
        </div>
        <button class="modal-cerrar" onclick="document.getElementById('modal-cambiar-pass').remove()">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div style="background:var(--gris-bg);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--gris-mid)">
          Usuario: <strong style="color:var(--texto)">${escapeHtml(nombre)}</strong>
        </div>
        <div class="field">
          <label>Nueva contraseña</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="pass-nueva" type="password" placeholder="Mínimo 6 caracteres" style="flex:1;min-width:0;padding:10px 13px;border:1.5px solid var(--gris-borde);border-radius:6px;font-size:14px;color:var(--texto);outline:none;transition:border-color 0.15s">
            <button type="button" onclick="const i=document.getElementById('pass-nueva');i.type=i.type==='password'?'text':'password'" style="flex-shrink:0;width:42px;height:42px;border:1.5px solid var(--gris-borde);border-radius:6px;background:white;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--gris-mid)">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
        <div class="field">
          <label>Confirmar contraseña</label>
          <input id="pass-confirmar" type="password" placeholder="Repite la contraseña">
        </div>
        <div id="pass-error" style="display:none;background:var(--rojo-bg);color:var(--rojo);border-radius:6px;padding:10px 14px;font-size:13px"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-ghost" onclick="document.getElementById('modal-cambiar-pass').remove()">Cancelar</button>
          <button class="btn btn-primary" onclick="_guardarNuevaPass('${cedula}','${escapeHtml(nombre)}')">Guardar contraseña</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(m);
  document.getElementById('pass-nueva').focus();
}

function abrirCambiarPassMecanico(mecId, nombre) {
  // Buscar la cédula del mecánico para usarla como identificador de Supabase Auth
  api(`/mecanicos?id=eq.${mecId}&select=cedula,nombre`).then(data => {
    const mec = data?.[0];
    if (!mec?.cedula) { toast('Este técnico no tiene cédula registrada', 'err'); return; }
    _modalPass(`Cambiar contraseña — ${mec.nombre || nombre}`, mec.cedula, mec.nombre || nombre);
  }).catch(() => toast('Error al obtener datos del técnico', 'err'));
}

function abrirCambiarPassJefe() {
  // Solo visible para gerente
  if (sesion?.perfil !== 'gerente') return;
  api(`/configuracion?clave=eq.jefe_cedula`).then(data => {
    const cedula = data?.[0]?.valor;
    const nombre = 'Jefe de Taller';
    if (!cedula) { toast('No se encontró la cédula del jefe', 'err'); return; }
    _modalPass('Cambiar contraseña — Jefe de Taller', cedula, nombre);
  }).catch(() => toast('Error al obtener datos del jefe', 'err'));
}

async function _guardarNuevaPass(cedula, nombre) {
  const nueva    = document.getElementById('pass-nueva')?.value || '';
  const confirma = document.getElementById('pass-confirmar')?.value || '';
  const errEl    = document.getElementById('pass-error');

  const mostrarError = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };
  errEl.style.display = 'none';

  if (nueva.length < 6)        { mostrarError('La contraseña debe tener al menos 6 caracteres.'); return; }
  if (nueva !== confirma)       { mostrarError('Las contraseñas no coinciden.'); return; }

  const btn = document.querySelector('#modal-cambiar-pass .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const result = await api('/rpc/admin_cambiar_contrasena', 'POST', {
      p_target_cedula: cedula,
      p_nueva_password: nueva
    });
    if (result === false) throw new Error('Usuario no encontrado en el sistema');
    document.getElementById('modal-cambiar-pass')?.remove();
    toast(`Contraseña de ${nombre} actualizada ✓`);
  } catch(e) {
    mostrarError('Error al cambiar contraseña: ' + (e.message || 'Intenta de nuevo'));
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar contraseña'; }
  }
}

// ═══════════════════════════════════════════════════════════
// DRAG & DROP — PANELES DE SERVICIO
// ═══════════════════════════════════════════════════════════
let srvDragSrc = null;

function srvDragStart(e, srvKey) {
  srvDragSrc = srvKey;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}
function srvDragOver(e) {
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('srv-drag-over');
}
function srvDragLeave(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('srv-drag-over');
}
function srvDragDrop(e, targetSrv, ordenId) {
  e.preventDefault(); e.stopPropagation();
  e.currentTarget.classList.remove('srv-drag-over');
  if (!srvDragSrc || srvDragSrc === targetSrv) return;
  const container = document.getElementById('srv-drag-container');
  if (!container) return;
  const panels = [...container.querySelectorAll('.srv-panel[data-srv]')];
  const srcEl = panels.find(p => p.dataset.srv === srvDragSrc);
  const tgtEl = panels.find(p => p.dataset.srv === targetSrv);
  if (!srcEl || !tgtEl) return;
  const srcRect = srcEl.getBoundingClientRect();
  const tgtRect = tgtEl.getBoundingClientRect();
  if (srcRect.top < tgtRect.top) {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl.nextSibling);
  } else {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl);
  }
  const newOrder = [...container.querySelectorAll('.srv-panel[data-srv]')].map(p => p.dataset.srv);
  localStorage.setItem('srv_orden_' + ordenId, JSON.stringify(newOrder));
}
function srvDragEnd(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.srv-panel').forEach(p => p.classList.remove('srv-drag-over'));
  srvDragSrc = null;
}

// ═══════════════════════════════════════════════════════════
// DRAG & DROP — ETAPAS DENTRO DE UN SERVICIO
// ═══════════════════════════════════════════════════════════
let etapaDragSrc = null;
let etapaDragSrvKey = null;

function etapaDragStart(e, eid, srvKey) {
  etapaDragSrc = eid;
  etapaDragSrvKey = srvKey;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.stopPropagation();
}
function etapaDragOver(e) {
  e.preventDefault(); e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('etapa-drag-over');
}
function etapaDragLeave(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('etapa-drag-over');
}
function etapaDragDrop(e, targetEid, srvKey, ordenId) {
  e.preventDefault(); e.stopPropagation();
  e.currentTarget.classList.remove('etapa-drag-over');
  if (!etapaDragSrc || etapaDragSrc === targetEid || etapaDragSrvKey !== srvKey) return;
  const container = document.getElementById('edc-' + srvKey);
  if (!container) return;
  const cards = [...container.querySelectorAll('.etapa-card[data-eid]')];
  const srcEl = cards.find(c => parseInt(c.dataset.eid) === etapaDragSrc);
  const tgtEl = cards.find(c => parseInt(c.dataset.eid) === targetEid);
  if (!srcEl || !tgtEl) return;
  const srcRect = srcEl.getBoundingClientRect();
  const tgtRect = tgtEl.getBoundingClientRect();
  if (srcRect.top < tgtRect.top) {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl.nextSibling);
  } else {
    tgtEl.parentNode.insertBefore(srcEl, tgtEl);
  }
  const newOrder = [...container.querySelectorAll('.etapa-card[data-eid]')].map(c => parseInt(c.dataset.eid));
  localStorage.setItem('etapa_orden_' + ordenId + '_' + srvKey, JSON.stringify(newOrder));
}
function etapaDragEnd(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.etapa-card').forEach(c => c.classList.remove('etapa-drag-over'));
  etapaDragSrc = null;
  etapaDragSrvKey = null;
}

// ═══════════════════════════════════════════════════════════
// VALOR DE ETAPA
// ═══════════════════════════════════════════════════════════
async function patchValor(eid, k) {
  const val = parseFloat(document.getElementById(`val-${k}`)?.value) || null;
  await api(`/etapas?id=eq.${eid}`, 'PATCH', { valor: val }).catch(() => {});
}
// ═══════════════════════════════════════════════════════════
// MODAL CALENDARIO — info de orden al hacer click
// ═══════════════════════════════════════════════════════════
async function abrirCalModal(ordenId) {
  let modal = document.getElementById('modal-cal-orden');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-cal-orden';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal" style="max-width:480px">
      <div class="modal-header">
        <h2 id="mcal-titulo">Orden</h2>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-cal-orden').classList.remove('show')">✕</button>
      </div>
      <div class="modal-body" id="mcal-body"><div class="loading-state">Cargando...</div></div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="document.getElementById('modal-cal-orden').classList.remove('show')">Cerrar</button>
        <button class="btn btn-primary" id="mcal-btn-abrir">Ver orden completa</button>
      </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('show'); });
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  document.getElementById('mcal-body').innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [orden, etapas] = await Promise.all([
      api(`/ordenes?id=eq.${ordenId}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${ordenId}&order=creado_en.asc`).catch(()=>[]) || []
    ]);
    const total = etapas.length;
    const comp  = etapas.filter(e => e.fin).length;
    const pct   = total ? Math.round((comp/total)*100) : 0;
    const activa = etapas.find(e => e.inicio && !e.fin);
    const fmt = n => n != null ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n) : '—';
    const totalVal = etapas.reduce((s,e) => s+(e.valor||0), 0);
    const srvColor = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };
    const srvs = [...new Set(etapas.map(e=>e.servicio).filter(Boolean))];

    document.getElementById('mcal-titulo').textContent = orden.placa;
    document.getElementById('mcal-btn-abrir').onclick = () => {
      modal.classList.remove('show');
      abrirOrden(ordenId);
    };
    document.getElementById('mcal-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--gris-mid)">${[orden.marca,orden.linea,orden.modelo].filter(Boolean).map(escapeHtml).join(' ')||'—'}</div>
          <div style="font-size:12px;color:var(--gris-mid);margin-top:2px;display:flex;align-items:center;gap:4px">${orden.aseguradora?ico('building',12)+' '+escapeHtml(orden.aseguradora):''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px;font-weight:700;font-family:'DM Mono',monospace;color:${pct===100?'var(--verde)':'var(--azul)'}">${pct}%</div>
          <div style="font-size:11px;color:var(--gris-mid)">${comp}/${total} etapas</div>
        </div>
      </div>
      <div style="height:6px;background:var(--gris-borde);border-radius:99px;overflow:hidden;margin-bottom:16px">
        <div style="height:100%;width:${pct}%;background:${pct===100?'var(--verde)':'var(--azul-mid)'};border-radius:99px;transition:width 0.4s"></div>
      </div>
      <div class="info-chips" style="margin-bottom:14px">
        <div class="info-chip"><div class="info-chip-label">Estado</div><div class="info-chip-val">${orden.pulmon?'En Pulmón':orden.estado||'Activa'}</div></div>
        <div class="info-chip"><div class="info-chip-label">Ingreso</div><div class="info-chip-val">${formatFecha(orden.creado_en)}</div></div>
        <div class="info-chip"><div class="info-chip-label">Entrega 1</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_1)||'—'}</div></div>
        <div class="info-chip"><div class="info-chip-label">Entrega 2</div><div class="info-chip-val">${formatFecha(orden.fecha_entrega_2)||'—'}</div></div>
        ${totalVal ? `<div class="info-chip"><div class="info-chip-label">Valor MO</div><div class="info-chip-val" style="color:var(--verde);font-weight:700">${fmt(totalVal)}</div></div>` : ''}
      </div>
      ${activa ? `<div style="padding:10px 14px;background:var(--azul-light);border-radius:6px;margin-bottom:10px;font-size:13px">
        <span style="color:var(--gris-mid)">Etapa actual:</span> <strong>${escapeHtml(activa.etapa)}</strong>${activa.tecnico?` · ${ico('user',12)} ${escapeHtml(activa.tecnico)}`:''}
      </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${srvs.map(s=>`<span style="background:${srvColor[s]||'#6B7280'}15;color:${srvColor[s]||'#6B7280'};border:1px solid ${srvColor[s]||'#6B7280'}30;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600">${CATALOGO[s]?.nombre||s}</span>`).join('')}
      </div>`;
  } catch(e) {
    document.getElementById('mcal-body').innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// VISTA DE ORDEN PARA MECÁNICO (filtrada)
// ═══════════════════════════════════════════════════════════
async function abrirOrdenMecanico(id) {
  mostrarPagina('pag-mec-orden');
  document.getElementById('topbar-title').textContent = 'Detalle de Orden';
  const cont = document.getElementById('mec-orden-contenido');
  if (!cont) return;
  cont.innerHTML = '<div class="loading-state">Cargando...</div>';
  try {
    const [orden, todasEtapas, fotosEt, solicitudes] = await Promise.all([
      api(`/ordenes?id=eq.${id}`).then(d => d[0]),
      api(`/etapas?orden_id=eq.${id}&order=creado_en.asc`).catch(()=>[]) || [],
      api(`/fotos_etapas?orden_id=eq.${id}&order=creado_en.desc`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?orden_id=eq.${id}&order=creado_en.desc&select=*`).catch(()=>[]) || []
    ]);

    // Solo etapas del mecánico actual
    const misEtapas = todasEtapas.filter(e => e.mecanico_id === sesion.id);
    const total = todasEtapas.length;
    const comp  = todasEtapas.filter(e => e.fin).length;
    const todasMisEtapasFin = misEtapas.length > 0 && misEtapas.every(e => !!e.fin);

    // Mapa solicitudes por etapa
    const _estC  = {pendiente_jefe:'#D97706',enviado_repuestos:'#7C3AED',cotizado:'#2563EB',pedido:'#0891B2',recibido_taller:'#059669',entregado:'#059669',rechazado:'#DC2626'};
    const _estBg = {pendiente_jefe:'#FEF3C7',enviado_repuestos:'#EDE9FE',cotizado:'#EBF2FF',pedido:'#E0F2FE',recibido_taller:'#E6F5EF',entregado:'#E6F5EF',rechazado:'#FEE2E2'};
    const _estL  = {pendiente_jefe:'Pendiente',enviado_repuestos:'En gestión',cotizado:'Cotizado',pedido:'Pedido',recibido_taller:'¡Llegó!',entregado:'Entregado ✓',rechazado:'Rechazado'};
    const pct   = total ? Math.round((comp/total)*100) : 0;
    const circ  = 2 * Math.PI * 22;

    const tlHtml = todasEtapas.map((e,i) => {
      const done = !!e.fin, active = !!e.inicio && !e.fin;
      const cls = done ? 'done' : active ? 'active' : 'pending';
      return `<div class="timeline-step ${done?'done':''}">
        <div class="timeline-dot ${cls}">${done?'✓':active?'●':(i+1)}</div>
        <div class="timeline-label ${cls}">${escapeHtml(e.etapa)||'—'}</div>
      </div>`;
    }).join('');

    // Render solo mis etapas
    const etapasHtml = misEtapas.map(e => {
      const k = kid(e.id);
      const esPausado  = e.pausado && !e.fin;
      const etapaSols  = solicitudes.filter(s => s.etapa_id === e.id);
      const hayRepPend = etapaSols.some(s => ['pendiente_jefe','enviado_repuestos','cotizado','pedido','recibido_taller'].includes(s.estado));
      const badge = !e.inicio ? 'Pendiente' : e.fin ? 'Completada' : esPausado ? (hayRepPend ? '⏸ Esperando repuesto' : 'Pausado ⏸') : 'En proceso';
      const bCls  = !e.inicio ? 'pendiente' : e.fin ? 'completada' : esPausado ? 'pendiente' : 'iniciada';
      const eFotos = fotosEt.filter(f => f.etapa_id === e.id);
      let acc = '';
      if (!e.inicio) acc = `<button class="btn btn-success btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-oid="${id}" onclick="mecIniciarEtapaDetalle(+this.dataset.eid,this.dataset.etapa,+this.dataset.oid)">▶ Iniciar</button>`;
      else if (esPausado && hayRepPend) acc = `<span style="font-size:12px;color:#D97706;font-weight:600;display:flex;align-items:center;gap:4px"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Esperando repuesto</span>`;
      else if (!e.fin) acc = `<button class="btn btn-danger btn-sm" data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-srv="${escapeHtml(e.servicio||'')}" data-oid="${id}" onclick="mecFinalizarEtapaDetalle(+this.dataset.eid,this.dataset.etapa,this.dataset.srv,+this.dataset.oid)">■ Finalizar</button>`;

      const fotosHtml = eFotos.map(f=>`<div class="foto-thumb" data-url="${escapeHtml(f.url)}" onclick="abrirLightbox(this.dataset.url)"><img src="${escapeHtml(f.url)}" alt="" loading="lazy"></div>`).join('');

      // Solicitudes de repuesto para esta etapa
      const solsRepHtml = etapaSols.length
        ? etapaSols.map(s => {
            const est = s.estado || 'pendiente_jefe';
            const c = _estC[est] || '#6B7280';
            const bg = _estBg[est] || '#F3F4F6';
            const lbl = _estL[est] || est;
            const esperandoMin = (est === 'pedido' || est === 'enviado_repuestos') && s.creado_en
              ? Math.round((Date.now() - new Date(s.creado_en).getTime()) / 60000) : null;
            const esperandoStr = esperandoMin !== null
              ? `⏱ Esperando hace ${esperandoMin >= 60 ? Math.floor(esperandoMin/60)+'h '+esperandoMin%60+'m' : esperandoMin+'m'}`
              : null;
            return `<div style="padding:8px 0;border-bottom:1px solid var(--gris-borde)">
              <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
                <div style="min-width:0">
                  <div style="font-size:13px;font-weight:600">${escapeHtml(s.repuesto||'Repuesto')}</div>
                  <div style="font-size:11px;color:var(--gris-mid)">x${s.unidades||1}${s.observaciones?' · '+escapeHtml(s.observaciones):''}</div>
                  ${esperandoStr ? `<div style="font-size:11px;color:#D97706;font-weight:600;margin-top:3px">${esperandoStr}</div>` : ''}
                  ${est==='recibido_taller' ? '<div style="font-size:12px;color:#059669;font-weight:600;margin-top:4px">📦 El repuesto llegó al taller. El jefe te lo entregará pronto.</div>' : ''}
                  ${s.nota_jefe && est!=='recibido_taller' ? `<div style="font-size:12px;color:#1E40AF;background:#EBF2FF;border-radius:6px;padding:5px 8px;margin-top:5px">${escapeHtml(s.nota_jefe)}</div>` : ''}
                </div>
                <span style="font-size:10px;font-weight:800;color:${c};background:${bg};padding:3px 8px;border-radius:99px;white-space:nowrap;flex-shrink:0;margin-top:2px">${lbl}</span>
              </div>
            </div>`;
          }).join('')
        : '<div style="font-size:12px;color:var(--gris-mid)">Sin solicitudes.</div>';

      return `<div class="etapa-card" style="margin-bottom:12px${esPausado ? ';border:1.5px solid #F59E0B' : ''}">
        <div class="etapa-header" onclick="toggleEtapa('meb-${k}')" style="${esPausado ? 'background:rgba(254,243,199,.35)' : ''}">
          <div style="flex:1"><div class="etapa-nombre">${escapeHtml(e.etapa)||'—'}</div></div>
          <div style="display:flex;align-items:center;gap:6px">
            <span class="badge badge-${bCls}">${badge}</span>
            ${acc}
          </div>
        </div>
        <div class="etapa-body" id="meb-${k}">
          ${esPausado && hayRepPend ? `<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <svg width="14" height="14" fill="none" stroke="#D97706" stroke-width="2.5" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <span style="font-size:13px;color:#92400E;font-weight:600">Timer pausado — el jefe está gestionando tu repuesto</span>
          </div>` : ''}
          <div class="timestamps" style="margin-bottom:12px">
            <div class="ts-chip">Inicio: <strong>${e.inicio?formatTS(e.inicio):'—'}</strong></div>
            <div class="ts-chip">Fin: <strong>${e.fin?formatTS(e.fin):'—'}</strong></div>
          </div>
          <div class="fotos-section">
            <label style="font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--gris-mid)">Fotos (${eFotos.length})</label>
            <div class="fotos-grid" style="margin-top:6px">${fotosHtml}</div>
            <div class="upload-zone" onclick="document.getElementById('mec-fi2-${k}').click()" style="margin-top:8px">
              <input type="file" id="mec-fi2-${k}" accept="image/*" multiple data-eid="${e.id}" data-etapa="${escapeHtml(e.etapa||'')}" data-oid="${id}" onchange="mecSubirFotos(this,+this.dataset.eid,this.dataset.etapa,+this.dataset.oid)">
              <div style="opacity:0.45">${ico('camera', 20)}</div><p>Subir fotos</p>
              <div class="upload-prog" id="mec-prog2-${k}"></div>
            </div>
          </div>
          <div style="margin-top:14px;border-top:1px solid var(--gris-borde);padding-top:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gris-mid)">Repuestos</span>
              ${!e.fin ? `<button class="btn btn-ghost btn-xs" style="font-size:11px;padding:3px 10px"
                onclick="event.stopPropagation();abrirModalSolicitudRepuesto(${id},${e.id},'${escapeHtml(orden.placa||'').replace(/'/g,"\\x27")}')">+ Solicitar</button>` : ''}
            </div>
            ${solsRepHtml}
          </div>
        </div>
      </div>`;
    }).join('');

    cont.innerHTML = `
      <button class="back-btn" onclick="navMec('ordenes')">← Volver</button>
      <div class="detalle-header-card" style="margin-bottom:16px">
        <div class="detalle-placa-row">
          <div>
            <div class="detalle-placa">${escapeHtml(orden.placa)}</div>
            <div class="detalle-vehiculo">${[orden.marca,orden.linea,orden.modelo,orden.color].filter(Boolean).map(escapeHtml).join(' · ')||'—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <span class="badge badge-${orden.pulmon?'pulmon':(orden.estado||'activa').toLowerCase()}">${orden.pulmon?'En Pulmón':escapeHtml(orden.estado)||'Activa'}</span>
          </div>
        </div>
        <div class="donut-section">
          <svg width="56" height="56" viewBox="0 0 56 56">
            <circle class="donut-track" cx="28" cy="28" r="22"/>
            <circle class="donut-fill ${pct===100?'completa':'proceso'}" cx="28" cy="28" r="22" style="stroke-dasharray:${(pct/100)*circ} ${circ}"/>
            <text class="donut-pct" x="28" y="32" text-anchor="middle">${pct}%</text>
          </svg>
          <div class="donut-info">
            <div class="donut-label">Progreso general</div>
            <div class="donut-val">${comp} / ${total} etapas</div>
            <div class="donut-label" style="margin-top:4px">Fechas de entrega</div>
            <div style="font-size:13px;font-weight:600">${formatFecha(orden.fecha_entrega_1)||'—'}${orden.fecha_entrega_2?' / '+formatFecha(orden.fecha_entrega_2):''}</div>
          </div>
        </div>
        <div class="timeline-wrap"><div class="etapas-timeline">${tlHtml}</div></div>
      </div>
      <div class="seccion-titulo" style="margin-bottom:12px">Mis etapas en esta orden</div>
      ${misEtapas.length ? etapasHtml : '<div class="empty-state"><p>No tenés etapas asignadas en esta orden.</p></div>'}`;
  } catch(e) {
    cont.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
  }
}

async function mecFinalizarEtapaDetalle(eid, nombre, servicio, oid) {
  try {
    const repPend = await api(`/solicitudes_repuesto?etapa_id=eq.${eid}&estado=in.(pendiente_jefe,enviado_repuestos,cotizado,pedido)&select=id,repuesto`).catch(()=>[]) || [];
    if (repPend.length) {
      toast(`No puedes finalizar. Hay ${repPend.length} repuesto(s) pendiente(s): ${repPend.map(r=>r.repuesto).join(', ')}`, 'err');
      return;
    }
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { fin: new Date().toISOString() });
    toast(`${nombre} finalizada ✓`);
    const etapasOrden = await api(`/etapas?orden_id=eq.${oid}&order=creado_en.asc`);
    const etapaActual = etapasOrden.find(e => e.id === eid);
    const todasComp   = etapasOrden.every(e => e.fin || e.id === eid);
    const orden = await api(`/ordenes?id=eq.${oid}`).then(d=>d[0]).catch(()=>({}));
    fetch(N8N_WEBHOOK, { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ evento: todasComp?'orden_completada':'etapa_finalizada',
        orden: {id:oid,placa:orden.placa,propietario:orden.propietario,marca:orden.marca,linea:orden.linea},
        etapa_finalizada: {id:eid,nombre,servicio:etapaActual?.servicio||servicio,tecnico:etapaActual?.tecnico||null},
        todas_completadas:todasComp, link:`${window.location.origin}${window.location.pathname}`})
    }).catch(()=>{});
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

async function mecIniciarEtapaDetalle(eid, nombre, oid) {
  try {
    await api(`/etapas?id=eq.${eid}`, 'PATCH', { inicio: new Date().toISOString() });
    toast(`${nombre} iniciada ✓`);
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: ' + e.message, 'err'); }
}

async function mecGuardarNovedadDetalle(eid, oid) {
  const motivo = document.getElementById(`mec2-nmot-${eid}`)?.value?.trim();
  if (!motivo) { toast('El motivo es obligatorio', 'err'); return; }
  try {
    await api('/novedades', 'POST', {
      orden_id: oid, etapa_id: eid,
      tipo: document.getElementById(`mec2-ntype-${eid}`).value,
      responsable: sesion.nombre,
      motivo, desde: new Date().toISOString(),
      valor_adicional: parseFloat(document.getElementById(`mec2-nvalor-${eid}`)?.value) || null
    }, { Prefer: 'return=minimal' });
    toast('Novedad registrada ✓');
    abrirOrdenMecanico(oid);
  } catch(e) { toast('Error: '+e.message, 'err'); }
}

// ═══════════════════════════════════════════════════════════
// HELPERS REPORTE DESDE VISTAS
// ═══════════════════════════════════════════════════════════
function abrirReporteTecnico(mecId) {
  const overlay = document.getElementById('modal-reporte');
  if (!overlay) { toast('Modal de reporte no encontrado','err'); return; }
  overlay.dataset.tipo = 'tecnico';
  document.getElementById('modal-rep-titulo').textContent = 'Reporte del técnico';
  const selWrap = document.getElementById('rep-sel-tecnico');
  const selId   = document.getElementById('rep-sel-tecnico-id');
  if (selWrap) selWrap.style.display = 'block';
  if (selId)   selId.value = mecId;
  // Llenar select con nombre del técnico
  _cargarSelectTecnicos(mecId);
  overlay.classList.add('show');
}

function abrirReporteTodosTecnicos() {
  abrirModalReporte('todos_tecnicos');
}

function abrirReporteOrdenes() {
  abrirModalReporte('ordenes');
}

async function _cargarSelectTecnicos(preselect) {
  const sel = document.getElementById('rep-sel-tecnico-id');
  if (!sel) return;
  if (sel.options.length <= 1) {
    const mecs = await api('/mecanicos?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    sel.innerHTML = mecs.map(m=>`<option value="${m.id}" ${String(m.id)===String(preselect)?'selected':''}>${escapeHtml(m.nombre)}</option>`).join('');
  } else if (preselect) {
    sel.value = preselect;
  }
}
// ═══════════════════════════════════════════════════════════
// EDITAR DATOS DE ORDEN (solo jefe, solo si no está entregada)
// ═══════════════════════════════════════════════════════════
async function abrirEditarOrden(ordenId) {
  const orden = ordenActual;
  if (!orden) return;

  // Cargar listas dinámicas
  const [aseguradoras, flotillas] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || []
  ]);

  const tipoActual = orden.tipo_cliente || '';
  const esPNatural = !tipoActual || tipoActual === 'particular';
  const esEmpresa  = tipoActual === 'empresa';

  const asegOpts = aseguradoras.map(a =>
    `<option value="${escapeHtml(a.nombre)}" ${orden.aseguradora===a.nombre?'selected':''}>${escapeHtml(a.nombre)}</option>`
  ).join('');
  const flotOpts = flotillas.map(f =>
    `<option value="${escapeHtml(f.nombre)}" ${orden.aseguradora===f.nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`
  ).join('');
  // Las empresas se guardan en la misma tabla /flotillas (ver ingreso de orden),
  // así que el selector de empresa reutiliza esa lista.
  const empOpts = flotillas.map(f =>
    `<option value="${escapeHtml(f.nombre)}" ${orden.aseguradora===f.nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`
  ).join('');

  const modal = document.getElementById('modal-editar-orden');
  const body  = document.getElementById('modal-editar-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">

      <!-- VEHÍCULO -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Placa</label><input id="ed-placa" value="${escapeHtml(orden.placa||'')}" style="font-family:'DM Mono',monospace;letter-spacing:2px;font-size:16px" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="field"><label>N.º de orden (OT)</label><input id="ed-numero-ot" value="${escapeHtml(orden.numero_ot||'')}" placeholder="Automático si se deja vacío" style="font-family:'DM Mono',monospace;font-weight:600" oninput="this.value=this.value.toUpperCase()"></div>
        <div class="field"><label>Marca</label><input id="ed-marca" value="${escapeHtml(orden.marca||'')}"></div>
        <div class="field"><label>Línea</label><input id="ed-linea" value="${escapeHtml(orden.linea||'')}"></div>
        <div class="field"><label>Año</label><input id="ed-modelo" type="number" value="${escapeHtml(orden.modelo||'')}"></div>
        <div class="field"><label>Color</label><input id="ed-color" value="${escapeHtml(orden.color||'')}"></div>
        <div class="field"><label>Kilometraje</label><input id="ed-km" type="number" value="${escapeHtml(String(orden.kilometraje||''))}"></div>
      </div>
      <div class="field">
        <label>VIN <span style="font-weight:400;color:var(--gris-mid);font-size:11px">(17 caracteres, opcional)</span></label>
        <input id="ed-vin" value="${escapeHtml(orden.vin||'')}" maxlength="17" style="font-family:'DM Mono',monospace;letter-spacing:1px" oninput="this.value=this.value.toUpperCase()">
      </div>

      <!-- PROPIETARIO / EMPRESA -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="ed-bloque-propietario">
        <div class="field" id="ed-wrap-nombre" style="grid-column:1/-1">
          <label id="ed-lbl-nombre">Nombre completo</label>
          <input id="ed-propietario" value="${escapeHtml(orden.propietario||'')}">
        </div>
        <div class="field"><label>Teléfono</label><input id="ed-telefono" value="${escapeHtml(orden.telefono||'')}"></div>
        <div class="field"><label id="ed-lbl-doc">Cédula / NIT</label><input id="ed-cedula" value="${escapeHtml(orden.cedula_cliente||'')}"></div>
        <div class="field" style="grid-column:1/-1"><label>Correo electrónico</label><input id="ed-correo" type="email" value="${escapeHtml(orden.correo_cliente||'')}"></div>
      </div>

      <!-- ORDEN -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Tipo de cliente</label>
          <select id="ed-tipo-cliente" onchange="toggleTipoClienteEdit(this.value);toggleTipoPersonaEdit(this.value==='empresa'?'empresa':'natural')">
            <option value="">— Seleccionar —</option>
            <option value="particular" ${tipoActual==='particular'||!tipoActual?'selected':''}>Particular</option>
            <option value="aseguradora" ${tipoActual==='aseguradora'?'selected':''}>Aseguradora</option>
            <option value="flotilla" ${tipoActual==='flotilla'?'selected':''}>Flotilla</option>
            <option value="empresa" ${tipoActual==='empresa'?'selected':''}>Empresa</option>
          </select>
        </div>
        <div class="field" id="ed-wrap-aseg" style="display:${tipoActual==='aseguradora'?'block':'none'}">
          <label>Aseguradora</label>
          <div style="display:flex;gap:6px">
            <select id="ed-aseguradora" style="flex:1">
              <option value="">— Seleccionar —</option>
              ${asegOpts}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="agregarNuevaAseg()" title="Agregar nueva">+</button>
          </div>
        </div>
        <div class="field" id="ed-wrap-flot" style="display:${tipoActual==='flotilla'?'block':'none'}">
          <label>Flotilla</label>
          <div style="display:flex;gap:6px">
            <select id="ed-flotilla" style="flex:1">
              <option value="">— Seleccionar —</option>
              ${flotOpts}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="agregarNuevaFlot()" title="Agregar nueva">+</button>
          </div>
        </div>
        <div class="field" id="ed-wrap-emp" style="display:${tipoActual==='empresa'?'block':'none'}">
          <label>Empresa</label>
          <div style="display:flex;gap:6px">
            <select id="ed-empresa" style="flex:1">
              <option value="">— Seleccionar —</option>
              ${empOpts}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="agregarNuevaEmp()" title="Agregar nueva">+</button>
          </div>
        </div>

        <div class="field"><label>Fecha estimada de entrega</label><input id="ed-fecha1" type="datetime-local" value="${orden.fecha_entrega_1 ? orden.fecha_entrega_1.slice(0,16) : ''}"></div>
        <div class="field"><label>Fecha entrega alternativa</label><input id="ed-fecha2" type="datetime-local" value="${orden.fecha_entrega_2 ? orden.fecha_entrega_2.slice(0,16) : ''}"></div>
      </div>
    </div>
  `;

  // Establecer estado visual inicial
  toggleTipoClienteEdit(tipoActual);
  toggleTipoPersonaEdit(esEmpresa ? 'empresa' : 'natural');

  // Banner + campos resaltados si hay datos faltantes
  const _datosFaltantesEdit = [];
  const _resaltarCampo = (id, label) => {
    const el = document.getElementById(id);
    if (el && !el.value.trim()) {
      el.style.borderColor = '#EF4444';
      el.style.boxShadow = '0 0 0 2px rgba(239,68,68,.15)';
      el.addEventListener('input', function _clear() {
        el.style.borderColor = '';
        el.style.boxShadow = '';
        el.removeEventListener('input', _clear);
        // Quitar banner si ya no hay campos vacíos
        const banner = document.getElementById('ed-datos-faltantes-banner');
        if (banner) {
          const aun = ['ed-propietario','ed-marca','ed-linea','ed-telefono'].some(i => {
            const inp = document.getElementById(i);
            return inp && !inp.value.trim();
          });
          if (!aun) banner.remove();
        }
      }, { once: true });
      _datosFaltantesEdit.push(label);
    }
  };
  _resaltarCampo('ed-propietario', 'Nombre del propietario');
  _resaltarCampo('ed-marca',       'Marca del vehículo');
  _resaltarCampo('ed-linea',       'Línea del vehículo');
  _resaltarCampo('ed-telefono',    'Teléfono de contacto');

  if (_datosFaltantesEdit.length) {
    const banner = document.createElement('div');
    banner.id = 'ed-datos-faltantes-banner';
    banner.style.cssText = 'background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:8px;padding:10px 14px;font-size:13px;color:#92400E;display:flex;align-items:flex-start;gap:8px;margin-bottom:4px';
    banner.innerHTML = `<span style="font-size:15px;flex-shrink:0">⚠</span><div><strong>Faltan datos por completar:</strong><div style="margin-top:3px;font-size:12px;color:#B45309">${_datosFaltantesEdit.join(' · ')}</div></div>`;
    body.insertAdjacentElement('afterbegin', banner);
  }

  modal.classList.add('show');
}

function toggleTipoPersonaEdit(tipo) {
  const lblNombre = document.getElementById('ed-lbl-nombre');
  const lblDoc    = document.getElementById('ed-lbl-doc');
  if (tipo === 'empresa') {
    if (lblNombre) lblNombre.textContent = 'Razón social';
    if (lblDoc)    lblDoc.textContent    = 'NIT';
  } else {
    if (lblNombre) lblNombre.textContent = 'Nombre completo';
    if (lblDoc)    lblDoc.textContent    = 'Cédula';
  }
}

function toggleTipoClienteEdit(tipo) {
  const wAseg = document.getElementById('ed-wrap-aseg');
  const wFlot = document.getElementById('ed-wrap-flot');
  const wEmp  = document.getElementById('ed-wrap-emp');
  if (wAseg) wAseg.style.display = tipo === 'aseguradora' ? 'block' : 'none';
  if (wFlot) wFlot.style.display = tipo === 'flotilla'    ? 'block' : 'none';
  if (wEmp)  wEmp.style.display  = tipo === 'empresa'     ? 'block' : 'none';
}

async function agregarNuevaAseg() {
  const nombre = prompt('Nombre de la nueva aseguradora:')?.trim();
  if (!nombre) return;
  try {
    await api('/aseguradoras', 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    toast('Aseguradora agregada ✓');
    // Recargar select
    const aseg = await api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    const sel = document.getElementById('ed-aseguradora');
    if (sel) {
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        aseg.map(a=>`<option value="${escapeHtml(a.nombre)}" ${a.nombre===nombre?'selected':''}>${escapeHtml(a.nombre)}</option>`).join('');
    }
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function agregarNuevaFlot() {
  const nombre = prompt('Nombre de la nueva flotilla:')?.trim();
  if (!nombre) return;
  try {
    await api('/flotillas', 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    toast('Flotilla agregada ✓');
    const flot = await api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    const sel = document.getElementById('ed-flotilla');
    if (sel) {
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        flot.map(f=>`<option value="${escapeHtml(f.nombre)}" ${f.nombre===nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`).join('');
    }
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function agregarNuevaEmp() {
  const nombre = prompt('Razón social / nombre de la empresa:')?.trim();
  if (!nombre) return;
  try {
    // Las empresas viven en la misma tabla /flotillas (ver ingreso de orden).
    await api('/flotillas', 'POST', { nombre, activo: true }, { Prefer: 'return=minimal' });
    toast('Empresa agregada ✓');
    const emp = await api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || [];
    const sel = document.getElementById('ed-empresa');
    if (sel) {
      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        emp.map(f=>`<option value="${escapeHtml(f.nombre)}" ${f.nombre===nombre?'selected':''}>${escapeHtml(f.nombre)}</option>`).join('');
    }
  } catch(e) { toast('Error: '+e.message,'err'); }
}

async function guardarEdicionOrden() {
  const btn = document.getElementById('btn-guardar-edicion');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

  try {
    const tipoPersona = document.querySelector('input[name="ed-tipo-persona"]:checked')?.value || 'natural';
    const tipoCliente = document.getElementById('ed-tipo-cliente')?.value || null;
    const vin = document.getElementById('ed-vin')?.value.trim().toUpperCase() || null;
    // No bloquear la edición por el VIN: si no tiene 17 caracteres avisamos, pero
    // se guarda igual. Antes hacía return y cortaba TODO el guardado (incluida la
    // fecha de entrega), así que un VIN imperfecto impedía editar cualquier dato.
    if (vin && vin.length !== 17) { toast('Aviso: el VIN no tiene 17 caracteres (se guardó igual)', 'warn'); }

    // Aseguradora / flotilla según tipo
    let aseguradora = null;
    if (tipoCliente === 'aseguradora') {
      aseguradora = document.getElementById('ed-aseguradora')?.value || null;
    } else if (tipoCliente === 'flotilla') {
      aseguradora = document.getElementById('ed-flotilla')?.value || null;
    } else if (tipoCliente === 'empresa') {
      aseguradora = document.getElementById('ed-empresa')?.value || null;
    }

    const patch = {
      numero_ot:       document.getElementById('ed-numero-ot')?.value.trim() || null,
      placa:           (document.getElementById('ed-placa')?.value.trim().toUpperCase()) || ordenActual.placa,
      marca:           document.getElementById('ed-marca')?.value.trim()    || null,
      linea:           document.getElementById('ed-linea')?.value.trim()    || null,
      modelo:          document.getElementById('ed-modelo')?.value          || null,
      color:           document.getElementById('ed-color')?.value.trim()    || null,
      kilometraje:     parseInt(document.getElementById('ed-km')?.value)    || null,
      vin:             vin,
      propietario:     document.getElementById('ed-propietario')?.value.trim() || null,
      telefono:        document.getElementById('ed-telefono')?.value.trim() || null,
      cedula_cliente:  (typeof normDoc === 'function' ? normDoc(document.getElementById('ed-cedula')?.value) : (document.getElementById('ed-cedula')?.value.trim())) || null,
      correo_cliente:  document.getElementById('ed-correo')?.value.trim()   || null,
      tipo_cliente:    tipoPersona === 'empresa' ? 'empresa' : (tipoCliente || null),
      aseguradora:     aseguradora,
      nivel_dano:      document.getElementById('ed-dano')?.value            || null,
      fecha_entrega_1: document.getElementById('ed-fecha1')?.value          || null,
      fecha_entrega_2: document.getElementById('ed-fecha2')?.value          || null,
    };

    await api(`/ordenes?id=eq.${ordenActual.id}`, 'PATCH', patch);
    Object.assign(ordenActual, patch); // reflejar el cambio en memoria al instante
    toast('Datos actualizados ✓');
    document.getElementById('modal-editar-orden')?.classList.remove('show');
    abrirOrden(ordenActual.id); // Recargar detalle
    // Refrescar AL INSTANTE las vistas con indicadores operativos (lista,
    // capacidad y dashboard), para que un cambio como la fecha de entrega se
    // refleje de una (p. ej. deja de aparecer "atrasada").
    try { if (typeof _refrescarCapacidad === 'function') _refrescarCapacidad(); } catch (e) {}
    try { if (typeof cargarDashboardMes === 'function') cargarDashboardMes(); } catch (e) {}
    try { if (typeof cargarDashboard === 'function') cargarDashboard(); } catch (e) {}
    try { if (typeof cargarKPITaller === 'function') cargarKPITaller(); } catch (e) {}
    try { if (typeof filtroEstado !== 'undefined' && filtroEstado !== null && typeof cargarOrdenes === 'function') cargarOrdenes(); } catch (e) {}
  } catch(e) {
    toast('Error: '+e.message,'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar cambios'; }
  }
}
// ── Combustible (dropdown en inventario) ─────────────────────
const _COMB_LABELS = { vacio:'Vacío', '1/4':'1/4 tanque', '1/2':'1/2 tanque', '3/4':'3/4 tanque', lleno:'Lleno' };

function abrirDropdownCombustible(e, el) {
  e.stopPropagation();
  const dd = document.getElementById('comb-dropdown');
  if (!dd) return;
  const rect = el.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  dd.style.top      = (rect.bottom + scrollY + 4) + 'px';
  dd.style.left     = rect.left + 'px';
  dd.style.minWidth = rect.width + 'px';
  dd.classList.toggle('open');
}

function seleccionarCombustible(valor) {
  const item   = document.getElementById('inv-combustible-item');
  const label  = document.getElementById('inv-combustible-label');
  const hidden = document.getElementById('n-combustible-val');
  if (hidden) hidden.value = valor;
  if (label)  label.textContent = _COMB_LABELS[valor] || 'Combustible';
  if (item)   item.classList.add('checked');
  document.getElementById('comb-dropdown')?.classList.remove('open');
}

document.addEventListener('click', () => {
  const dd = document.getElementById('comb-dropdown');
  if (dd?.classList.contains('open')) dd.classList.remove('open');
});

// ── Reset nueva orden ────────────────────────────────────────
function resetNuevaOrden() {
  _ordenCompletandoId = null; // formulario fresco = crear, no completar
  ['n-placa','n-numero-ot','n-marca','n-linea','n-modelo','n-color','n-km','n-fecha1','n-fecha2',
   'n-inv-obs','n-vin','n-propietario','n-telefono','n-cedula-cliente','n-correo-cliente',
   'n-direccion','n-descripcion-general','n-propietario-aseg','n-telefono-aseg','n-cedula-aseg','n-correo-aseg',
   'n-aseg-nombre','n-aseg-nit','n-flot-nombre','n-flot-nit','n-flot-dir',
   'n-emp-nombre','n-emp-nit','n-empresa-tel','n-combustible-val'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const _kmChk2 = document.getElementById('n-km-omitir');
  if (_kmChk2) { _kmChk2.checked = false; }
  const _kmInp2 = document.getElementById('n-km');
  if (_kmInp2) { _kmInp2.disabled = false; _kmInp2.style.opacity = '1'; }
  document.querySelectorAll('.inv-item.checked').forEach(el => el.classList.remove('checked'));
  const _ci = document.getElementById('inv-combustible-item');
  const _cl = document.getElementById('inv-combustible-label');
  if (_ci) _ci.classList.remove('checked');
  if (_cl) _cl.textContent = 'Combustible';
  document.querySelectorAll('.tipo-cliente-btn.selected').forEach(el => el.classList.remove('selected'));
  ['n-wrap-particular','n-wrap-aseg','n-wrap-flot','n-wrap-empresa'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['n-wrap-aseg-extra','n-wrap-flot-extra','n-wrap-empresa-extra'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  document.getElementById('n-tipo-cliente') && (document.getElementById('n-tipo-cliente').value = '');
  document.getElementById('placa-resultado') && (document.getElementById('placa-resultado').style.display = 'none');
  document.getElementById('historial-previo') && (document.getElementById('historial-previo').style.display = 'none');
  document.getElementById('ocr-estado') && (document.getElementById('ocr-estado').style.display = 'none');
  const tipoErrEl = document.getElementById('n-tipo-cliente-error');
  if (tipoErrEl) tipoErrEl.style.display = 'none';
  cerrarSugerenciasPlaca();
  fotosIngresoPendientes = [];
  if (typeof renderPreviewIngreso === 'function') renderPreviewIngreso();
  // Limpiar daños del vehículo
  document.querySelectorAll('.dano-cb').forEach(cb => { cb.checked = false; });
  const tipoCarEl = document.getElementById('n-tipo-carroceria');
  if (tipoCarEl) tipoCarEl.value = '';
  // Reset wizard al paso 1
  _resetWizard();
}

async function recargarListasNuevaOrden() {
  const [aseg, flot, mecs, jefeCfg] = await Promise.all([
    api('/aseguradoras?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/flotillas?activo=eq.true&order=nombre.asc').catch(()=>[]) || [],
    api('/mecanicos?activo=eq.true&order=nombre.asc&select=id,nombre,es_asesor').catch(()=>[]) || [],
    api('/configuracion?clave=eq.jefe_nombre&select=valor').catch(()=>[]) || []
  ]);
  ['n-aseguradora-sel','n-flotilla-sel','n-empresa-sel'].forEach((id, i) => {
    const sel = document.getElementById(id);
    const lista = i === 0 ? aseg : flot;
    if (sel) sel.innerHTML = '<option value="">— Seleccionar —</option>' +
      lista.map(x => `<option value="${escapeHtml(x.nombre)}">${escapeHtml(x.nombre)}</option>`).join('');
  });
  // Asesor de servicio: operarios marcados como asesor + el jefe de taller
  // (mismo criterio que las encuestas, para que coincidan).
  const selAsesor = document.getElementById('n-asesor');
  if (selAsesor) {
    const asesores = mecs.filter(m => m.es_asesor);
    const jefeNom = jefeCfg[0]?.valor;
    selAsesor.innerHTML = '<option value="">— Seleccionar —</option>' +
      asesores.map(m => `<option value="${m.id}">${escapeHtml(m.nombre)}</option>`).join('') +
      (jefeNom ? `<option value="jefe">${escapeHtml(jefeNom)} (jefe)</option>` : '');
    if (sesion?.id && asesores.some(m => Number(m.id) === Number(sesion.id))) selAsesor.value = sesion.id;
  }
}
// ═══════════════════════════════════════════════════════════
// PRELIQUIDACIÓN — PDF con resumen de la orden
// ═══════════════════════════════════════════════════════════
async function generarPreliquidacion(ordenId, conPrecios = false) {
  try {
    toast('Generando preliquidación...');

    const [orden, etapas, novedades, solicitudes] = await Promise.all([
      api(`/ordenes?id=eq.${ordenId}`).then(r => r?.[0]).catch(()=>null),
      api(`/etapas?orden_id=eq.${ordenId}&order=creado_en.asc&select=*`).catch(()=>[]) || [],
      api(`/novedades?orden_id=eq.${ordenId}&tipo=neq.Comentario&select=*`).catch(()=>[]) || [],
      api(`/solicitudes_repuesto?orden_id=eq.${ordenId}&estado=in.(recibido_taller,entregado)&select=*`).catch(()=>[]) || []
    ]);

    // Cotizaciones e ítems de cada solicitud de repuesto
    const solIds = solicitudes.map(s => s.id);
    const [cotizaciones, solItems] = solIds.length ? await Promise.all([
      api(`/cotizaciones_repuesto?solicitud_id=in.(${solIds.join(',')})&precio_venta_jefe=not.is.null&select=*,proveedores(nombre)`).catch(()=>[]) || [],
      api(`/solicitud_items?solicitud_id=in.(${solIds.join(',')})&order=creado_en.asc`).catch(()=>[]) || []
    ]) : [[], []];

    if (!orden) { toast('No se encontró la orden', 'err'); return; }

    const fmt = n => n != null
      ? new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',minimumFractionDigits:0}).format(n)
      : '$0';
    const fmtFecha = iso => iso
      ? new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})
      : '—';
    const fmtHora = iso => iso
      ? new Date(iso).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})
      : '—';
    const durMin = (ini, fin) => {
      if (!ini || !fin) return '—';
      const m = Math.round((new Date(fin) - new Date(ini)) / 60000);
      return `${Math.floor(m/60)}h ${m%60}m`;
    };

    const totalManoObra = etapas.reduce((s,e) => s+(e.valor||0), 0);
    const totalVenta = etapas.reduce((s,e) => s+(e.valor_venta||0), 0); // precio venta real (cliente)
    const totalHorasFact = etapas.reduce((s,e) => s+(e.horas_facturadas||0), 0);
    const totalHorasAdi  = etapas.reduce((s,e) => s+(e.horas_adicionales||0), 0);

    // Agrupar etapas por servicio
    const servicios = {};
    etapas.forEach(e => {
      const s = e.servicio || 'adicionales';
      if (!servicios[s]) servicios[s] = [];
      servicios[s].push(e);
    });

    const srvNombres = { latoneria:'Latonería', pintura:'Pintura', mecanica:'Mecánica', adicionales:'Adicionales' };
    const srvColor   = { latoneria:'#DC2626', pintura:'#D97706', mecanica:'#2563EB', adicionales:'#059669' };

    const etapasHtml = Object.entries(servicios).map(([srv, ets]) => `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${srvColor[srv]||'#374151'};border-bottom:2px solid ${srvColor[srv]||'#374151'};padding-bottom:5px;margin-bottom:10px">
          ${srvNombres[srv]||srv}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#F8FAFC">
              <th style="padding:7px 10px;text-align:left;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Etapa</th>
              <th style="padding:7px 10px;text-align:left;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Técnico</th>
              <th style="padding:7px 10px;text-align:center;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Duración</th>
              <th style="padding:7px 10px;text-align:center;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">H. Fact.</th>
              <th style="padding:7px 10px;text-align:right;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #E2E8F0">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${ets.map(e => `
              <tr style="border-bottom:1px solid #F1F5F9">
                <td style="padding:8px 10px;font-weight:600;color:#1E293B">${escapeHtml(e.etapa)||'—'}</td>
                <td style="padding:8px 10px;color:#64748B">${escapeHtml(e.tecnico)||'—'}</td>
                <td style="padding:8px 10px;text-align:center;color:#64748B;font-family:monospace">${durMin(e.inicio,e.fin)}</td>
                <td style="padding:8px 10px;text-align:center;color:#64748B">${e.horas_facturadas||'—'}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:600;color:#1E293B;font-family:monospace">${fmt(e.valor)}</td>
              </tr>`).join('')}
            <tr style="background:#F8FAFC;font-weight:700">
              <td colspan="4" style="padding:8px 10px;color:#374151;font-size:12px">Subtotal ${srvNombres[srv]||srv}</td>
              <td style="padding:8px 10px;text-align:right;color:${srvColor[srv]||'#374151'};font-family:monospace">${fmt(ets.reduce((s,e)=>s+(e.valor||0),0))}</td>
            </tr>
          </tbody>
        </table>
      </div>`).join('');

    // ── Repuestos ──────────────────────────────────────────
    const totalRepuestos = solicitudes.reduce((acc, sol) => {
      const cot = cotizaciones.find(c => c.solicitud_id === sol.id);
      return acc + (cot?.precio_venta_jefe || 0);
    }, 0);

    const repuestosHtml = solicitudes.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#7C3AED;border-bottom:2px solid #7C3AED;padding-bottom:5px;margin-bottom:10px">
          Repuestos utilizados
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#F5F3FF">
              <th style="padding:7px 10px;text-align:left;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Repuesto</th>
              <th style="padding:7px 10px;text-align:center;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Cant.</th>
              <th style="padding:7px 10px;text-align:left;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Proveedor</th>
              <th style="padding:7px 10px;text-align:center;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Tipo</th>
              ${conPrecios ? '<th style="padding:7px 10px;text-align:right;color:#7C3AED;font-size:10px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #DDD6FE">Precio venta</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${solicitudes.map(sol => {
              const cot   = cotizaciones.find(c => c.solicitud_id === sol.id);
              const items = solItems.filter(i => i.solicitud_id === sol.id);
              const filas = items.length ? items : [{ repuesto: sol.repuesto, unidades: sol.unidades||1 }];
              return filas.map((item, idx) => `
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:7px 10px;font-weight:600;color:#1E293B">${escapeHtml(item.repuesto||'—')}</td>
                  <td style="padding:7px 10px;text-align:center;color:#64748B">${item.unidades||1}</td>
                  <td style="padding:7px 10px;color:#64748B">${escapeHtml(cot?.proveedores?.nombre||'—')}</td>
                  <td style="padding:7px 10px;text-align:center;color:#64748B">${cot?.es_original === false ? 'Genérico' : 'Original'}</td>
                  ${conPrecios ? `<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:600;color:#1E293B">${idx === 0 ? fmt(cot?.precio_venta_jefe) : ''}</td>` : ''}
                </tr>`).join('');
            }).join('')}
          </tbody>
          ${conPrecios ? `<tfoot><tr style="background:#F5F3FF">
            <td colspan="4" style="padding:8px 10px;font-weight:700;color:#5B21B6">Total repuestos</td>
            <td style="padding:8px 10px;text-align:right;font-family:monospace;font-weight:700;color:#5B21B6">${fmt(totalRepuestos)}</td>
          </tr></tfoot>` : ''}
        </table>
      </div>` : '';

    const novedadesHtml = novedades.length ? `
      <div style="margin-bottom:20px">
        <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#DC2626;border-bottom:2px solid #DC2626;padding-bottom:5px;margin-bottom:10px">Novedades</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#FEF2F2">
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Tipo</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Motivo</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Responsable</th>
            <th style="padding:7px 10px;text-align:left;color:#DC2626;font-size:10px;text-transform:uppercase;border-bottom:1px solid #FECACA">Fecha</th>
          </tr></thead>
          <tbody>
            ${novedades.map(n=>`<tr style="border-bottom:1px solid #FEE2E2">
              <td style="padding:7px 10px;font-weight:600">${escapeHtml(n.tipo)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B">${escapeHtml(n.motivo)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B">${escapeHtml(n.responsable)||'—'}</td>
              <td style="padding:7px 10px;color:#64748B;font-size:11px">${fmtHora(n.creado_en)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    // ── SVGs bocetos de vehículo — siluetas reconocibles ─────────────────────
    const S = 'fill="none" stroke="#333"';

    // ── SEDAN LATERAL IZQ (carro de frente a la derecha) ──
    const _svgSL = `<svg viewBox="0 0 200 72" width="190" height="68" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 14,54 Q 8,54 8,50 L 8,44 Q 10,38 22,34 Q 34,28 54,22 L 68,12 Q 78,8 96,8 L 124,8 Q 148,8 160,16 L 176,28 Q 184,34 186,44 L 188,50 Q 188,54 184,54 L 163,54 Q 162,68 150,68 Q 138,68 137,54 L 63,54 Q 62,68 50,68 Q 38,68 37,54 Z"/>
      <circle ${S} stroke-width="1.4" cx="50" cy="60" r="10"/>
      <circle ${S} stroke-width="0.9" cx="50" cy="60" r="4"/>
      <circle ${S} stroke-width="1.4" cx="150" cy="60" r="10"/>
      <circle ${S} stroke-width="0.9" cx="150" cy="60" r="4"/>
      <path ${S} stroke-width="1" d="M 68,12 L 62,44 L 97,44 L 102,9"/>
      <path ${S} stroke-width="1" d="M 104,9 L 99,44 L 138,44 L 152,18"/>
      <line ${S} stroke-width="0.7" x1="97" y1="44" x2="102" y2="9"/>
      <rect ${S} stroke-width="1" x="9" y="40" width="10" height="9" rx="1.5"/>
      <rect ${S} stroke-width="1" x="182" y="38" width="10" height="10" rx="1.5"/>
      <line ${S} stroke-width="1" x1="76" y1="30" x2="86" y2="30"/>
      <line ${S} stroke-width="1" x1="112" y1="30" x2="122" y2="30"/>
    </svg>`;

    // ── SEDAN LATERAL DER (espejo) ──
    const _svgSD = `<svg viewBox="0 0 200 72" width="190" height="68" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1,1) translate(-200,0)">${_svgSL.replace(/<svg[^>]*>/,'').replace('</svg>','')}</g></svg>`;

    // ── SEDAN FRONTAL ──
    const _svgSF = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 8,80 Q 4,80 4,76 L 4,58 Q 4,52 10,50 L 10,26 Q 10,20 16,16 L 30,6 Q 38,2 52,2 L 78,2 Q 92,2 100,6 L 114,16 Q 120,20 120,26 L 120,50 Q 126,52 126,58 L 126,76 Q 126,80 122,80 Z"/>
      <path ${S} stroke-width="1" d="M 30,4 L 26,30 L 104,30 L 100,4 Z"/>
      <path ${S} stroke-width="1" d="M 10,26 L 10,50 Q 11,54 18,54 L 30,54 Q 36,54 38,48 L 38,26 Z"/>
      <path ${S} stroke-width="1" d="M 92,26 L 92,48 Q 94,54 100,54 L 112,54 Q 119,54 120,50 L 120,26 Z"/>
      <rect ${S} stroke-width="1" x="38" y="52" width="54" height="20" rx="2"/>
      <line ${S} stroke-width="0.6" x1="38" y1="59" x2="92" y2="59"/>
      <line ${S} stroke-width="0.6" x1="38" y1="66" x2="92" y2="66"/>
      <line ${S} stroke-width="0.6" x1="57" y1="52" x2="57" y2="72"/>
      <line ${S} stroke-width="0.6" x1="73" y1="52" x2="73" y2="72"/>
      <path ${S} stroke-width="1.2" d="M 4,76 Q 4,88 10,88 L 120,88 Q 126,88 126,76"/>
      <rect ${S} stroke-width="0.8" x="48" y="74" width="34" height="10" rx="1"/>
    </svg>`;

    // ── SEDAN TRASERA ──
    const _svgST = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 8,80 Q 4,80 4,76 L 4,58 Q 4,52 10,50 L 10,26 Q 10,20 16,16 L 30,6 Q 38,2 52,2 L 78,2 Q 92,2 100,6 L 114,16 Q 120,20 120,26 L 120,50 Q 126,52 126,58 L 126,76 Q 126,80 122,80 Z"/>
      <path ${S} stroke-width="1" d="M 34,4 L 30,28 L 100,28 L 96,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="28" width="26" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="19" y1="28" x2="19" y2="50"/>
      <rect ${S} stroke-width="1.1" x="98" y="28" width="26" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="111" y1="28" x2="111" y2="50"/>
      <line ${S} stroke-width="1" x1="32" y1="28" x2="98" y2="28"/>
      <line ${S} stroke-width="0.8" x1="32" y1="50" x2="98" y2="50"/>
      <path ${S} stroke-width="1.2" d="M 4,76 Q 4,88 10,88 L 120,88 Q 126,88 126,76"/>
      <rect ${S} stroke-width="0.8" x="46" y="54" width="38" height="14" rx="1"/>
    </svg>`;

    // ── CAMIONETA / SUV LATERAL IZQ ──
    const _svgCL = `<svg viewBox="0 0 210 75" width="200" height="71" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 14,56 Q 8,56 8,52 L 8,44 Q 8,38 14,36 Q 22,32 40,28 L 54,16 Q 62,10 78,8 L 108,8 Q 112,8 112,14 L 112,56 L 67,56 Q 66,70 54,70 Q 42,70 41,56 Z"/>
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 112,14 L 112,8 L 192,8 L 196,14 L 196,56 L 171,56 Q 170,70 158,70 Q 146,70 145,56 L 112,56"/>
      <circle ${S} stroke-width="1.4" cx="54" cy="62" r="11"/>
      <circle ${S} stroke-width="0.9" cx="54" cy="62" r="4.5"/>
      <circle ${S} stroke-width="1.4" cx="158" cy="62" r="11"/>
      <circle ${S} stroke-width="0.9" cx="158" cy="62" r="4.5"/>
      <path ${S} stroke-width="1" d="M 54,16 L 48,44 L 90,44 L 94,10"/>
      <path ${S} stroke-width="1" d="M 96,10 L 92,44 L 110,44 L 112,8"/>
      <line ${S} stroke-width="0.7" x1="90" y1="44" x2="94" y2="10"/>
      <line ${S} stroke-width="1" x1="112" y1="8" x2="112" y2="56"/>
      <rect ${S} stroke-width="1" x="9" y="40" width="10" height="10" rx="1.5"/>
      <rect ${S} stroke-width="1" x="193" y="26" width="10" height="22" rx="1.5"/>
      <line ${S} stroke-width="1" x1="72" y1="30" x2="82" y2="30"/>
    </svg>`;

    // ── CAMIONETA LATERAL DER (espejo) ──
    const _svgCD = `<svg viewBox="0 0 210 75" width="200" height="71" xmlns="http://www.w3.org/2000/svg"><g transform="scale(-1,1) translate(-210,0)">${_svgCL.replace(/<svg[^>]*>/,'').replace('</svg>','')}</g></svg>`;

    // ── CAMIONETA FRONTAL ──
    const _svgCF = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 6,82 Q 4,82 4,78 L 4,58 Q 4,52 8,50 L 8,22 Q 8,16 14,14 L 22,6 Q 28,2 40,2 L 90,2 Q 102,2 108,6 L 116,14 Q 122,16 122,22 L 122,50 Q 126,52 126,58 L 126,78 Q 126,82 124,82 Z"/>
      <path ${S} stroke-width="1" d="M 22,4 L 18,28 L 112,28 L 108,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="28" width="28" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="20" y1="28" x2="20" y2="50"/>
      <rect ${S} stroke-width="1.1" x="96" y="28" width="28" height="22" rx="1"/>
      <line ${S} stroke-width="0.6" x1="110" y1="28" x2="110" y2="50"/>
      <rect ${S} stroke-width="1" x="34" y="50" width="62" height="22" rx="2"/>
      <line ${S} stroke-width="0.6" x1="34" y1="58" x2="96" y2="58"/>
      <line ${S} stroke-width="0.6" x1="34" y1="65" x2="96" y2="65"/>
      <line ${S} stroke-width="0.6" x1="55" y1="50" x2="55" y2="72"/>
      <line ${S} stroke-width="0.6" x1="75" y1="50" x2="75" y2="72"/>
      <path ${S} stroke-width="1.2" d="M 4,78 Q 4,88 10,88 L 120,88 Q 126,88 126,78"/>
      <rect ${S} stroke-width="0.8" x="46" y="74" width="38" height="10" rx="1"/>
    </svg>`;

    // ── CAMIONETA TRASERA ──
    const _svgCT = `<svg viewBox="0 0 130 90" width="120" height="83" xmlns="http://www.w3.org/2000/svg">
      <path ${S} stroke-width="1.6" stroke-linejoin="round"
        d="M 6,82 Q 4,82 4,78 L 4,58 Q 4,52 8,50 L 8,22 Q 8,16 14,14 L 22,6 Q 28,2 40,2 L 90,2 Q 102,2 108,6 L 116,14 Q 122,16 122,22 L 122,50 Q 126,52 126,58 L 126,78 Q 126,82 124,82 Z"/>
      <path ${S} stroke-width="1" d="M 30,4 L 26,26 L 104,26 L 100,4 Z"/>
      <rect ${S} stroke-width="1.1" x="6" y="26" width="28" height="24" rx="1"/>
      <line ${S} stroke-width="0.6" x1="20" y1="26" x2="20" y2="50"/>
      <rect ${S} stroke-width="1.1" x="96" y="26" width="28" height="24" rx="1"/>
      <line ${S} stroke-width="0.6" x1="110" y1="26" x2="110" y2="50"/>
      <line ${S} stroke-width="1" x1="34" y1="26" x2="96" y2="26"/>
      <line ${S} stroke-width="0.8" x1="34" y1="50" x2="96" y2="50"/>
      <path ${S} stroke-width="1.2" d="M 4,78 Q 4,88 10,88 L 120,88 Q 126,88 126,78"/>
      <rect ${S} stroke-width="0.8" x="44" y="54" width="42" height="16" rx="1"/>
    </svg>`;

    const _baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    const _logoUrl  = _baseUrl + 'icons/Logo_Fondo_Taller.png';

    // Orden de trabajo de ASEGURADORA: muestra solo el total (precio_venta_cliente
    // que fija el jefe), sin detalle de procesos ni repuestos. Los demás tipos de
    // cliente (particular/empresa/flotilla) llevan el detalle completo.
    const esAseg = orden.tipo_cliente === 'aseguradora';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<base href="${_baseUrl}">
<title>Preliquidación ${escapeHtml(orden.placa)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;font-size:9px;line-height:1.35;background:#fff}
@page{size:A4 landscape;margin:5mm 7mm}

/* Tablas */
table{width:100%;border-collapse:collapse;font-size:8.5px}
th{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:3.5px 7px;background:#1a1a1a;color:#fff;text-align:left;border:none}
td{padding:3px 7px;border-bottom:1px solid #E5E7EB;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#F9FAFB}

/* Etiquetas y valores */
.lbl{font-size:7.5px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px;font-weight:600}
.val{font-weight:700;font-size:10px;color:#111}
.sh{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;background:#1a1a1a;color:#fff;padding:4px 10px}
.money{font-family:'Courier New',monospace;font-weight:700}

/* Totales */
.total-row{display:flex;justify-content:space-between;align-items:center;padding:5px 10px;font-size:9.5px;border-bottom:1px solid #E5E7EB}
.total-final{background:#1a1a1a;color:#fff;font-weight:900;font-size:12px;padding:8px 10px;display:flex;justify-content:space-between;margin-top:4px}

@media print{
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{margin:0}
}
</style>
</head>
<body>
<div style="padding:2px 0 8px">

<!-- ENCABEZADO -->
<div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2.5px solid #1a1a1a;padding-bottom:6px;margin-bottom:8px">
  <div style="display:flex;align-items:center;gap:10px">
    <img src="${_logoUrl}" alt="Logo" style="height:42px;width:42px;object-fit:contain">
    <div>
      <div style="font-weight:900;font-size:14px;color:#1a1a1a;letter-spacing:.3px;line-height:1.15">FREIMANAUTOS S.A.</div>
      <div style="font-size:7.5px;color:#6B7280;margin-top:2px">NIT 860.012.186-5</div>
      <div style="font-size:7.5px;color:#6B7280">Calle 98A #68D-15 Bogotá D.C.</div>
      <div style="font-size:7.5px;color:#6B7280">Tel: (601) 742 6450</div>
    </div>
  </div>
  <div style="text-align:center">
    <div style="font-size:21px;font-weight:900;color:#1a1a1a;letter-spacing:2px">ORDEN DE TRABAJO</div>
    <div style="font-size:8px;color:#6B7280;margin-top:2px">Documento preliminar — no constituye factura</div>
  </div>
  <div style="border:2px solid #1a1a1a;border-radius:4px;padding:5px 12px;text-align:center;min-width:140px">
    <div style="font-size:7px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px">Placa</div>
    <div style="font-size:17px;font-weight:900;letter-spacing:3px;color:#1a1a1a;line-height:1.15">${escapeHtml(orden.placa)}</div>
    <div style="border-top:1px solid #E5E7EB;margin:4px 0 3px"></div>
    <div style="font-size:7px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px">N° Orden</div>
    <div style="font-size:12px;font-weight:900;font-family:'Courier New',monospace;color:#1a1a1a">${otDe(orden)}</div>
    <div style="font-size:7px;color:#6B7280;margin-top:2px">${new Date().toLocaleDateString('es-CO',{day:'2-digit',month:'long',year:'numeric'})} · ${new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
  </div>
</div>

<!-- FILA INFO: 1.Cliente | 2.Vehículo | 3.Fechas/Daños -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;margin-bottom:7px">

  <!-- 1. CLIENTE -->
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">1. Cliente</div>
    <div style="padding:10px 12px">
      <div style="margin-bottom:6px"><div class="lbl">Nombre</div><div class="val" style="font-size:10px">${escapeHtml(orden.propietario)||'—'}</div></div>
      <div style="margin-bottom:6px"><div class="lbl">Teléfono</div><div class="val" style="font-size:9.5px">${escapeHtml(orden.telefono)||'—'}</div></div>
      <div style="margin-bottom:6px"><div class="lbl">Email</div><div style="font-size:8.5px;color:#374151;word-break:break-all">${escapeHtml(orden.correo_cliente||orden.email||'—')}</div></div>
      ${orden.direccion ? `<div style="margin-bottom:6px"><div class="lbl">Dirección</div><div style="font-size:8.5px;color:#374151">${escapeHtml(orden.direccion)}</div></div>` : ''}
      <div${orden.aseguradora?' style="margin-bottom:6px"':''}><div class="lbl">Tipo de cliente</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.tipo_cliente)||'Particular'}</div></div>
      ${orden.aseguradora ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">Aseguradora</div><div class="val" style="color:#1a1a1a;font-size:9.5px">${escapeHtml(orden.aseguradora)}</div></div>` : ''}
    </div>
  </div>

  <!-- 2. VEHÍCULO -->
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">2. Vehículo</div>
    <div style="padding:10px 12px">
      <div style="margin-bottom:6px"><div class="lbl">Marca / Línea</div><div class="val" style="font-size:10px">${escapeHtml(orden.marca)||'—'} ${escapeHtml(orden.linea)||''}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;margin-bottom:6px">
        <div><div class="lbl">Año / Modelo</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.modelo)||'—'}</div></div>
        <div><div class="lbl">Color</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.color)||'—'}</div></div>
        <div><div class="lbl">Kilometraje</div><div style="font-weight:600;color:#374151">${orden.kilometraje ? orden.kilometraje.toLocaleString('es-CO')+' km' : '—'}</div></div>
        <div><div class="lbl">Carrocería</div><div style="font-weight:600;color:#374151">${escapeHtml(orden.tipo_carroceria||'—')}</div></div>
      </div>
      ${orden.vin ? `<div style="padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">VIN / No. Chasis</div><div style="font-family:monospace;font-size:8.5px;color:#374151;letter-spacing:.5px">${escapeHtml(orden.vin)}</div></div>` : ''}
      ${!esAseg && orden.descripcion_general ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB"><div class="lbl">Descripción</div><div style="font-size:8.5px;line-height:1.5;color:#374151">${escapeHtml(orden.descripcion_general)}</div></div>` : ''}
    </div>
  </div>

  <!-- 3. FECHAS Y DAÑOS -->
  <div>
    <div class="sh">3. Fechas / Estado</div>
    <div style="padding:10px 12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;margin-bottom:8px">
        <div><div class="lbl">Fecha de ingreso</div><div class="val" style="font-size:9px">${fmtFecha(orden.creado_en)}</div></div>
        <div><div class="lbl">Entrega prometida</div><div class="val" style="color:#D97706;font-size:9px">${fmtFecha(orden.fecha_entrega_1)}</div></div>
        <div><div class="lbl">Estado</div><div style="font-weight:700;color:#059669;font-size:9.5px">${escapeHtml(orden.estado||'Activa')}</div></div>
        ${orden.aseguradora ? `<div style="grid-column:span 2;padding-top:4px;border-top:1px solid #E5E7EB"><div class="lbl">Aseguradora</div><div class="val" style="font-size:9px">${escapeHtml(orden.aseguradora)}</div></div>` : ''}
      </div>
      <div style="border-top:1px solid #E5E7EB;padding-top:7px">
        <div class="lbl" style="margin-bottom:4px">Daños registrados</div>
        ${(() => {
          const danos = (() => { try { return JSON.parse(orden.danos_vehiculo||'null')||{}; } catch{return{};} })();
          const hasDanos = Object.values(danos).some(a=>a?.length>0);
          const tipoLabels = {rayon:'Rayón',golpe:'Golpe',abolladura:'Abolladura',pieza_faltante:'Pieza faltante'};
          const tipoColores = {rayon:'#F59E0B',golpe:'#EF4444',abolladura:'#F97316',pieza_faltante:'#111'};
          if (!hasDanos) return '<div style="font-size:8px;color:#aaa;font-style:italic">Sin daños registrados</div>';
          return ['frontal','trasera','lateral_izq','lateral_der']
            .filter(z=>(danos[z]||[]).length>0)
            .map(z=>'<div style="font-size:8px;margin-bottom:4px;line-height:1.5"><b style="color:#374151">'+{frontal:'Frontal',trasera:'Trasera',lateral_izq:'Lat. Izq.',lateral_der:'Lat. Der.'}[z]+':</b> '+
              (danos[z]||[]).map(t=>'<span style="display:inline-flex;align-items:center;gap:2px;margin-right:5px"><span style="width:7px;height:7px;border-radius:50%;background:'+(tipoColores[t]||'#999')+';display:inline-block"></span>'+(tipoLabels[t]||t)+'</span>').join('')+'</div>'
            ).join('');
        })()}
      </div>
    </div>
  </div>

</div>

<!-- 4. TRABAJOS (tabla) + TOTALES (derecha) -->
${esAseg ? `
<div style="border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;margin-bottom:6px">
  <div class="sh">4. Total</div>
  <div style="padding:16px;display:flex;flex-direction:column;align-items:center;gap:4px">
    ${(() => {
      const base = orden.precio_venta_cliente || 0;
      if (!base) return '<div style="font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:1px">Total a pagar</div><div style="font-size:26px;font-weight:900;color:#111;font-family:\'Courier New\',monospace">$ ____________</div>';
      const iva = Math.round(base * 0.19);
      const fmtP = n => '$ ' + new Intl.NumberFormat('es-CO',{minimumFractionDigits:0}).format(n);
      return `<div style="width:100%;max-width:240px;font-size:9px;color:#374151">
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span>Subtotal</span><span class="money">${fmtP(base)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0"><span>IVA (19%)</span><span class="money">${fmtP(iva)}</span></div>
      </div>
      <div style="font-size:9px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;margin-top:6px">Total a pagar</div>
      <div style="font-size:24px;font-weight:900;color:#111;font-family:'Courier New',monospace">${fmtP(base + iva)}</div>`;
    })()}
  </div>
</div>` : `
<div style="display:grid;grid-template-columns:1fr 175px;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;margin-bottom:6px">
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">4. Descripción de trabajos</div>
    <table>
      <thead><tr>
        <th style="width:18px;text-align:center">#</th>
        <th>Descripción del trabajo</th>
        <th style="width:75px">Tipo (Mecánica, Elec., etc.)</th>
        <th style="width:85px">Técnico asignado</th>
        <th style="width:50px;text-align:center">Horas est.</th>
        <th style="width:72px;text-align:right">Valor unitario</th>
        <th style="width:72px;text-align:right">Valor total</th>
      </tr></thead>
      <tbody>
        ${etapas.map((e,i) => `<tr>
          <td style="color:#aaa;text-align:center;font-size:8px">${i+1}</td>
          <td style="font-weight:600">${escapeHtml(e.etapa||e.nombre||'—')}${e.descripcion ? `<div style="font-weight:400;font-size:8px;color:#555;margin-top:1px;line-height:1.3">${escapeHtml(e.descripcion)}</div>` : ''}</td>
          <td style="font-size:8px;color:${srvColor[e.servicio]||'#374151'};font-weight:700">${srvNombres[e.servicio]||e.servicio||'—'}</td>
          <td>${escapeHtml(e.tecnico||'—')}</td>
          <td style="text-align:center;font-family:monospace;font-size:8px">${e.horas_facturadas||'—'}</td>
          <td style="text-align:right;font-family:monospace">${fmt(e.valor_venta)}</td>
          <td style="text-align:right;font-family:monospace;font-weight:700">${fmt(e.valor_venta)}</td>
        </tr>`).join('')}
        ${Array.from({length:Math.max(0,3-etapas.length)},(_,i)=>`<tr><td style="color:#ddd;text-align:center;font-size:8px">${etapas.length+i+1}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>
  </div>
  <!-- TOTALES -->
  <div>
    <div class="sh">Totales</div>
    <div style="padding:6px 8px">
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>Subtotal trabajos</span><span class="money">${conPrecios ? fmt(totalVenta) : '$'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>Subtotal repuestos</span><span class="money">${conPrecios && totalRepuestos > 0 ? fmt(totalRepuestos) : '$'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:0.5px solid #ddd;font-size:8.5px">
        <span>IVA (19%)</span><span class="money">${conPrecios ? ('$ '+new Intl.NumberFormat('es-CO',{minimumFractionDigits:0}).format(Math.round((totalVenta+totalRepuestos)*0.19))) : '$'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 5px;font-size:10px;font-weight:800;background:#111;color:#fff;margin-top:5px">
        <span>TOTAL A PAGAR</span>
        <span class="money">${conPrecios ? (() => { const s=totalVenta+totalRepuestos; return '$ '+new Intl.NumberFormat('es-CO',{minimumFractionDigits:0}).format(s+Math.round(s*.19)); })() : '$'}</span>
      </div>
      ${!conPrecios ? `<div style="margin-top:6px;padding:4px 5px;border:0.8px solid #111;font-size:8.5px;font-weight:700;display:flex;justify-content:space-between"><span>Subtotal trabajos</span><span class="money">${fmt(totalVenta)}</span></div>` : ''}
    </div>
  </div>
</div>`}

<!-- 5. REPUESTOS + FIRMAS -->
<div style="display:grid;grid-template-columns:1fr 175px;gap:0;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden">
  <div style="border-right:1px solid #E5E7EB">
    <div class="sh">5. Repuestos / Materiales</div>
    ${esAseg ? `<div style="padding:18px 14px;font-size:9px;color:#6B7280;text-align:center;line-height:1.6">Trabajos y repuestos incluidos en el <b>Total a pagar</b>.</div>` : `<table>
      <thead><tr>
        <th style="width:18px;text-align:center">#</th>
        <th style="width:55px">Código</th>
        <th>Descripción</th>
        <th style="width:35px;text-align:center">Cant.</th>
        <th style="width:75px;text-align:right">Vr. Unitario</th>
        <th style="width:75px;text-align:right">Vr. Total</th>
      </tr></thead>
      <tbody>
        ${solicitudes.length ? solicitudes.map((sol,si) => {
          const cot = cotizaciones.find(c=>c.solicitud_id===sol.id);
          const items = solItems.filter(i=>i.solicitud_id===sol.id);
          const filas = items.length ? items : [{repuesto:sol.repuesto,unidades:sol.unidades||1}];
          return filas.map((item,idx) => `<tr>
            <td style="color:#aaa;text-align:center;font-size:8px">${si+1}</td>
            <td style="font-family:monospace;font-size:8px;color:#777">${escapeHtml(cot?.codigo||'—')}</td>
            <td style="font-weight:600">${escapeHtml(item.repuesto||'—')}</td>
            <td style="text-align:center">${item.unidades||1}</td>
            <td style="text-align:right;font-family:monospace">${conPrecios&&idx===0&&cot?.precio_venta_jefe ? fmt(cot.precio_venta_jefe/(item.unidades||1)) : ''}</td>
            <td style="text-align:right;font-family:monospace;font-weight:700">${conPrecios&&idx===0&&cot?.precio_venta_jefe ? fmt(cot.precio_venta_jefe) : ''}</td>
          </tr>`).join('');
        }).join('') : ''}
        ${Array.from({length:Math.max(0,2-solicitudes.length)},(_,i)=>`<tr><td style="color:#ddd;text-align:center;font-size:8px">${solicitudes.length+i+1}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
      </tbody>
    </table>`}
    ${novedades.length ? `<div style="border-top:0.8px solid #ccc;padding:3px 7px;background:#FFF5F5"><b style="font-size:7px;text-transform:uppercase;color:#991B1B">Novedades:</b> ${novedades.map(n=>'<span style="font-size:8px;margin-left:6px">'+escapeHtml(n.tipo||'—')+': '+escapeHtml(n.motivo||'—')+'</span>').join('')}</div>` : ''}
  </div>
  <!-- 6. FIRMAS -->
  <div>
    <div class="sh">6. Firmas</div>
    <div style="padding:8px 10px">
      <div style="margin-top:14px;border-top:1.2px solid #111;padding-top:4px;margin-bottom:14px">
        <div style="font-size:8px;font-weight:600;text-align:center">Firma recepcionista</div>
        <div style="font-size:7.5px;color:#888;margin-top:4px">C.C. ______________________</div>
      </div>
      <div style="margin-top:14px;border-top:1.2px solid #111;padding-top:4px">
        <div style="font-size:8px;font-weight:600;text-align:center">Firma cliente</div>
        <div style="font-size:7.5px;color:#888;margin-top:4px">C.C. ______________________</div>
      </div>
      <div style="margin-top:8px;font-size:6.5px;color:#aaa;text-align:center;line-height:1.4">Documento preliminar · no constituye factura<br>${new Date().toLocaleString('es-CO')}</div>
    </div>
  </div>
</div>

</div>
<script>
// Esperar a que todas las imágenes carguen antes de imprimir
window.addEventListener('load', function() {
  var imgs = document.images;
  var loaded = 0;
  if (imgs.length === 0) { setTimeout(function(){ window.print(); }, 300); return; }
  for (var i = 0; i < imgs.length; i++) {
    if (imgs[i].complete) { loaded++; }
    else { imgs[i].addEventListener('load', function(){ loaded++; if(loaded>=imgs.length) setTimeout(function(){ window.print(); },300); }); }
  }
  if (loaded >= imgs.length) setTimeout(function(){ window.print(); }, 300);
});
</script>
</body>
</html>`;

    // Usar Blob URL para que la ventana tenga origen real y pueda cargar imágenes
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) {
      setTimeout(() => { URL.revokeObjectURL(blobUrl); }, 120000);
      // El print lo dispara el propio onload de la ventana (ver script en el HTML)
      toast('Preliquidación generada ✓');
    } else {
      URL.revokeObjectURL(blobUrl);
      toast('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.', 'err');
    }
  } catch(e) {
    toast('Error generando preliquidación: ' + e.message, 'err');
    console.error(e);
  }
}

// ═══════════════════════════════════════════════════════════
// AUTO-REFRESH — Polling para órdenes, capacidad y dashboard
// ═══════════════════════════════════════════════════════════

let _realtimeIntervals = [];
let _realtimeVisibilityHandler = null;
let _ultimoRefresh = 0;

// Devuelve el id de la página activa en el .content
function _paginaActiva() {
  const el = document.querySelector('.pagina.activa');
  return el ? el.id : null;
}

// ¿Hay algún modal abierto? Evitamos refrescar mientras el usuario edita
function _hayModalAbierto() {
  return !![...document.querySelectorAll('.modal-overlay')]
    .some(m => m.style.display !== 'none' && !m.classList.contains('hide') && m.offsetParent !== null);
}

function _tickRefresh() {
  if (!sesion) return;                 // no hay sesión activa
  if (document.hidden) return;        // pestaña oculta
  if (_hayModalAbierto()) return;     // usuario en un modal
  // No refrescar si el usuario está escribiendo/editando en algún input
  const focused = document.activeElement;
  if (focused && ['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)) return;

  const pag = _paginaActiva();

  // Siempre actualizar la barra de capacidad del sidebar
  _refrescarCapacidad();

  // Actualizar lista de órdenes si está visible
  if (pag === 'pag-ordenes') {
    cargarOrdenes();
    return;
  }

  // Actualizar dashboard si está visible
  if (pag === 'pag-dashboard' && typeof switchDashTab === 'function') {
    const tabActivo = document.querySelector('.filtro-btn.active[id^="dash-tab-"]');
    const tab = tabActivo ? tabActivo.id.replace('dash-tab-', '') : 'mes';
    switchDashTab(tab);
    return;
  }
}

function iniciarRealtime() {
  detenerRealtime(); // Limpiar cualquier instancia previa

  // ── Polling cada 30 segundos ────────────────────────────
  const intervalo = setInterval(_tickRefresh, 30_000);
  _realtimeIntervals.push(intervalo);

  // ── Refresh inmediato al volver a la pestaña ────────────
  _realtimeVisibilityHandler = () => {
    if (!document.hidden && sesion) {
      const ahora = Date.now();
      // Evitar doble-refresh si ya se refrescó hace menos de 5 s
      if (ahora - _ultimoRefresh > 5_000) {
        _ultimoRefresh = ahora;
        _tickRefresh();
      }
    }
  };
  document.addEventListener('visibilitychange', _realtimeVisibilityHandler);

  // ── Refresh al recuperar conexión ───────────────────────
  window.addEventListener('online', _tickRefresh);

  console.debug('[Realtime] Polling activo — cada 30 s');
}

function detenerRealtime() {
  _realtimeIntervals.forEach(id => clearInterval(id));
  _realtimeIntervals = [];
  if (_realtimeVisibilityHandler) {
    document.removeEventListener('visibilitychange', _realtimeVisibilityHandler);
    _realtimeVisibilityHandler = null;
  }
  window.removeEventListener('online', _tickRefresh);
}

// ═══════════════════════════════════════════════════════════
// SISTEMA DE ALERTAS — ETAPAS SIN MOVIMIENTO
// ═══════════════════════════════════════════════════════════

const _alertasYaMostradas = new Set();   // ids de etapas cuyo popup ya se mostró
const _alertasRevisadas   = new Set();   // ids marcados "revisado" por el usuario
let   _alertasInterval    = null;

function iniciarSistemaAlertas() {
  if (!esJefe()) return;
  if (_alertasInterval) return; // ya está corriendo
  _chequearAlertas();
  _alertasInterval = setInterval(_chequearAlertas, 5 * 60 * 1000); // cada 5 min
  // Las citas de recogida se revisan más seguido para que el aviso sea
  // persistente (reaparece si el jefe lo cierra y el cliente no ha llegado).
  setInterval(_chequearCitas, 2 * 60 * 1000); // cada 2 min
}

async function _chequearAlertas() {
  _chequearCitas(); // avisar al jefe de las citas de recogida que ya llegaron
  try {
    // Traer etapas activas (iniciadas, no terminadas, no pausadas)
    const etapas = await api(
      '/etapas?select=id,orden_id,etapa,servicio,tecnico,inicio,tiempo_pausado_min' +
      '&inicio=not.is.null&fin=is.null&pausado=eq.false'
    ).catch(() => []) || [];

    if (!etapas.length) {
      _actualizarListaCritica([]);
      return;
    }

    // Necesitamos placa de la orden — traer ordenes referenciadas
    const ordenIds = [...new Set(etapas.map(e => e.orden_id))];
    const ordenes  = await api(
      '/ordenes?select=id,placa,marca,linea&id=in.(' + ordenIds.join(',') + ')'
    ).catch(() => []) || [];
    const ordenMap = {};
    ordenes.forEach(o => { ordenMap[o.id] = o; });

    const ahora = Date.now();
    const amarillas = [];
    const naranjas  = [];
    const criticas  = [];

    etapas.forEach(e => {
      const inicioMs       = new Date(e.inicio).getTime();
      const pausadoMs      = (e.tiempo_pausado_min || 0) * 60 * 1000;
      const tiempoNetoMs   = (ahora - inicioMs) - pausadoMs;
      const minutos        = Math.floor(tiempoNetoMs / 60000);
      const orden          = ordenMap[e.orden_id] || {};

      // Lista crítica persistente a partir de 5h
      if (minutos >= 300) criticas.push({ etapa: e, orden, minutos });
      // Aviso desde los 20 min: amarillo hasta 1h, naranja de 1h en adelante
      if (minutos >= 20) {
        (minutos >= 60 ? naranjas : amarillas).push({ etapa: e, orden, minutos });
      }
    });

    // Popup recurrente: cada 20 min la primera hora (20, 40, 60) y luego cada
    // hora (120, 180, 240, ...), si no fue revisada.
    const _alertaTramo = m => m < 60 ? 'm' + Math.floor(m / 20) : 'h' + Math.floor(m / 60);
    [...amarillas, ...naranjas].forEach(({ etapa, orden, minutos }) => {
      const key = etapa.id + ':' + _alertaTramo(minutos);
      if (_alertasYaMostradas.has(key)) return;
      if (_alertasRevisadas.has(etapa.id)) return;
      _alertasYaMostradas.add(key);
      const color = minutos >= 60 ? 'naranja' : 'amarillo';
      _mostrarPopupAlerta(etapa, orden, minutos, color);
    });

    _actualizarListaCritica(criticas);
  } catch (err) {
    console.warn('[Alertas] Error al chequear:', err);
  }
}

function _fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function _mostrarPopupAlerta(etapa, orden, minutos, nivel) {
  // DESACTIVADO por pedido: ya no se muestran las notificaciones flotantes de
  // "Etapa sin movimiento". (El aviso de citas de recogida sigue activo aparte.)
  return;
  // Límite de popups simultáneos: máx 3
  const existentes = document.querySelectorAll('.alerta-popup-etapa');
  if (existentes.length >= 3) return;

  // Colores de la paleta general (sin naranja): ámbar = aviso (<1h),
  // rojo = urgente (>1h).
  // Colores FIJOS (hex) — no usar var(--..) en estilos en línea: en algunos
  // navegadores de PC no resolvían y el aviso salía descolorido (en Android sí).
  const colores = {
    amarillo: { bg: '#FEF3C7', border: '#92400E', icon: '#92400E', texto: '#78350F' },
    naranja:  { bg: '#FDEDEB', border: '#C0392B', icon: '#C0392B', texto: '#7F1D1D' }
  };
  const c      = colores[nivel] || colores.amarillo;
  const AUTO_CIERRE_MS = 30000;
  const placa  = orden.placa || '—';
  const etNom  = etapa.etapa || etapa.servicio || 'Etapa';
  const tec    = etapa.tecnico || 'Sin técnico';

  const div = document.createElement('div');
  div.className = 'alerta-popup-etapa';
  div.dataset.etapaId = etapa.id;
  div.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:10000;
    background:${c.bg};border:1.5px solid ${c.border};border-radius:12px;
    padding:12px 14px 14px;min-width:240px;max-width:300px;overflow:hidden;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
    font-family:'DM Sans',sans-serif;font-size:13px;color:${c.texto};
    opacity:0;transform:translateX(24px);will-change:opacity,transform;
    transition:opacity .3s var(--ease-out,ease), transform .3s var(--ease-out,ease), top .25s var(--ease-out,ease);
  `;

  // Desplazar hacia abajo si ya hay otros popups
  const prevPopups = document.querySelectorAll('.alerta-popup-etapa');
  let topOffset = 16;
  prevPopups.forEach(p => { topOffset += p.offsetHeight + 8; });
  div.style.top = topOffset + 'px';

  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px">
        <svg width="15" height="15" fill="none" stroke="${c.icon}" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Etapa sin movimiento ${_fmtMin(minutos)}
      </div>
      <button onclick="_cerrarPopupAlerta(this.closest('.alerta-popup-etapa'))" style="background:none;border:none;cursor:pointer;color:${c.texto};opacity:.6;font-size:16px;line-height:1;padding:0;flex-shrink:0">×</button>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.85">
      <strong>${placa}</strong> · ${etNom} · ${tec}
    </div>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button onclick="_alertaVerOrden(${etapa.orden_id})" style="flex:1;background:${c.border};color:white;border:none;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Ver orden</button>
      <button onclick="_alertaMarcarRevisado(${etapa.id},this)" style="flex:1;background:none;border:1.5px solid ${c.border};color:${c.texto};border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Marcar revisado</button>
    </div>
    <div class="alerta-bar" style="position:absolute;left:0;bottom:0;height:3px;width:100%;transform:scaleX(0);transform-origin:left center;background:${c.border};opacity:.7;will-change:transform"></div>
  `;

  document.body.appendChild(div);

  // Aparecer animado (fade + slide): se dispara en el siguiente frame para
  // que la transición arranque desde el estado inicial (opacity:0).
  requestAnimationFrame(() => {
    div.style.opacity = '1';
    div.style.transform = 'translateX(0)';
  });

  // Barra de progreso fluida: anima transform:scaleX (acelerado por GPU) en
  // vez de width, así no se ve "trabada". Al llenarse, el aviso se cierra.
  const bar = div.querySelector('.alerta-bar');
  if (bar) {
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(0)';
    void bar.offsetWidth; // reflow para reiniciar la animación
    bar.style.transition = `transform ${AUTO_CIERRE_MS}ms linear`;
    bar.style.transform = 'scaleX(1)';
  }

  // Auto-cerrar (animado) al completarse la barra
  setTimeout(() => _cerrarPopupAlerta(div), AUTO_CIERRE_MS);
}

// Cierra un popup de alerta con animación de salida (fade + slide) antes de
// quitarlo del DOM.
function _cerrarPopupAlerta(el) {
  if (!el || el._cerrando) return;
  el._cerrando = true;
  el.style.opacity = '0';
  el.style.transform = 'translateX(24px)';
  setTimeout(() => { if (el.parentNode) el.remove(); }, 300);
}

function _alertaVerOrden(ordenId) {
  // Cerrar popups (animado) y abrir el detalle de la orden
  document.querySelectorAll('.alerta-popup-etapa').forEach(p => _cerrarPopupAlerta(p));
  if (ordenId && typeof abrirOrden === 'function') abrirOrden(ordenId);
}

// ── Citas de recogida: avisar al jefe cuando llega la hora del cliente ──
async function _chequearCitas() {
  if (!esJefe()) return;
  try {
    const nowIso = new Date().toISOString();
    const ords = await api(
      `/ordenes?cita_entrega=not.is.null&cita_entrega=lte.${nowIso}&estado=neq.Entregada` +
      `&estado=neq.Archivada&select=id,placa,marca,linea,telefono,cita_entrega`
    ).catch(() => []) || [];
    const vivos = new Set(ords.map(o => o.id));
    // Cerrar avisos de citas ya atendidas (entregadas o reagendadas a futuro).
    document.querySelectorAll('.cita-popup').forEach(p => {
      if (!vivos.has(parseInt(p.dataset.citaId))) p.remove();
    });
    // Aviso PERSISTENTE: mantener un popup por cada cita vencida sin entregar.
    // Si el jefe lo cierra, vuelve a aparecer en el siguiente chequeo hasta que
    // la orden se marque Entregada (o se reprograme la cita).
    ords.forEach(o => {
      if (document.querySelector(`.cita-popup[data-cita-id="${o.id}"]`)) return;
      _mostrarPopupCita(o);
    });
  } catch (e) { console.warn('[Citas] Error:', e); }
}

function _mostrarPopupCita(o) {
  const tel = o.telefono ? _waNumero(o.telefono) : '';
  const veh = [o.marca, o.linea].filter(Boolean).join(' ') || '';
  const ci  = (typeof _citaInfo === 'function') ? _citaInfo(o.cita_entrega) : null;
  const div = document.createElement('div');
  div.className = 'alerta-popup-etapa cita-popup'; // reutiliza apilado/estilos base
  div.dataset.citaId = o.id;
  div.style.cssText = `
    position:fixed;top:16px;right:16px;z-index:10000;
    background:#ECFDF5;border:1.5px solid #10B981;border-radius:12px;
    padding:12px 14px;min-width:240px;max-width:300px;
    box-shadow:0 4px 20px rgba(0,0,0,.15);
    font-family:'DM Sans',sans-serif;font-size:13px;color:#065F46;
    animation:slideInRight .25s ease-out;transition:top .2s;`;
  let topOffset = 16;
  document.querySelectorAll('.alerta-popup-etapa').forEach(p => { topOffset += p.offsetHeight + 8; });
  div.style.top = topOffset + 'px';
  div.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px">🚗 Cliente por llegar</div>
      <button onclick="this.closest('.alerta-popup-etapa').remove()" style="background:none;border:none;cursor:pointer;color:#065F46;opacity:.6;font-size:16px;line-height:1;padding:0;flex-shrink:0">×</button>
    </div>
    <div style="margin-top:6px;font-size:12px;opacity:.9"><strong>${o.placa || '—'}</strong>${veh ? ' · ' + veh : ''}<br>Cita de recogida: <strong>${formatTS(o.cita_entrega)}</strong>${ci ? `<br><span style="font-weight:700">${ci.texto}</span>` : ''}</div>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button onclick="_alertaVerOrden(${o.id})" style="flex:1;background:#10B981;color:white;border:none;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Ver orden</button>
      ${tel ? `<a href="tel:+${tel}" style="flex:1;background:none;border:1.5px solid #10B981;color:#065F46;border-radius:7px;padding:5px 0;font-size:11px;font-weight:600;text-align:center;text-decoration:none;font-family:'DM Sans',sans-serif">📞 Llamar</a>` : ''}
    </div>`;
  document.body.appendChild(div);
}

function _alertaMarcarRevisado(etapaId, btn) {
  _alertasRevisadas.add(etapaId);
  _cerrarPopupAlerta(btn.closest('.alerta-popup-etapa'));
}

function _actualizarListaCritica(criticas) {
  const cont = document.getElementById('alertas-criticas-container');
  if (!cont) return;

  // DESACTIVADO por pedido: ya no se muestra el panel "Alertas críticas · +5h sin
  // movimiento" arriba de Gestión Operativa. Se mantiene oculto y vacío.
  cont.style.display = 'none';
  cont.innerHTML = '';
  return;

  if (!criticas.length) {
    cont.style.display = 'none';
    return;
  }

  cont.style.display = 'block';
  cont.innerHTML = `
    <div style="display:inline-block;max-width:100%;background:#FEF2F2;border:1px solid #FCA5A5;border-radius:10px;padding:8px 11px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:5px;font-weight:700;font-size:11px;color:#991B1B;margin-bottom:7px;text-transform:uppercase;letter-spacing:.4px">
        <svg width="13" height="13" fill="none" stroke="#DC2626" stroke-width="2.5" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Alertas críticas · +5h sin movimiento (${criticas.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${criticas.map(({ etapa, orden, minutos }) => `
          <div class="hover-lift" onclick="_alertaVerOrden(${etapa.orden_id})" title="${escapeHtml((etapa.etapa||etapa.servicio||'Etapa')+' · '+(etapa.tecnico||'Sin técnico'))}" style="display:inline-flex;align-items:center;gap:6px;background:white;border-radius:7px;padding:5px 9px;cursor:pointer;border:1px solid #FECACA">
            <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:11px;color:#7F1D1D">${orden.placa || '—'}</span>
            <span style="font-size:10px;color:#991B1B;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${etapa.etapa || etapa.servicio || 'Etapa'}</span>
            <span style="font-size:10px;font-weight:700;color:#DC2626">${_fmtMin(minutos)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════
// PANEL CAPACIDAD DEL TALLER — DETALLE CLICKEABLE
// ═══════════════════════════════════════════════════════════

function cerrarPanelCapacidad() {
  document.getElementById('panel-capacidad-overlay')?.remove();
}

// Mostrar el listado de una categoría al hacer click en su torta
function _capVer(key) {
  const d = window._capLists?.[key];
  if (!d) return;
  Object.keys(window._capLists || {}).forEach(k => {
    const el = document.getElementById('cap-donut-' + k);
    if (el) el.classList.toggle('cap-donut-sel', k === key);
  });
  const det = document.getElementById('cap-detalle');
  if (det) det.innerHTML = `
    <div class="cap-detalle-head" style="color:${d.color}">
      <span class="cap-dot" style="background:${d.color}"></span>${d.label}
      <span class="cap-detalle-count">${d.count} vehículo${d.count === 1 ? '' : 's'}</span>
    </div>
    <div class="cap-detalle-list">${d.html || '<div class="cap-vacio">No hay vehículos en esta categoría ✓</div>'}</div>`;
}

async function abrirPanelCapacidad() {
  document.getElementById('panel-capacidad-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'panel-capacidad-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:800;
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;
  overlay.addEventListener('click', e => { if (e.target === overlay) cerrarPanelCapacidad(); });
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:780px;max-height:90vh;
      display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden">
      <div style="background:#1E3A5F;color:white;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div>
          <div style="font-size:15px;font-weight:700;letter-spacing:.5px">TALLER · Capacidad y Estado en Tiempo Real</div>
          <div id="cap-panel-progress-text" style="font-size:12px;color:rgba(255,255,255,.65);margin-top:2px">Cargando...</div>
        </div>
        <button onclick="cerrarPanelCapacidad()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:6px 12px;color:white;cursor:pointer;font-size:13px;font-weight:600">✕ Cerrar</button>
      </div>
      <div style="padding:4px 20px 8px;background:#1E3A5F;flex-shrink:0">
        <div style="background:rgba(255,255,255,.15);border-radius:99px;height:8px;overflow:hidden">
          <div id="cap-panel-bar" style="height:100%;background:#EAB308;border-radius:99px;transition:width .5s;width:0%"></div>
        </div>
      </div>
      <div id="cap-panel-body" style="overflow-y:auto;padding:16px 20px;flex:1">
        <div class="loading-state">Cargando datos del taller...</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  try {
    const TOTAL_CUPOS = 36;
    const [ordenesActivas, etapasActivas, ordenesPulmon, programadas] = await Promise.all([
      api('/ordenes?estado=eq.Activa&select=id,placa,marca,linea,propietario,kilometraje,creado_en,pulmon&order=creado_en.desc').catch(() => []),
      api('/etapas?fin=is.null&inicio=not.is.null&select=id,orden_id,etapa,tecnico,inicio,tiempo_pausado_min').catch(() => []),
      api('/ordenes?pulmon=eq.true&select=id,placa,marca,linea,propietario,pulmon_desde,pulmon_tipo&order=pulmon_desde.asc').catch(() => []),
      api('/ordenes?estado=eq.Programada&select=id,placa,marca,linea,propietario,fecha_programada&order=fecha_programada.asc').catch(() => [])
    ]);

    // IDs de órdenes con etapas activas
    const conEtapaActiva = new Set(etapasActivas.map(e => e.orden_id));

    // Clasificar
    const enOperacion = ordenesActivas.filter(o => !o.pulmon && conEtapaActiva.has(o.id));
    const quietos     = ordenesActivas.filter(o => !o.pulmon && !conEtapaActiva.has(o.id));
    const enPulmon    = ordenesPulmon;

    const ocupados = enOperacion.length + quietos.length + enPulmon.filter(p => p.pulmon_tipo !== 'externo').length;
    const pct      = Math.round((ocupados / TOTAL_CUPOS) * 100);

    // Update progress
    const barEl  = document.getElementById('cap-panel-bar');
    const txtEl  = document.getElementById('cap-panel-progress-text');
    if (barEl) { barEl.style.width = pct + '%'; barEl.style.background = pct > 85 ? '#EF4444' : pct > 65 ? '#EAB308' : '#22C55E'; }
    if (txtEl) txtEl.textContent = `${ocupados} de ${TOTAL_CUPOS} cupos ocupados (${pct}%)`;

    // Time helper
    function _tiempoDesde(inicio, pausadoMin) {
      if (!inicio) return '—';
      const minTot = Math.floor((Date.now() - new Date(inicio)) / 60000) - (pausadoMin || 0);
      const h = Math.floor(minTot / 60); const m = minTot % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function _verOrdenBtn(id) {
      return `<button onclick="cerrarPanelCapacidad();abrirOrden(${id})" class="cap-btn-ver">→ Ver</button>`;
    }
    function _asignarBtn(id) {
      return `<button onclick="cerrarPanelCapacidad();abrirOrden(${id});setTimeout(()=>abrirModalAgregar(),600)" class="cap-btn-asignar">Asignar</button>`;
    }
    function _capRow(placa, nombre, meta, tiempo, tColor, btns) {
      return `<div class="cap-row">
        <span class="cap-placa">${escapeHtml(placa||'—')}</span>
        <span class="cap-nombre">${escapeHtml(nombre||'—')}</span>
        <span class="cap-meta">${meta||''}</span>
        <span class="cap-tiempo" style="color:${tColor}">${tiempo||''}</span>
        <span class="cap-acc">${btns||''}</span>
      </div>`;
    }

    // Listas compactas por categoría
    const listaOp = enOperacion.map(o => {
      const etapa = etapasActivas.find(e => e.orden_id === o.id);
      const meta = `${escapeHtml(etapa?.etapa||etapa?.servicio||'—')} · ${escapeHtml(etapa?.tecnico||'Sin técnico')}`;
      return _capRow(o.placa, o.propietario, meta, _tiempoDesde(etapa?.inicio, etapa?.tiempo_pausado_min), '#059669', _verOrdenBtn(o.id));
    }).join('');

    const listaQ = quietos.map(o => {
      const diasQ = o.creado_en ? Math.floor((Date.now() - new Date(o.creado_en)) / 86400000) : 0;
      const meta = [o.marca,o.linea].filter(Boolean).map(escapeHtml).join(' ')||'—';
      return _capRow(o.placa, o.propietario, meta, diasQ+'d', '#D97706', _verOrdenBtn(o.id)+_asignarBtn(o.id));
    }).join('');

    const _pulFila = (col) => (o) => {
      const minsPulmon = o.pulmon_desde ? Math.floor((Date.now() - new Date(o.pulmon_desde)) / 60000) : 0;
      const hP = Math.floor(minsPulmon / 60); const mP = minsPulmon % 60;
      const tiempoPulmon = hP > 24 ? `${Math.floor(hP/24)}d` : hP > 0 ? `${hP}h ${mP}m` : `${mP}m`;
      return _capRow(o.placa, o.propietario, escapeHtml(o.pulmon_tipo||'—'), tiempoPulmon, col, _verOrdenBtn(o.id));
    };
    // Pulmón interno = físicamente en el taller (ocupa cupo). Externo = fuera.
    const enPulmonInt = enPulmon.filter(o => o.pulmon_tipo !== 'externo');
    const enPulmonExt = enPulmon.filter(o => o.pulmon_tipo === 'externo');
    const listaPint = enPulmonInt.map(_pulFila('#F97316')).join('');
    const listaPext = enPulmonExt.map(_pulFila('#0EA5E9')).join('');

    const listaPr = programadas.map(o => {
      const fechaProg = o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
      return _capRow(o.placa, o.propietario, 'Programado', fechaProg, '#7C3AED', _verOrdenBtn(o.id));
    }).join('');

    const cats = [
      { key:'op', label:'En operación', color:'#DC2626', count:enOperacion.length, sub:'con etapa',   html:listaOp },
      { key:'q',  label:'Quietos',      color:'#D97706', count:quietos.length,     sub:'sin etapa',   html:listaQ  },
      { key:'p',  label:'Pulmón (taller)', color:'#F97316', count:enPulmonInt.length, sub:'en el taller',     html:listaPint },
      { key:'pe', label:'Pulmón externo',  color:'#0EA5E9', count:enPulmonExt.length, sub:'fuera del taller', html:listaPext },
      { key:'pr', label:'Programados',  color:'#7C3AED', count:programadas.length, sub:'por ingresar',html:listaPr }
    ];
    const totalCat = cats.reduce((s,c)=>s+c.count,0) || 1;
    window._capLists = {};
    cats.forEach(c => { window._capLists[c.key] = { html:c.html, label:c.label, color:c.color, count:c.count }; });

    const donutsHtml = cats.map(c => {
      const pctArc = Math.round(c.count / totalCat * 100);
      return `<div class="cap-donut" id="cap-donut-${c.key}" onclick="_capVer('${c.key}')">
        <svg width="84" height="84" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#EEF0F3" stroke-width="3.4"/>
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="${c.color}" stroke-width="3.4"
            stroke-dasharray="${pctArc} 100" stroke-linecap="round" transform="rotate(-90 18 18)"/>
          <text x="18" y="19.6" text-anchor="middle" font-size="11" font-weight="800" fill="${c.color}" font-family="'DM Mono',monospace">${c.count}</text>
        </svg>
        <div class="cap-donut-lbl">${c.label}</div>
        <div class="cap-donut-sub">${c.sub}</div>
      </div>`;
    }).join('');

    const body = document.getElementById('cap-panel-body');
    if (body) {
      body.innerHTML = `
        <div class="cap-donuts">${donutsHtml}</div>
        <div id="cap-detalle" class="cap-detalle"></div>`;
      const def = cats.slice().sort((a,b)=>b.count-a.count)[0]?.key || 'op';
      _capVer(def);
    }
  } catch(e) {
    const body = document.getElementById('cap-panel-body');
    if (body) body.innerHTML = `<div class="empty-state">Error cargando datos: ${e.message}</div>`;
  }
}
