const params = new URLSearchParams(window.location.search);
        const username = params.get('nombre');
        const currentUserData = JSON.parse(localStorage.getItem(username));

        if (!currentUserData || !currentUserData.clubCode) {
            alert('Error: Código del club no encontrado.');
            window.location.href = 'inicio_app1.html';
        }

        const currentClubCode = currentUserData.clubCode;
        let sortDirection = {}; // Track sort direction for each column

        function loadForms() {
            const tableBody = document.getElementById('forms-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('formData_')) {
                    const formData = JSON.parse(localStorage.getItem(key));
                    if (formData.clubCode === currentClubCode) {
                        const [_, formUser, year, month] = key.split('_');
                        const userData = JSON.parse(localStorage.getItem(formUser));
                        const fullName = userData?.fullName || formUser;

                        // --- Desplazamientos detalles con botón desplegable ---
                        const matchDetailsId = `match-details-${i}`;
                        const matchDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${matchDetailsId}')">Ver</button>
                            <div id="${matchDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${(formData.matches?.map(match => `Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}`).join('<br>') || '')}
                            </div>
                        `;

                        // --- Transporte detalles con botón desplegable (mostrar archivo si existe) ---
                        const transportDetailsId = `transport-details-${i}`;
                        const transportDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${transportDetailsId}')">Ver</button>
                            <div id="${transportDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${(formData.transportExpenses?.map(expense =>
                                    `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                    (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '') +
                                    (expense.ticket ? `<br><a href="${expense.ticket}" target="_blank">Ticket</a>` : '')
                                ).join('<br>') || '')}
                            </div>
                        `;

                        // --- Dietas detalles con botón desplegable (mostrar archivo si existe) ---
                        const dietDetailsId = `diet-details-${i}`;
                        const dietDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${dietDetailsId}')">Ver</button>
                            <div id="${dietDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${(formData.dietExpenses?.map(expense =>
                                    `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                    (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '') +
                                    (expense.ticket ? `<br><a href="${expense.ticket}" target="_blank">Ticket</a>` : '')
                                ).join('<br>') || '')}
                            </div>
                        `;

                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${fullName}</td>
                            <td>${year}</td>
                            <td>${new Date(0, month).toLocaleString('es-ES', { month: 'long' })}</td>
                            <td>${formData.trainingAttendance || ''}</td>
                            <td>${formData.matches?.length || 0}</td>
                            <td>
                                ${matchDetailsHtml}
                            </td>
                            <td>${formData.transportExpenses?.length || 0}</td>
                            <td>
                                ${transportDetailsHtml}
                            </td>
                            <td>${formData.dietExpenses?.length || 0}</td>
                            <td>
                                ${dietDetailsHtml}
                            </td>
                            <td>
                                <button onclick="editForm('${key}')">Editar</button>
                                <button onclick="deleteForm('${key}')">Borrar</button>
                            </td>
                        `;
                        tableBody.appendChild(row);
                    }
                }
            }
        }

        function applyFilters() {
            const filterYear = document.getElementById('filter-year').value;
            const filterMonth = document.getElementById('filter-month').value;
            const filterUsername = document.getElementById('filter-username').value.trim().toLowerCase();

            const tableBody = document.getElementById('forms-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('formData_')) {
                    const formData = JSON.parse(localStorage.getItem(key));
                    if (formData.clubCode === currentClubCode) {
                        const [_, formUser, year, month] = key.split('_');
                        const matchesFilters =
                            (filterYear === 'all' || filterYear === year) &&
                            (filterMonth === 'all' || parseInt(filterMonth) === parseInt(month)) &&
                            (filterUsername === 'all' || formUser.toLowerCase().includes(filterUsername));

                        if (matchesFilters) {
                            const matchDetailsId = `match-details-filter-${i}`;
                            const matchDetailsHtml = `
                                <button type="button" onclick="toggleDetails('${matchDetailsId}')">Ver</button>
                                <div id="${matchDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                    ${(formData.matches?.map(match => `Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}`).join('<br>') || '')}
                                </div>
                            `;
                            const transportDetailsId = `transport-details-filter-${i}`;
                            const transportDetailsHtml = `
                                <button type="button" onclick="toggleDetails('${transportDetailsId}')">Ver</button>
                                <div id="${transportDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                    ${(formData.transportExpenses?.map(expense =>
                                        `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                        (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '') +
                                        (expense.ticket ? `<br><a href="${expense.ticket}" target="_blank">Ticket</a>` : '')
                                    ).join('<br>') || '')}
                                </div>
                            `;
                            const dietDetailsId = `diet-details-filter-${i}`;
                            const dietDetailsHtml = `
                                <button type="button" onclick="toggleDetails('${dietDetailsId}')">Ver</button>
                                <div id="${dietDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                    ${(formData.dietExpenses?.map(expense =>
                                        `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                        (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '') +
                                        (expense.ticket ? `<br><a href="${expense.ticket}" target="_blank">Ticket</a>` : '')
                                    ).join('<br>') || '')}
                                </div>
                            `;
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td>${formUser}</td>
                                <td>${year}</td>
                                <td>${new Date(0, month).toLocaleString('es-ES', { month: 'long' })}</td>
                                <td>${formData.trainingAttendance || ''}</td>
                                <td>${formData.matches?.length || 0}</td>
                                <td>
                                    ${matchDetailsHtml}
                                </td>
                                <td>${formData.transportExpenses?.length || 0}</td>
                                <td>
                                    ${transportDetailsHtml}
                                </td>
                                <td>${formData.dietExpenses?.length || 0}</td>
                                <td>
                                    ${dietDetailsHtml}
                                </td>
                                <td>
                                    <button onclick="editForm('${key}')">Editar</button>
                                    <button onclick="deleteForm('${key}')">Borrar</button>
                                </td>
                            `;
                            tableBody.appendChild(row);
                        }
                    }
                }
            }
        }

        function sortTable(columnIndex) {
            const table = document.getElementById('forms-table');
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

        function goBack() {
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
        }

        function populateUserFilter() {
            const userSet = new Set();

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('formData_')) {
                    const [_, username] = key.split('_');
                    // Solo incluir usuarios con el mismo código de club
                    const userData = JSON.parse(localStorage.getItem(username));
                    if (userData && userData.clubCode === currentClubCode) {
                        userSet.add(username);
                    }
                }
            }

            const userFilter = document.getElementById('filter-username');
            userSet.forEach(username => {
                const option = document.createElement('option');
                option.value = username;
                option.textContent = username;
                userFilter.appendChild(option);
            });
        }

        function populateYearFilter() {
            const yearSet = new Set();

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('formData_')) {
                    const [_, __, year] = key.split('_');
                    yearSet.add(year);
                }
            }

            const yearFilter = document.getElementById('filter-year');
            Array.from(yearSet).sort().forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
        }

        function editForm(key) {
            const formData = JSON.parse(localStorage.getItem(key));
            if (formData) {
                // El mes y el año estarán preestablecidos y solo se podrá editar el resto de campos
                const modalHtml = `
                    <div id="edit-form-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2); z-index: 1000; color: black; max-height: 80vh; overflow-y: auto;">
                        <h2>Editar Formulario</h2>
                        <form id="edit-form">
                            <label style="color: black;">Año:</label>
                            <input type="number" id="edit-year" value="${formData.year}" readonly>
                            <label style="color: black;">Mes:</label>
                            <select id="edit-month" disabled>
                                <option value="${formData.month}" selected>${new Date(0, formData.month).toLocaleString('es-ES', { month: 'long' })}</option>
                            </select>
                            <label style="color: black;">Asistencia entrenamientos y partidos:</label>
                            <input type="number" id="edit-trainingAttendance" value="${formData.trainingAttendance}">
                            <h3>Desplazamientos fuera del club:</h3>
                            <div id="edit-awayMatches">
                                ${(formData.matches || []).map((match, index) => `
                                    <div id="away-match-${index}">
                                        <label>Fecha:</label>
                                        <input type="date" value="${match.date}">
                                        <label>Localidad:</label>
                                        <input type="text" value="${match.locality}">
                                        <label>Equipo:</label>
                                        <input type="text" value="${match.place}">
                                        <label>Kilómetros:</label>
                                        <input type="number" value="${match.km}">
                                        <button type="button" onclick="removeElement('away-match-${index}')">Eliminar</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" onclick="addAwayMatch()">Añadir Desplazamiento</button>
                            <h3>Gastos Transporte:</h3>
                            <div id="edit-transportExpenses">
                                ${(formData.transportExpenses || []).map((expense, index) => `
                                    <div id="transport-expense-${index}">
                                        <label>Fecha:</label>
                                        <input type="date" value="${expense.date}">
                                        <label>Concepto:</label>
                                        <input type="text" value="${expense.concept || ''}">
                                        <label>Importe:</label>
                                        <input type="number" value="${expense.amount}">
                                        <button type="button" onclick="removeElement('transport-expense-${index}')">Eliminar</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" onclick="addTransportExpense()">Añadir Gasto Transporte</button>
                            <h3>Gastos en Dietas:</h3>
                            <div id="edit-dietExpenses">
                                ${(formData.dietExpenses || []).map((expense, index) => `
                                    <div id="diet-expense-${index}">
                                        <label>Fecha:</label>
                                        <input type="date" value="${expense.date}">
                                        <label>Concepto:</label>
                                        <input type="text" value="${expense.concept || ''}">
                                        <label>Importe:</label>
                                        <input type="number" value="${expense.amount}">
                                        <button type="button" onclick="removeElement('diet-expense-${index}')">Eliminar</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" onclick="addDietExpense()">Añadir Gasto en Dietas</button>
                            <h3>Tickets:</h3>
                            <div>
                                <label>Subir ticket de transporte:</label>
                                <input type="file" id="edit-transportTicket" accept="image/*,application/pdf">
                                ${formData.transportTicket ? `<a href="${formData.transportTicket}" target="_blank">Ver ticket actual</a>` : ''}
                            </div>
                            <div>
                                <label>Subir ticket de dietas:</label>
                                <input type="file" id="edit-dietTicket" accept="image/*,application/pdf">
                                ${formData.dietTicket ? `<a href="${formData.dietTicket}" target="_blank">Ver ticket actual</a>` : ''}
                            </div>
                            <label>Marcar semanas que tiene el mes:</label>
                            <select id="edit-weeksInMonth">
                                ${[1, 2, 3, 4, 5].map(week => `<option value="${week}" ${week == formData.weeksInMonth ? 'selected' : ''}>${week} semana${week > 1 ? 's' : ''}</option>`).join('')}
                            </select>
                            <button type="button" onclick="saveEditedForm('${key}')">Guardar</button>
                            <button type="button" onclick="closeEditForm()">Cancelar</button>
                        </form>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
            }
        }

        function addAwayMatch() {
            const container = document.getElementById('edit-awayMatches');
            const index = container.children.length;
            const div = document.createElement('div');
            div.id = `away-match-${index}`;
            div.innerHTML = `
                <label>Fecha:</label>
                <input type="date">
                <label>Localidad:</label>
                <input type="text">
                <label>Equipo:</label>
                <input type="text">
                <label>Kilómetros:</label>
                <input type="number">
                <button type="button" onclick="removeElement('away-match-${index}')">Eliminar</button>
            `;
            container.appendChild(div);
        }

        function addTransportExpense() {
            const container = document.getElementById('edit-transportExpenses');
            const index = container.children.length;
            const div = document.createElement('div');
            div.id = `transport-expense-${index}`;
            div.innerHTML = `
                <label>Fecha:</label>
                <input type="date">
                <label>Concepto:</label>
                <input type="text">
                <label>Importe:</label>
                <input type="number">
                <button type="button" onclick="removeElement('transport-expense-${index}')">Eliminar</button>
            `;
            container.appendChild(div);
        }

        function addDietExpense() {
            const container = document.getElementById('edit-dietExpenses');
            const index = container.children.length;
            const div = document.createElement('div');
            div.id = `diet-expense-${index}`;
            div.innerHTML = `
                <label>Fecha:</label>
                <input type="date">
                <label>Concepto:</label>
                <input type="text">
                <label>Importe:</label>
                <input type="number">
                <button type="button" onclick="removeElement('diet-expense-${index}')">Eliminar</button>
            `;
            container.appendChild(div);
        }

        function saveEditedForm(key) {
            const updatedFormData = {
                year: document.getElementById('edit-year').value,
                month: document.getElementById('edit-month').value,
                trainingAttendance: document.getElementById('edit-trainingAttendance').value,
                matches: Array.from(document.querySelectorAll('#edit-awayMatches > div')).map(div => ({
                    date: div.children[1].value,
                    locality: div.children[3].value,
                    place: div.children[5].value,
                    km: div.children[7].value
                })),
                transportExpenses: Array.from(document.querySelectorAll('#edit-transportExpenses > div')).map(div => ({
                    date: div.children[1].value,
                    concept: div.children[3].value,
                    amount: div.children[5].value
                })),
                dietExpenses: Array.from(document.querySelectorAll('#edit-dietExpenses > div')).map(div => ({
                    date: div.children[1].value,
                    concept: div.children[3].value,
                    amount: div.children[5].value
                })),
                weeksInMonth: document.getElementById('edit-weeksInMonth').value,
                transportTicket: null,
                dietTicket: null,
                clubCode: currentClubCode // Ensure the club code is preserved
            };

            // Guardar archivos como base64 para persistencia entre páginas
            const transportTicketInput = document.getElementById('edit-transportTicket');
            const dietTicketInput = document.getElementById('edit-dietTicket');
            const oldFormData = JSON.parse(localStorage.getItem(key)) || {};
            function fileToBase64(file) {
                return new Promise((resolve, reject) => {
                    if (!file) return resolve(null);
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }
            Promise.all([
                transportTicketInput.files[0] ? fileToBase64(transportTicketInput.files[0]) : oldFormData.transportTicket || null,
                dietTicketInput.files[0] ? fileToBase64(dietTicketInput.files[0]) : oldFormData.dietTicket || null
            ]).then(([transportTicketBase64, dietTicketBase64]) => {
                updatedFormData.transportTicket = transportTicketBase64;
                updatedFormData.dietTicket = dietTicketBase64;
                localStorage.setItem(key, JSON.stringify(updatedFormData));
                alert('Formulario actualizado exitosamente.');
                loadForms();
                closeEditForm();
            });
        }

        function closeEditForm() {
            const modal = document.getElementById('edit-form-modal');
            if (modal) {
                modal.remove();
            }
        }

        function deleteForm(key) {
            const confirmation = confirm("¿Estás seguro de que quieres borrar este formulario?");
            if (confirmation) {
                localStorage.removeItem(key); // Remove the form from localStorage
                loadForms(); // Reload the table to reflect changes
                alert("Formulario borrado exitosamente.");
            }
        }

        // Call the function to populate the username filter on page load
        populateUserFilter();

        // Call the function to populate the year filter on page load
        populateYearFilter();

        loadForms();

        // Añadir función global para el botón desplegable
        function toggleDetails(id) {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        }