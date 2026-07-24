let sortDirection = {}; // Para controlar la dirección de ordenación por columna
let allUsers = []; // Almacenar todos los usuarios cargados
let currentFilter = 'activos'; // Filtro actual

function applyMobileUserTableLabels() {
    const table = document.getElementById('user-table');
    if (!table) return;

    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim());
    if (headers.length === 0) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));
    rows.forEach((row) => {
        const cells = Array.from(row.children);

        if (cells.length === 1 && cells[0].colSpan > 1) {
            row.classList.add('mobile-full-row');
            cells[0].setAttribute('data-label', '');
            return;
        }

        row.classList.remove('mobile-full-row');
        cells.forEach((cell, index) => {
            cell.setAttribute('data-label', headers[index] || 'Dato');
        });
    });
}

function getAuthHeaders(extraHeaders = {}) {
    if (window.AuthUtils && typeof window.AuthUtils.getAuthHeaders === 'function') {
        return window.AuthUtils.getAuthHeaders({ extraHeaders });
    }

    return { ...extraHeaders };
}

function notify(message, type = 'info') {
    if (window.AuthUtils && typeof window.AuthUtils.notify === 'function') {
        window.AuthUtils.notify(message, { type });
        return;
    }
    if (window.AuthUtils && typeof window.AuthUtils.showToast === 'function') {
        window.AuthUtils.showToast(message, { type });
        return;
    }
    alert(message);
}

function confirmAction(message, options = {}) {
    if (window.AuthUtils && typeof window.AuthUtils.confirmDialog === 'function') {
        return window.AuthUtils.confirmDialog(message, options);
    }

    return Promise.resolve(window.confirm(message));
}

