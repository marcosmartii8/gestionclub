const params = new URLSearchParams(window.location.search);
        const username = params.get('nombre');
        const currentUserData = JSON.parse(localStorage.getItem(username));

        function getAuthHeaders(extraHeaders = {}) {
            if (window.AuthUtils && typeof window.AuthUtils.getAuthHeaders === 'function') {
                return window.AuthUtils.getAuthHeaders({ userHint: username, extraHeaders });
            }

            return { ...extraHeaders };
        }

        function handleAuthFailure(response) {
            if (window.AuthUtils && typeof window.AuthUtils.handleAuthFailure === 'function') {
                return window.AuthUtils.handleAuthFailure(response);
            }
            return false;
        }

        if (!currentUserData || !currentUserData.clubCode) {
            alert('Error: Código del club no encontrado.');
            window.location.href = 'inicio_app1.html';
        }

        const currentClubCode = currentUserData.clubCode;
        let sortDirection = {}; // Track sort direction for each column
        let allFormularios = []; // Cache de todos los formularios
        let allUsers = {}; // Cache de usuarios

        async function loadUsers() {
            try {
                const response = await fetch('/api/users', {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    if (handleAuthFailure(response)) return;
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const rawUsers = await response.json();
                const users = Array.isArray(rawUsers) ? rawUsers : [];
                
                // Guardar usuarios en cache
                users.forEach(user => {
                    allUsers[user.username] = user;
                });
                
                // Poblar el select de usuarios del mismo club y con rol de voluntario
                const userSelect = document.getElementById('filter-username');
                const clubUsers = users.filter(u => u.clubCode === currentClubCode && u.role === 'voluntario');
                
                clubUsers.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.username;
                    option.textContent = user.fullname || user.fullName || user.username;
                    userSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error cargando usuarios:', error);
            }
        }

        function populateYearFilterFromAPI() {
            const yearSet = new Set();
            
            // Obtener años únicos de allFormularios
            allFormularios.forEach(formData => {
                if (formData.clubCode === currentClubCode) {
                    yearSet.add(formData.year.toString());
                }
            });

            const yearFilter = document.getElementById('filter-year');
            // Limpiar opciones existentes excepto "Todos"
            while (yearFilter.options.length > 1) {
                yearFilter.remove(1);
            }
            
            // Agregar años ordenados
            Array.from(yearSet).sort().forEach(year => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });
        }

        async function loadForms() {
            const tableBody = document.getElementById('forms-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            try {
                const response = await fetch('/api/formularios', {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    if (handleAuthFailure(response)) return;
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const rawFormularios = await response.json();
                allFormularios = Array.isArray(rawFormularios) ? rawFormularios : [];
                
                // Filtrar formularios del mismo club
                const clubForms = allFormularios.filter(formData => formData.clubCode === currentClubCode);
                
                let i = 0;
                for (const formData of clubForms) {
                    const formUser = formData.username;
                    const year = formData.year;
                    const month = formData.month;
                    
                    // Obtener datos del usuario
                    const userResponse = await fetch(`/api/users/${formUser}`, {
                        headers: getAuthHeaders()
                    });
                    const userData = userResponse.ok ? await userResponse.json() : null;
                    const fullName = userData?.fullname || userData?.fullName || formUser;

                        // --- Desplazamientos detalles con botón desplegable ---
                        const matchDetailsId = `match-details-${i}`;
                        const hasMatches = formData.matches && formData.matches.length > 0;
                        const matchDetailsContent = hasMatches 
                            ? formData.matches.map(match => `Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}`).join('<br>')
                            : '<em style="color: #999;">No hay datos</em>';
                        const matchDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${matchDetailsId}')">Ver</button>
                            <div id="${matchDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${matchDetailsContent}
                            </div>
                        `;

                        // --- Transporte detalles con botón desplegable (mostrar archivo si existe) ---
                        const transportDetailsId = `transport-details-${i}`;
                        const hasTransport = formData.transportExpenses && formData.transportExpenses.length > 0;
                        const transportDetailsContent = hasTransport
                            ? formData.transportExpenses.map(expense => {
                                let fileUrl = expense.url || expense.fileUrl || (typeof expense.file === 'string' ? expense.file : (expense.file && expense.file.url)) || null;
                                let fileType = expense.type || (expense.file && typeof expense.file === 'object' ? expense.file.type : '');
                                let fileIcon = fileType?.includes('pdf') ? '📄' : '🖼️';
                                let fileLink = '';
                                if (fileUrl) {
                                    fileLink = `<br><a href="${fileUrl}" target="_blank" style="color: #0288d1;">${fileIcon} Ver archivo</a>`;
                                }
                                return `Fecha: ${expense.date}, Concepto: ${expense.concept || ''}, Importe: ${expense.amount}€${fileLink}`;
                            }).join('<br>')
                            : '<em style="color: #999;">No hay datos</em>';
                        const transportDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${transportDetailsId}')">Ver</button>
                            <div id="${transportDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${transportDetailsContent}
                            </div>
                        `;

                        // --- Dietas detalles con botón desplegable (mostrar archivo si existe) ---
                        const dietDetailsId = `diet-details-${i}`;
                        const hasDiets = formData.dietExpenses && formData.dietExpenses.length > 0;
                        const dietDetailsContent = hasDiets
                            ? formData.dietExpenses.map(expense => {
                                let fileUrl = expense.url || expense.fileUrl || (typeof expense.file === 'string' ? expense.file : (expense.file && expense.file.url)) || null;
                                let fileType = expense.type || (expense.file && typeof expense.file === 'object' ? expense.file.type : '');
                                let fileIcon = fileType?.includes('pdf') ? '📄' : '🖼️';
                                let fileLink = '';
                                if (fileUrl) {
                                    fileLink = `<br><a href="${fileUrl}" target="_blank" style="color: #f57c00;">${fileIcon} Ver archivo</a>`;
                                }
                                return `Fecha: ${expense.date}, Concepto: ${expense.concept || ''}, Importe: ${expense.amount}€${fileLink}`;
                            }).join('<br>')
                            : '<em style="color: #999;">No hay datos</em>';
                        const dietDetailsHtml = `
                            <button type="button" onclick="toggleDetails('${dietDetailsId}')">Ver</button>
                            <div id="${dietDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                                ${dietDetailsContent}
                            </div>
                        `;

                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${fullName}</td>
                            <td>${year}</td>
                            <td>${new Date(0, month).toLocaleString('es-ES', { month: 'long' })}</td>
                            <td>${formData.trainingAttendance || ''}</td>
                            <td>${formData.weeksInMonth || formData.semanas || 0}</td>
                            <td>
                                ${matchDetailsHtml}
                            </td>
                            <td>
                                ${transportDetailsHtml}
                            </td>
                            <td>
                                ${dietDetailsHtml}
                            </td>
                            <td>
                                <button onclick="editForm('${formUser}', ${year}, ${month})">Editar</button>
                                <button onclick="deleteForm('${formUser}', ${year}, ${month})">Borrar</button>
                            </td>
                        `;
                        tableBody.appendChild(row);
                        i++;
                }
            } catch (error) {
                console.error('Error cargando formularios:', error);
                alert('Error al cargar los formularios');
            }
            
            // Poblar filtro de años después de cargar formularios
            populateYearFilterFromAPI();
        }

        function applyFilters() {
            const filterYear = document.getElementById('filter-year').value;
            const filterMonth = document.getElementById('filter-month').value;
            const filterUsername = document.getElementById('filter-username').value;

            const tableBody = document.getElementById('forms-table-body');
            tableBody.innerHTML = ''; // Clear existing rows

            // Filtrar formularios del mismo club
            const clubForms = allFormularios.filter(formData => formData.clubCode === currentClubCode);

            let i = 0;
            for (const formData of clubForms) {
                const formUser = formData.username;
                const year = formData.year.toString();
                const month = formData.month.toString();
                
                const matchesFilters =
                    (filterYear === 'all' || filterYear === year) &&
                    (filterMonth === 'all' || filterMonth === month) &&
                    (filterUsername === 'all' || filterUsername === formUser);

                if (matchesFilters) {
                    const userData = allUsers[formUser];
                    const fullName = userData?.fullname || userData?.fullName || formUser;

                    const matchDetailsId = `match-details-filter-${i}`;
                    const hasMatches = formData.matches && formData.matches.length > 0;
                    const matchDetailsContent = hasMatches
                        ? formData.matches.map(match => `Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}`).join('<br>')
                        : '<em style="color: #999;">No hay datos</em>';
                    const matchDetailsHtml = `
                        <button type="button" onclick="toggleDetails('${matchDetailsId}')">Ver</button>
                        <div id="${matchDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                            ${matchDetailsContent}
                        </div>
                    `;
                    const transportDetailsId = `transport-details-filter-${i}`;
                    const hasTransport = formData.transportExpenses && formData.transportExpenses.length > 0;
                    const transportDetailsContent = hasTransport
                        ? formData.transportExpenses.map(expense => {
                            let fileLink = '';
                            if (expense.file) {
                                const fileUrl = typeof expense.file === 'string' ? expense.file : expense.file.url;
                                const fileType = typeof expense.file === 'object' ? expense.file.type : '';
                                const fileIcon = fileType?.includes('pdf') ? '📄' : '🖼️';
                                
                                if (fileUrl) {
                                    fileLink = `<br><a href="${fileUrl}" target="_blank" style="color: #0288d1;">${fileIcon} Ver archivo</a>`;
                                }
                            }
                            
                            return `Fecha: ${expense.date}, Concepto: ${expense.concept || ''}, Importe: ${expense.amount}€${fileLink}`;
                        }).join('<br>')
                        : '<em style="color: #999;">No hay datos</em>';
                    const transportDetailsHtml = `
                        <button type="button" onclick="toggleDetails('${transportDetailsId}')">Ver</button>
                        <div id="${transportDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                            ${transportDetailsContent}
                        </div>
                    `;
                    const dietDetailsId = `diet-details-filter-${i}`;
                    const hasDiets = formData.dietExpenses && formData.dietExpenses.length > 0;
                    const dietDetailsContent = hasDiets
                        ? formData.dietExpenses.map(expense => {
                            let fileLink = '';
                            if (expense.file) {
                                const fileUrl = typeof expense.file === 'string' ? expense.file : expense.file.url;
                                const fileType = typeof expense.file === 'object' ? expense.file.type : '';
                                const fileIcon = fileType?.includes('pdf') ? '📄' : '🖼️';
                                
                                if (fileUrl) {
                                    fileLink = `<br><a href="${fileUrl}" target="_blank" style="color: #f57c00;">${fileIcon} Ver archivo</a>`;
                                }
                            }
                            
                            return `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}€${fileLink}`;
                        }).join('<br>')
                        : '<em style="color: #999;">No hay datos</em>';
                    const dietDetailsHtml = `
                        <button type="button" onclick="toggleDetails('${dietDetailsId}')">Ver</button>
                        <div id="${dietDetailsId}" style="display:none; text-align:left; font-size:0.85em; margin-top:4px;">
                            ${dietDetailsContent}
                        </div>
                    `;
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${fullName}</td>
                        <td>${year}</td>
                        <td>${new Date(0, formData.month).toLocaleString('es-ES', { month: 'long' })}</td>
                        <td>${formData.trainingAttendance || ''}</td>
                        <td>${formData.weeksInMonth || formData.semanas || 0}</td>
                        <td>
                            ${matchDetailsHtml}
                        </td>
                        <td>
                            ${transportDetailsHtml}
                        </td>
                        <td>
                            ${dietDetailsHtml}
                        </td>
                        <td>
                            <button onclick="editForm('${formUser}', ${formData.year}, ${formData.month})">Editar</button>
                            <button onclick="deleteForm('${formUser}', ${formData.year}, ${formData.month})">Borrar</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                    i++;
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

        async function editForm(formUser, year, month) {
            try {
                const response = await fetch(`/api/formularios/${formUser}`, {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    if (handleAuthFailure(response)) return;
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const rawFormularios = await response.json();
                const formularios = Array.isArray(rawFormularios) ? rawFormularios : [];
                let formData = formularios.find(f => f.year === year && f.month === month);

                if (formData) {
                    // Normalizar campos para compatibilidad
                    formData = {
                        ...formData,
                        trainingAttendance: formData.trainingAttendance ?? formData.asistencia ?? 0,
                        matches: formData.matches ?? formData.desplazamientos ?? [],
                        transportExpenses: formData.transportExpenses ?? formData.gastosTransporte ?? formData.gastos_transporte ?? [],
                        dietExpenses: formData.dietExpenses ?? formData.gastosDietas ?? formData.gastos_dietas ?? [],
                        weeksInMonth: formData.weeksInMonth ?? formData.semanas ?? 0
                    };
                    // Almacenar archivos existentes en una variable global accesible, robusto para todos los campos posibles
                    window.existingFilesData = {
                        transport: formData.transportExpenses ? formData.transportExpenses.map(e => {
                            // Extraer la URL del archivo de cualquier campo posible
                            return e.fileUrl || e.url || (typeof e.file === 'string' ? e.file : (e.file && e.file.url ? e.file.url : null)) || null;
                        }) : [],
                        diet: formData.dietExpenses ? formData.dietExpenses.map(e => {
                            return e.fileUrl || e.url || (typeof e.file === 'string' ? e.file : (e.file && e.file.url ? e.file.url : null)) || null;
                        }) : []
                    };
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
                                ${(formData.transportExpenses || []).map((expense, index) => {
                                    let fileUrl = expense.url || expense.fileUrl || (expense.file ? (typeof expense.file === 'string' ? expense.file : expense.file.url) : null);
                                    let fileName = fileUrl ? fileUrl.split('/').pop() : '';
                                    return `
                                    <div id="transport-expense-${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;" data-file-index="${index}">
                                        <label>Fecha:</label>
                                        <input type="date" value="${expense.date}">
                                        <label>Concepto:</label>
                                        <input type="text" value="${expense.concept || ''}">
                                        <label>Importe:</label>
                                        <input type="number" value="${expense.amount}">
                                        <label>Ticket/Factura:</label>
                                        <input type="file" accept="image/*,application/pdf">
                                        ${fileUrl ? `<a href="${fileUrl}" target="_blank" style="color:#0288d1;">Ver actual (${fileName})</a>` : '<span style="color:#888;">No hay archivo</span>'}
                                        <button type="button" onclick="removeElement('transport-expense-${index}')">Eliminar</button>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                            <button type="button" onclick="addTransportExpense()">Añadir Gasto Transporte</button>
                            <h3>Gastos en Dietas:</h3>
                            <div id="edit-dietExpenses">
                                ${(formData.dietExpenses || []).map((expense, index) => {
                                    let fileUrl = expense.url || expense.fileUrl || (expense.file ? (typeof expense.file === 'string' ? expense.file : expense.file.url) : null);
                                    let fileName = fileUrl ? fileUrl.split('/').pop() : '';
                                    return `
                                    <div id="diet-expense-${index}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;" data-file-index="${index}">
                                        <label>Fecha:</label>
                                        <input type="date" value="${expense.date}">
                                        <label>Concepto:</label>
                                        <input type="text" value="${expense.concept || ''}">
                                        <label>Importe:</label>
                                        <input type="number" value="${expense.amount}">
                                        <label>Ticket/Factura:</label>
                                        <input type="file" accept="image/*,application/pdf">
                                        ${fileUrl ? `<a href="${fileUrl}" target="_blank" style="color:#f57c00;">Ver actual (${fileName})</a>` : '<span style="color:#888;">No hay archivo</span>'}
                                        <button type="button" onclick="removeElement('diet-expense-${index}')">Eliminar</button>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                            <button type="button" onclick="addDietExpense()">Añadir Gasto en Dietas</button>
                            <label>Marcar semanas que tiene el mes:</label>
                            <select id="edit-weeksInMonth">
                                ${[1, 2, 3, 4, 5].map(week => `<option value="${week}" ${week == formData.weeksInMonth ? 'selected' : ''}>${week} semana${week > 1 ? 's' : ''}</option>`).join('')}
                            </select>
                            <button type="button" onclick="saveEditedForm('${formUser}', ${year}, ${month})">Guardar</button>
                            <button type="button" onclick="closeEditForm()">Cancelar</button>
                        </form>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                }
            } catch (error) {
                console.error('Error cargando formulario:', error);
                alert('Error al cargar el formulario para editar');
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
            if (!window.existingFilesData) window.existingFilesData = { transport: [], diet: [] };
            window.existingFilesData.transport[index] = null;
            
            const div = document.createElement('div');
            div.id = `transport-expense-${index}`;
            div.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;';
            div.setAttribute('data-file-index', index);
            div.innerHTML = `
                <label>Fecha:</label>
                <input type="date">
                <label>Concepto:</label>
                <input type="text">
                <label>Importe:</label>
                <input type="number">
                <label>Ticket/Factura:</label>
                <input type="file" accept="image/*,application/pdf">
                <span style="color:#888;">No hay archivo</span>
                <button type="button" onclick="removeElement('transport-expense-${index}')">Eliminar</button>
            `;
            container.appendChild(div);
        }

        function addDietExpense() {
            const container = document.getElementById('edit-dietExpenses');
            const index = container.children.length;
            if (!window.existingFilesData) window.existingFilesData = { transport: [], diet: [] };
            window.existingFilesData.diet[index] = null;
            
            const div = document.createElement('div');
            div.id = `diet-expense-${index}`;
            div.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;';
            div.setAttribute('data-file-index', index);
            div.innerHTML = `
                <label>Fecha:</label>
                <input type="date">
                <label>Concepto:</label>
                <input type="text">
                <label>Importe:</label>
                <input type="number">
                <label>Ticket/Factura:</label>
                <input type="file" accept="image/*,application/pdf">
                <span style="color:#888;">No hay archivo</span>
                <button type="button" onclick="removeElement('diet-expense-${index}')">Eliminar</button>
            `;
            container.appendChild(div);
        }

        function removeElement(elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.remove();
            }
        }

        async function saveEditedForm(formUser, year, month) {
            try {
                // Mostrar mensaje de progreso
                const saveButton = event.target;
                const originalText = saveButton.textContent;
                saveButton.textContent = 'Guardando...';
                saveButton.disabled = true;

                // Recoger datos del formulario
                const matches = Array.from(document.querySelectorAll('#edit-awayMatches > div')).map(div => {
                    const inputs = div.querySelectorAll('input[type="date"], input[type="text"], input[type="number"]');
                    return {
                        date: inputs[0].value,
                        locality: inputs[1].value,
                        place: inputs[2].value,
                        km: inputs[3].value
                    };
                });
                
                // Recoger gastos de transporte (mantener o subir archivos)
                const transportExpenses = await Promise.all(Array.from(document.querySelectorAll('#edit-transportExpenses > div')).map(async (div, idx) => {
                    const fileIndex = parseInt(div.dataset.fileIndex);
                    const existingFile = window.existingFilesData?.transport?.[fileIndex] || null;
                    const inputs = div.querySelectorAll('input[type="date"], input[type="text"], input[type="number"]');
                    const expense = {
                        date: inputs[0].value,
                        concept: inputs[1].value,
                        amount: parseFloat(inputs[2].value)
                    };
                    const fileInput = div.querySelector('input[type="file"]');
                    if (fileInput && fileInput.files && fileInput.files[0]) {
                        // Subir archivo nuevo a Supabase
                        try {
                            const uploadResult = await window.uploadFileToSupabase(fileInput.files[0], 'gastos_transporte');
                            if (uploadResult && uploadResult.url) {
                                expense.fileUrl = uploadResult.url;
                                expense.file = uploadResult.url;
                                expense.url = uploadResult.url;
                            }
                        } catch (e) {
                            alert('Error subiendo archivo de transporte: ' + e.message);
                        }
                    } else if (existingFile) {
                        // Guardar la URL anterior en todos los campos posibles
                        expense.fileUrl = existingFile;
                        expense.file = existingFile;
                        expense.url = existingFile;
                    }
                    return expense;
                }));

                // Recoger gastos de dietas (mantener o subir archivos)
                const dietExpenses = await Promise.all(Array.from(document.querySelectorAll('#edit-dietExpenses > div')).map(async (div, idx) => {
                    const fileIndex = parseInt(div.dataset.fileIndex);
                    const existingFile = window.existingFilesData?.diet?.[fileIndex] || null;
                    const inputs = div.querySelectorAll('input[type="date"], input[type="text"], input[type="number"]');
                    const expense = {
                        date: inputs[0].value,
                        concept: inputs[1].value,
                        amount: parseFloat(inputs[2].value)
                    };
                    const fileInput = div.querySelector('input[type="file"]');
                    if (fileInput && fileInput.files && fileInput.files[0]) {
                        // Subir archivo nuevo a Supabase
                        try {
                            const uploadResult = await window.uploadFileToSupabase(fileInput.files[0], 'gastos_dietas');
                            if (uploadResult && uploadResult.url) {
                                expense.fileUrl = uploadResult.url;
                                expense.file = uploadResult.url;
                                expense.url = uploadResult.url;
                            }
                        } catch (e) {
                            alert('Error subiendo archivo de dietas: ' + e.message);
                        }
                    } else if (existingFile) {
                        // Guardar la URL anterior en todos los campos posibles
                        expense.fileUrl = existingFile;
                        expense.file = existingFile;
                        expense.url = existingFile;
                    }
                    return expense;
                }));

                const updatedFormData = {
                    username: formUser,
                    year: parseInt(year),
                    month: parseInt(month),
                    asistencia: parseInt(document.getElementById('edit-trainingAttendance').value) || 0,
                    desplazamientos: matches,
                    gastosTransporte: transportExpenses,
                    gastosDietas: dietExpenses,
                    semanas: parseInt(document.getElementById('edit-weeksInMonth').value) || 4
                };

                console.log('💾 Guardando formulario editado:', updatedFormData);

                const response = await fetch('/api/formularios', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(updatedFormData)
                });

                if (response.ok) {
                    alert('Formulario actualizado exitosamente.');
                    loadForms();
                    closeEditForm();
                } else {
                    if (handleAuthFailure(response)) return;

                    let errorData = {};
                    try {
                        errorData = await response.json();
                    } catch (_) {
                        errorData = {};
                    }
                    console.error('Error del servidor:', errorData);
                    alert('Error al actualizar el formulario: ' + (errorData.message || 'Error desconocido'));
                    saveButton.textContent = originalText;
                    saveButton.disabled = false;
                }
            } catch (error) {
                console.error('Error guardando formulario:', error);
                alert('Error al guardar el formulario: ' + error.message);
                const saveButton = document.querySelector('#edit-form button[onclick*="saveEditedForm"]');
                if (saveButton) {
                    saveButton.textContent = 'Guardar';
                    saveButton.disabled = false;
                }
            }
        }

        function closeEditForm() {
            const modal = document.getElementById('edit-form-modal');
            if (modal) {
                modal.remove();
            }
        }

        async function deleteForm(formUser, year, month) {
            const confirmation = confirm("¿Estás seguro de que quieres borrar este formulario?");
            if (confirmation) {
                try {
                    const response = await fetch(`/api/formularios/${formUser}/${year}/${month}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    
                    if (response.ok) {
                        loadForms();
                        alert("Formulario borrado exitosamente.");
                    } else {
                        if (handleAuthFailure(response)) return;
                        alert("Error al borrar el formulario.");
                    }
                } catch (error) {
                    console.error('Error eliminando formulario:', error);
                    alert("Error al borrar el formulario.");
                }
            }
        }

        // Call the function to populate the username filter on page load
        loadUsers();

        // Call the function to populate the year filter on page load
        // populateYearFilter(); // Ya no es necesario, los años se obtienen de allFormularios

        loadForms();

        // Añadir función global para el botón desplegable
        function toggleDetails(id) {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
        }