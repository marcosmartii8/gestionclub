let sortDirection = {}; // Para controlar la dirección de ordenación por columna

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
}

async function loadUsers() {
    const tableBody = document.getElementById('user-table-body');
    tableBody.innerHTML = '';

    try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('API users error');
        const users = await res.json();
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.username || ''}</td>
                <td>${user.fullname || user.fullName || ''}</td>
                <td>${user.email || ''}</td>
                <td>${user.dni || ''}</td>
                <td>${user.address || ''}</td>
                <td>${user.km || ''}</td>
                <td>${user.password ? '••••' : ''}</td>
                <td>${user.clubcode || user.clubCode || ''}</td>
                <td>${user.role || ''}</td>
                <td>
                    <button onclick="editUser('${encodeURIComponent(user.username)}')">Editar</button>
                    <button onclick="deleteUser('${encodeURIComponent(user.username)}')">Borrar</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (err) {
        // Fallback localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            try {
                const userData = JSON.parse(localStorage.getItem(key));
                if (userData && userData.username) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${userData.username || ''}</td>
                        <td>${userData.fullName || ''}</td>
                        <td>${userData.email || ''}</td>
                        <td>${userData.dni || ''}</td>
                        <td>${userData.address || ''}</td>
                        <td>${userData.phone || ''}</td>
                        <td>${userData.password ? '••••' : ''}</td>
                        <td>${userData.clubCode || ''}</td>
                        <td>${userData.role || ''}</td>
                        <td>
                            <button onclick="editUser('${encodeURIComponent(key)}')">Editar</button>
                            <button onclick="deleteUser('${encodeURIComponent(key)}')">Borrar</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            } catch(e) { /* ignore non-json keys */ }
        }
    }
}

function editUser(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    window.location.href = `editar_perfil.html?nombre=${encodeURIComponent(key)}&referrer=gestion_usuarios`;
}

async function deleteUser(encodedKey) {
    const key = decodeURIComponent(encodedKey);
    if (!confirm('¿Seguro que quieres borrar este usuario?')) return;

    try {
        const res = await fetch(`/api/users/${encodeURIComponent(key)}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Usuario borrado.');
            loadUsers();
            return;
        }
        const data = await res.json();
        alert('Error borrando: ' + (data.error || res.statusText));
    } catch (err) {
        // Fallback localStorage
        localStorage.removeItem(key);
        alert('Usuario borrado (fallback).');
        loadUsers();
    }
}

function redirectToPersonalizedInterface() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('nombre');
    const userData = JSON.parse(localStorage.getItem(username));

    if (userData) {
        window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(userData.username)}`;
    } else {
        alert('Error: Usuario no identificado.');
        window.location.href = 'inicio_app1.html';
    }
}

function exportToExcel() {
    const table = document.getElementById('user-table');
    const rows = Array.from(table.rows);
    const data = rows.map(row => Array.from(row.cells).map(cell => cell.innerText));

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');
    XLSX.writeFile(workbook, 'usuarios.xlsx');
}

// Cargar usuarios al iniciar
loadUsers();
