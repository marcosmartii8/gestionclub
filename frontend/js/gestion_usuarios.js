 let sortDirection = {}; // Track sort direction for each column

        function sortTable(columnIndex) {
            const table = document.getElementById('user-table');
            const rows = Array.from(table.rows).slice(1); // Exclude header row
            const isNumeric = !isNaN(rows[0].cells[columnIndex].innerText);

            // Toggle sort direction for the column
            sortDirection[columnIndex] = !sortDirection[columnIndex];

            rows.sort((a, b) => {
                const cellA = a.cells[columnIndex].innerText.toLowerCase();
                const cellB = b.cells[columnIndex].innerText.toLowerCase();

                if (isNumeric) {
                    return sortDirection[columnIndex] ? parseFloat(cellA) - parseFloat(cellB) : parseFloat(cellB) - parseFloat(cellA);
                }
                return sortDirection[columnIndex] ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });

            rows.forEach(row => table.tBodies[0].appendChild(row)); // Re-append sorted rows
        }

        function loadUsers() {
            const tableBody = document.getElementById('user-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const userData = JSON.parse(localStorage.getItem(key));

                // Ensure only user profiles are displayed, not monthly forms
                if (userData && userData.username && !key.startsWith('formData_')) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${userData.username || ''}</td>
                        <td>${userData.fullName || ''}</td>
                        <td>${userData.email || ''}</td>
                        <td>${userData.dni || ''}</td>
                        <td>${userData.address || ''}</td>
                        <td>${userData.phone || ''}</td>
                        <td>${userData.km || ''}</td>
                        <td>${userData.role || ''}</td>
                        <td>${userData.clubCode || ''}</td>
                        <td>
                            <button onclick="editUser('${key}')">Editar</button>
                            <button onclick="deleteUser('${key}')">Borrar</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            }
        }

        function editUser(key) {
            window.location.href = `editar_perfil.html?nombre=${encodeURIComponent(key)}&referrer=gestion_usuarios`;
        }

        function deleteUser(key) {
            const confirmation = confirm("¿Estás seguro de que quieres borrar este usuario?");
            if (confirmation) {
                localStorage.removeItem(key);
                alert("Usuario borrado.");
                loadUsers();
            }
        }

        function exportToExcel() {
            const table = document.getElementById('user-table');
            const rows = Array.from(table.rows);

            const data = rows.map(row => Array.from(row.cells).map(cell => cell.innerText));

            const worksheet = XLSX.utils.aoa_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');

            XLSX.writeFile(workbook, 'usuarios_gestion.xlsx');
        }

        function filterByClubCode() {
            const filterValue = document.getElementById('club-code-filter').value.toLowerCase();
            const tableBody = document.getElementById('user-table-body');
            const rows = tableBody.getElementsByTagName('tr');

            Array.from(rows).forEach(row => {
                const clubCodeCell = row.cells[8]; // Column index for "Código del Club"
                if (clubCodeCell) {
                    const clubCode = clubCodeCell.innerText.toLowerCase();
                    row.style.display = clubCode.includes(filterValue) ? '' : 'none';
                }
            });
        }

        // Load users on page load
        loadUsers();