function sortTable(columnIndex) {
    const table = document.getElementById('user-table');
    const rows = Array.from(table.rows).slice(1); // Excluir encabezado
    const isNumeric = !isNaN(rows[0].cells[columnIndex].innerText);

    sortDirection[columnIndex] = !sortDirection[columnIndex];

    rows.sort((a, b) => {
        const cellA = a.cells[columnIndex].innerText.toLowerCase();
        const cellB = b.cells[columnIndex].innerText.toLowerCase();

        if (isNumeric) {
            return sortDirection[columnIndex] ? parseFloat(cellA) - parseFloat(cellB) : parseFloat(cellB) - parseFloat(cellA);
        }
        return sortDirection[columnIndex] ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    rows.forEach(row => table.tBodies[0].appendChild(row));
    applyMobileUserTableLabels();
}

async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = '';

    const currentClub = localStorage.getItem('clubCode') || '';
    const currentRole = localStorage.getItem('role') || '';
    
    console.log('👤 Cargando usuarios - Rol:', currentRole, 'Club:', currentClub);

    try {
        const res = await fetch('/api/users', {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Error al cargar usuarios');
        let users = await res.json();

        console.log('📊 Usuarios recibidos de Supabase:', users.length);

        // Filtrar por clubCode y excluir líderes
        users = users.filter(u => {
            const userClub = u.clubCode || '';
            const userRole = (u.role || '').toLowerCase().trim();
            const isNotLeader = userRole !== 'lider' && userRole !== 'líder';
            return userClub === currentClub && isNotLeader;
        });

        console.log('✅ Usuarios filtrados:', users.length);

        // Guardar todos los usuarios para filtrado
        allUsers = users;

        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">No hay usuarios registrados</td></tr>';
            applyMobileUserTableLabels();
            return;
        }

        // Aplicar filtro actual
        renderUsers(filterUsersByAccess(users, currentFilter));
    } catch (err) {
        console.error('❌ Error cargando usuarios:', err);
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: red;">Error al cargar usuarios</td></tr>';
        applyMobileUserTableLabels();
    }
}

function filterUsersByAccess(users, filter) {
    switch(filter) {
        case 'activos':
            return users.filter(u => u.active !== false && !u.leftAt);
        case 'exmiembros':
            return users.filter(u => u.leftAt);
        case 'denegados':
            return users.filter(u => u.active === false && !u.leftAt);
        case 'todos':
        default:
            return users;
    }
}

function filterUsers(filter) {
    currentFilter = filter;
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`btn-${filter}`).classList.add('active');
    
    // Aplicar filtro
    const filteredUsers = filterUsersByAccess(allUsers, filter);
    renderUsers(filteredUsers);
}

function renderUsers(users) {
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = '';
   
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">No hay usuarios con este filtro</td></tr>';
        return;
    }
    
    users.forEach(user => {
            const encoded = encodeURIComponent(user.username);
            const isActive = user.active !== false;
            const accessButtonText = isActive ? 'Denegar Acceso' : 'Permitir Acceso';
            const accessButtonClass = isActive ? 'deny-access-btn' : 'allow-access-btn';
            const isFormerMember = !!user.leftAt;
            const membershipBtn = isFormerMember
              ? `<button onclick="readmitUser('${encoded}')" style="background:#388e3c;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-right:5px;">↩ Readmitir</button>`
              : `<button onclick="leaveUser('${encoded}')" style="background:#f57c00;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-right:5px;">🚪 Dar de baja</button>`;
            const deleteBtn = isFormerMember
              ? `<button onclick="deleteUserPermanently('${encoded}')" style="background:#c62828;color:white;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;margin-right:5px;">🗑️ Eliminar</button>`
              : '';
            const row = document.createElement('tr');
            row.id = `user-row-${encoded}`;
            row.innerHTML = `
                <td><strong>${user.username || ''}</strong></td>
                <td>${user.fullName || ''}</td>
                <td>${user.email || ''}</td>
                <td>${user.dni || ''}</td>
                <td>${user.phone || ''}</td>
                <td>${user.address || ''}</td>
                <td>${user.km || ''}</td>
                <td>${user.clubCode || ''}</td>
                <td>${user.role || ''}</td>
                <td>
                    <button onclick="editUser('${encoded}')" style="background: #0288d1; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
                        ✏️ Editar
                    </button>
                    ${membershipBtn}
                    ${deleteBtn}
                    <button onclick="toggleUserAccess('${encoded}')" class="${accessButtonClass}" id="access-btn-${encoded}">
                        ${accessButtonText}
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    applyMobileUserTableLabels();
}

async function editUser(encodedKey) {
    const username = decodeURIComponent(encodedKey);
    
    try {
        // Obtener los datos actuales del usuario
        const res = await fetch('/api/users', {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Error al cargar usuario');
        const users = await res.json();
        
        const user = users.find(u => u.username === username);
        if (!user) {
            notify('Usuario no encontrado', 'error');
            return;
        }
        
        // Mostrar el modal con los datos actuales
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editPassword').value = '';
        document.getElementById('originalUsername').value = user.username;
        document.getElementById('editModal').style.display = 'block';
        
    } catch (err) {
        console.error('Error cargando usuario:', err);
        notify('Error al cargar los datos del usuario', 'error');
    }
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function saveUserChanges(event) {
    event.preventDefault();
    
    const originalUsername = document.getElementById('originalUsername').value;
    const newUsername = document.getElementById('editUsername').value.trim();
    const newPassword = document.getElementById('editPassword').value.trim();
    
    if (!newUsername) {
        notify('El nombre de usuario es obligatorio', 'error');
        return;
    }
    
    if (newPassword && newPassword.length < 8) {
        notify('La contraseña debe tener al menos 8 caracteres', 'error');
        return;
    }
    
    try {
        const payload = {
            username: newUsername
        };

        if (newPassword) {
            payload.password = newPassword;
        }

        const res = await fetch(`/api/users/${originalUsername}`, {
            method: 'PUT',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Error al actualizar usuario');
        }
        
        notify('Usuario actualizado correctamente', 'success');
        closeEditModal();
        await loadUsers(); // Recargar la tabla
        
    } catch (err) {
        console.error('Error actualizando usuario:', err);
        notify('Error al actualizar usuario: ' + err.message, 'error');
    }
}

async function toggleUserAccess(encodedKey) {
    const username = decodeURIComponent(encodedKey);
    
    try {
        const response = await fetch(`/api/users/${username}/toggle-access`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            
            // Actualizar el botón
            const button = document.getElementById(`access-btn-${encodedKey}`);
            if (button) {
                if (data.active) {
                    button.textContent = 'Denegar Acceso';
                    button.className = 'deny-access-btn';
                } else {
                    button.textContent = 'Permitir Acceso';
                    button.className = 'allow-access-btn';
                }
            }
            
            notify(data.message || 'Estado actualizado correctamente', 'success');
        } else {
            const error = await response.json();
            notify(error.message || 'Error al cambiar el estado de acceso del usuario', 'error');
        }
    } catch (error) {
        console.error('Error cambiando estado de acceso:', error);
        notify('Error al cambiar el estado de acceso del usuario', 'error');
    }
}

function redirectToPersonalizedInterface() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('nombre');

    if (username) {
        // Redirigir directamente con el parámetro que ya tenemos
        window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
    } else {
        notify('Error: Usuario no identificado.', 'error');
        window.location.href = 'inicio_app1.html';
    }
}

function exportToExcel() {
    try {
        const table = document.getElementById('user-table');
        const rows = Array.from(table.rows);
        
        // Preparar datos: excluir columna de acciones
        let datos = [];
        
        // Obtener headers (sin la columna de acciones)
        const headers = Array.from(rows[0].cells).slice(0, -1).map(cell => cell.innerText);
        
        // Obtener datos (sin la columna de acciones)
        rows.slice(1).forEach(row => {
            const rowData = {};
            Array.from(row.cells).slice(0, -1).forEach((cell, index) => {
                rowData[headers[index]] = cell.innerText;
            });
            datos.push(rowData);
        });
        
        if (datos.length === 0) {
            notify('No hay datos para exportar', 'info');
            return;
        }
        
        // Intentar usar XLSX si está disponible
        if (typeof XLSX !== 'undefined') {
            try {
                const ws = XLSX.utils.json_to_sheet(datos);
                
                // Aplicar estilos a los headers
                const headerStyle = {
                    fill: { fgColor: { rgb: "FF004D40" } },
                    font: { bold: true, color: { rgb: "FFFFFFFF" } },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "FF000000" } },
                        bottom: { style: "thin", color: { rgb: "FF000000" } },
                        left: { style: "thin", color: { rgb: "FF000000" } },
                        right: { style: "thin", color: { rgb: "FF000000" } }
                    }
                };
                
                // Aplicar estilos a datos
                const dataStyle = {
                    alignment: { horizontal: "left", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "FFD3D3D3" } },
                        bottom: { style: "thin", color: { rgb: "FFD3D3D3" } },
                        left: { style: "thin", color: { rgb: "FFD3D3D3" } },
                        right: { style: "thin", color: { rgb: "FFD3D3D3" } }
                    }
                };
                
                // Aplicar formato a headers
                headers.forEach((header, colIndex) => {
                    const cellAddress = XLSX.utils.encode_col(colIndex) + '1';
                    ws[cellAddress].s = headerStyle;
                });
                
                // Aplicar formato a datos
                datos.forEach((row, rowIndex) => {
                    headers.forEach((header, colIndex) => {
                        const cellAddress = XLSX.utils.encode_col(colIndex) + (rowIndex + 2);
                        if (ws[cellAddress]) {
                            ws[cellAddress].s = dataStyle;
                        }
                    });
                });
                
                // Ajustar ancho de columnas
                const wscols = headers.map(() => ({ wch: 15 }));
                ws['!cols'] = wscols;
                
                // Fijar la fila de headers
                ws['!freeze'] = { xSplit: 0, ySplit: 1 };
                
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');
                
                const hoy = new Date();
                const nombreArchivo = `Usuarios_${hoy.toISOString().slice(0,10)}.xlsx`;
                XLSX.writeFile(wb, nombreArchivo);
                return;
            } catch (error) {
                console.error('Error con XLSX:', error);
            }
        }
        
        // Si XLSX no funciona, generar CSV
        generarCSVUsuarios(datos);
    } catch (error) {
        console.error('Error al exportar:', error);
        notify('Error al exportar usuarios', 'error');
    }
}

function generarCSVUsuarios(datos) {
    const cabeceras = Object.keys(datos[0]);
    let csv = cabeceras.join(';') + '\n';
    
    datos.forEach(row => {
        const valores = cabeceras.map(cabecera => {
            let valor = row[cabecera] || '';
            valor = String(valor).replace(/"/g, '""');
            if (valor.includes(';') || valor.includes('\n') || valor.includes('"')) {
                valor = '"' + valor + '"';
            }
            return valor;
        });
        csv += valores.join(';') + '\n';
    });
    
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const hoy = new Date();
    const nombreArchivo = `Usuarios_${hoy.toISOString().slice(0,10)}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function deleteUserPermanently(encodedKey) {
    const username = decodeURIComponent(encodedKey);
    const accepted = await confirmAction(
        `Se eliminará definitivamente a ${username} y todos sus formularios. Esta acción no se puede deshacer.`,
        { title: 'Eliminar usuario', confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true }
    );
    if (!accepted) return;
    try {
        const res = await fetch(`/api/users/${username}/permanent`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message);
        notify('Usuario eliminado correctamente', 'success');
        await loadUsers();
    } catch (err) {
        notify('Error: ' + err.message, 'error');
    }
}

async function leaveUser(encodedKey) {
    const username = decodeURIComponent(encodedKey);
    const accepted = await confirmAction(
        `¿Dar de baja a ${username} del club? Sus datos se conservarán.`,
        { title: 'Dar de baja usuario', confirmText: 'Dar de baja', cancelText: 'Cancelar', danger: true }
    );
    if (!accepted) return;
    try {
        const res = await fetch(`/api/users/${username}/leave`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message);
        notify('Usuario dado de baja correctamente', 'success');
        await loadUsers();
    } catch (err) {
        notify('Error: ' + err.message, 'error');
    }
}

async function readmitUser(encodedKey) {
    const username = decodeURIComponent(encodedKey);
    const accepted = await confirmAction(
        `¿Readmitir a ${username} en el club?`,
        { title: 'Readmitir usuario', confirmText: 'Readmitir', cancelText: 'Cancelar' }
    );
    if (!accepted) return;
    try {
        const res = await fetch(`/api/users/${username}/readmit`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error((await res.json()).message);
        notify('Usuario readmitido correctamente', 'success');
        await loadUsers();
    } catch (err) {
        notify('Error: ' + err.message, 'error');
    }
}

// Cargar usuarios al iniciar
loadUsers();

// Cerrar modal al hacer clic fuera de él
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}

