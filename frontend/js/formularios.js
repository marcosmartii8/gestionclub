const params = new URLSearchParams(window.location.search);
        const username = params.get('nombre'); // Get the username from the query parameter

        if (!username) {
            alert('Error: Usuario no identificado.');
            window.location.href = 'inicio_app1.html'; // Redirect to the main page
        }

        const userData = JSON.parse(localStorage.getItem(username)) || {};

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

        document.getElementById('user-title').textContent = `Formulario Mensual: ${username}`;

        function redirectToPersonalizedInterface() {
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
        }

        const formWidget = document.createElement('div');
        formWidget.className = 'form-widget';
        formWidget.innerHTML = `
            <button type="button" class="form-close-btn" onclick="toggleForm()" aria-label="Cerrar formulario">✕</button>
            <h2>Formulario Mensual</h2>
            <form id="monthlyForm" style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                    <div style="flex: 1; min-width: 200px;">
                        <label style="color: black;" for="formYearSelect">Año</label>
                        <input type="number" id="formYearSelect" placeholder="Año" required style="width: 80px; padding: 8px;">
                    </div>
                    <div style="flex: 1; min-width: 200px;">
                        <label style="color: black;" for="formMonthSelect">Mes</label>
                        <select id="formMonthSelect" style="width: 120px; padding: 8px;">
                            <option value="0">Enero</option>
                            <option value="1">Febrero</option>
                            <option value="2">Marzo</option>
                            <option value="3">Abril</option>
                            <option value="4">Mayo</option>
                            <option value="5">Junio</option>
                            <option value="6">Julio</option>
                            <option value="7">Agosto</option>
                            <option value="8">Septiembre</option>
                            <option value="9">Octubre</option>
                            <option value="10">Noviembre</option>
                            <option value="11">Diciembre</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label style="color: black;" for="trainingAttendance">Asistencia entrenamientos y partidos</label>
                    <input type="number" id="trainingAttendance" placeholder="Asistencia" required style="width: 50px; padding: 8px;">
                </div>
                <div>
                    <h3>Desplazamientos fuera del club</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button type="button" onclick="incrementAwayMatches()" style="padding: 8px;">Añadir</button>
                        <button type="button" onclick="decrementAwayMatches()" style="padding: 8px;">Borrar</button>
                    </div>
                    <div id="awayMatchesDetails" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
                <div>
                    <h3>Gastos de Transporte</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button type="button" onclick="incrementTransportExpenses()" style="padding: 8px;">Añadir</button>
                        <button type="button" onclick="decrementTransportExpenses()" style="padding: 8px;">Borrar</button>
                    </div>
                    <div id="transportExpensesDetails" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;"></div>
                </div>
                <div>
                    <h3>Gastos en Dietas</h3>
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <button type="button" onclick="incrementDietExpenses()" style="padding: 8px;">Añadir</button>
                        <button type="button" onclick="decrementDietExpenses()" style="padding: 8px;">Borrar</button>
                    </div>
                    <div id="dietExpensesDetails" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;"></div>
                </div>
                <div>
                    <label style="color: black;" for="weeksInMonth">Marcar semanas que tiene el mes</label>
                    <select id="weeksInMonth" style="width: 100%; padding: 8px;">
                        <option value="1">1 semana</option>
                        <option value="2">2 semanas</option>
                        <option value="3">3 semanas</option>
                        <option value="4">4 semanas</option>
                        <option value="5">5 semanas</option>
                    </select>
                </div>
                <input type="hidden" id="clubCode" value="${userData.clubCode || ''}">
                <button type="submit" style="padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Guardar</button>
            </form>
        `;
        document.body.appendChild(formWidget);

        const dataTable = document.getElementById('dataTable').getElementsByTagName('tbody')[0];

        let isEditMode = false;
        let editYear = null;
        let editMonth = null;
        let currentEditFormData = null;

        function resetFormToCreateMode() {
            const monthlyForm = document.getElementById('monthlyForm');
            if (monthlyForm) {
                monthlyForm.reset();
            }

            const now = new Date();
            const yearInput = document.getElementById('formYearSelect');
            const monthSelect = document.getElementById('formMonthSelect');
            const attendanceInput = document.getElementById('trainingAttendance');
            const weeksSelect = document.getElementById('weeksInMonth');

            if (yearInput) yearInput.value = String(now.getFullYear());
            if (monthSelect) monthSelect.value = String(now.getMonth());
            if (attendanceInput) attendanceInput.value = '';
            if (weeksSelect) weeksSelect.value = '4';

            const awayMatchesDetails = document.getElementById('awayMatchesDetails');
            const transportExpensesDetails = document.getElementById('transportExpensesDetails');
            const dietExpensesDetails = document.getElementById('dietExpensesDetails');

            if (awayMatchesDetails) awayMatchesDetails.innerHTML = '';
            if (transportExpensesDetails) transportExpensesDetails.innerHTML = '';
            if (dietExpensesDetails) dietExpensesDetails.innerHTML = '';

            isEditMode = false;
            editYear = null;
            editMonth = null;
            currentEditFormData = null;
        }

        function toggleForm(options = {}) {
            const formWidget = document.querySelector('.form-widget');
            const isHidden = window.getComputedStyle(formWidget).display === 'none';

            if (isHidden && !options.preserveState) {
                resetFormToCreateMode();
            }

            formWidget.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                formWidget.scrollIntoView({ behavior: 'smooth' }); // Scroll to the form when opened
            }
        }

        function validateFormDate(year, month) {
            const currentDate = new Date();
            const selectedDate = new Date(year, month);
            const firstDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const fifthDayOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 5); // Changed from 10 to 5

            if (selectedDate.getFullYear() === currentDate.getFullYear() && selectedDate.getMonth() === currentDate.getMonth()) {
                return true;
            }
            if (selectedDate.getFullYear() === currentDate.getFullYear() && selectedDate.getMonth() === currentDate.getMonth() - 1) {
                if (currentDate <= fifthDayOfCurrentMonth) { // Changed from tenthDayOfCurrentMonth to fifthDayOfCurrentMonth
                    return true;
                } else {
                    alert('No se pueden seleccionar meses anteriores.');
                    return false;
                }
            }
            if (selectedDate.getFullYear() === currentDate.getFullYear() - 1 && currentDate.getMonth() === 0 && selectedDate.getMonth() === 11) {
                if (currentDate <= fifthDayOfCurrentMonth) { // Changed from tenthDayOfCurrentMonth to fifthDayOfCurrentMonth
                    return true;
                } else {
                    alert('No se pueden seleccionar meses anteriores.');
                    return false;
                }
            }
            if (selectedDate < firstDayOfCurrentMonth) {
                alert('No se pueden seleccionar meses anteriores.');
                return false;
            }
            if (selectedDate > currentDate) {
                alert('No se pueden seleccionar meses posteriores.');
                return false;
            }
            return false;
        }

        async function generateDataTable() {
            dataTable.innerHTML = '';
            try {
                const response = await fetch(`/api/formularios/${username}`, {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    if (handleAuthFailure(response)) return;
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const rawFormularios = await response.json();
                const formularios = Array.isArray(rawFormularios) ? rawFormularios : [];
                
                console.log('📊 Formularios cargados:', formularios);
                
                if (formularios.length === 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td colspan="8" style="text-align: center; color: #666;">No tienes formularios creados aún</td>`;
                    dataTable.appendChild(row);
                    return;
                }
                

                formularios.forEach(formData => {
                    const year = formData.year;
                    const month = formData.month;
                    const desplazamientos = Array.isArray(formData.matches)
                        ? formData.matches
                        : (formData.desplazamientos || []);
                    const gastosTransporte = formData.gastosTransporte || formData.transportExpenses || [];
                    const gastosDietas = formData.gastosDietas || formData.dietExpenses || [];
                    const asistencia = formData.asistencia ?? formData.trainingAttendance ?? 0;
                    const semanas = formData.semanas ?? formData.weeksInMonth ?? 0;

                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${year}</td>
                        <td>${new Date(0, month).toLocaleString('es-ES', { month: 'long' })}</td>
                        <td>${asistencia}</td>
                        <td><button class="ver-btn" data-type="desplazamientos">Ver</button></td>
                        <td><button class="ver-btn" data-type="gastosTransporte">Ver</button></td>
                        <td><button class="ver-btn" data-type="gastosDietas">Ver</button></td>
                        <td>${semanas}</td>
                        <td>
                            <button class="edit-button" data-year="${year}" data-month="${month}">✏️ Editar</button>
                        </td>
                    `;

                    // Añadir listeners a los botones "Ver"
                    const verBtns = row.querySelectorAll('.ver-btn');
                    verBtns.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            let html = '';
                            if (btn.dataset.type === 'desplazamientos') {
                                if (Array.isArray(desplazamientos) && desplazamientos.length > 0) {
                                    html = desplazamientos.map(desp =>
                                        `<div style='margin-bottom:8px;padding:5px;border-left:3px solid #004d40;'>
                                            <strong>📅 ${desp.date}</strong><br>
                                            📍 ${desp.locality}<br>
                                            👥 ${desp.place}<br>
                                            🚗 ${desp.km} km
                                        </div>`
                                    ).join('');
                                } else {
                                    html = '<span style="color:#999">Sin desplazamientos</span>';
                                }
                            } else if (btn.dataset.type === 'gastosTransporte') {
                                let total = 0;
                                if (Array.isArray(gastosTransporte) && gastosTransporte.length > 0) {
                                    html = gastosTransporte.map(gasto => {
                                        const amount = parseFloat(gasto.amount) || 0;
                                        total += amount;
                                        return `<div style='margin-bottom:8px;padding:5px;border-left:3px solid #26a69a;'>
                                            <strong>📅 ${gasto.date}</strong><br>
                                            📝 ${gasto.concept}<br>
                                            💰 ${amount.toFixed(2)}€<br>
                                            ${gasto.fileUrl ? `<a href='${gasto.fileUrl}' target='_blank'>Ver archivo</a>` : ''}
                                        </div>`;
                                    }).join('');
                                    html += `<div style='margin-top:8px;padding:5px;background:#e3f2fd;font-weight:bold;'>Total: ${total.toFixed(2)}€</div>`;
                                } else {
                                    html = '<span style="color:#999">Sin gastos</span>';
                                }
                            } else if (btn.dataset.type === 'gastosDietas') {
                                let total = 0;
                                if (Array.isArray(gastosDietas) && gastosDietas.length > 0) {
                                    html = gastosDietas.map(gasto => {
                                        const amount = parseFloat(gasto.amount) || 0;
                                        total += amount;
                                        return `<div style='margin-bottom:8px;padding:5px;border-left:3px solid #ff9800;'>
                                            <strong>📅 ${gasto.date}</strong><br>
                                            📝 ${gasto.concept}<br>
                                            💰 ${amount.toFixed(2)}€<br>
                                            ${gasto.fileUrl ? `<a href='${gasto.fileUrl}' target='_blank'>Ver archivo</a>` : ''}
                                        </div>`;
                                    }).join('');
                                    html += `<div style='margin-top:8px;padding:5px;background:#fff3e0;font-weight:bold;'>Total: ${total.toFixed(2)}€</div>`;
                                } else {
                                    html = '<span style="color:#999">Sin gastos</span>';
                                }
                            }
                            mostrarModal(html, btn.dataset.type);
                        });
                    });

                    // Evitar tooltip de celda al pulsar en "Editar"
                    const editBtn = row.querySelector('.edit-button');
                    if (editBtn) {
                        editBtn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            editForm(year, month);
                        });
                    }

                    dataTable.appendChild(row);
                });

                // Modal para mostrar detalles
                if (!document.getElementById('modal-detalles')) {
                    const modal = document.createElement('div');
                    modal.id = 'modal-detalles';
                    modal.style.display = 'none';
                    modal.style.position = 'fixed';
                    modal.style.top = '0';
                    modal.style.left = '0';
                    modal.style.width = '100vw';
                    modal.style.height = '100vh';
                    modal.style.background = 'rgba(0,0,0,0.4)';
                    modal.style.zIndex = '9999';
                    modal.style.justifyContent = 'center';
                    modal.style.alignItems = 'center';
                    modal.innerHTML = `<div id='modal-content-detalles' style='background:#fff;padding:24px 18px;max-width:420px;width:90vw;max-height:80vh;overflow:auto;border-radius:12px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.25);color:#222;'>
                        <button id='cerrar-modal-detalles' style='position:absolute;top:8px;right:12px;font-size:1.3em;background:none;border:none;cursor:pointer;'>&#10006;</button>
                        <div id='contenido-modal-detalles'></div>
                    </div>`;
                    document.body.appendChild(modal);
                    document.getElementById('cerrar-modal-detalles').onclick = () => {
                        modal.style.display = 'none';
                    };
                }

                window.mostrarModal = function(html, tipo) {
                    const modal = document.getElementById('modal-detalles');
                    const contenido = document.getElementById('contenido-modal-detalles');
                    contenido.innerHTML = `<h3 style='margin-top:0;text-transform:capitalize;'>${tipo.replace('gastos','Gastos ').replace('desplazamientos','Desplazamientos')}</h3>` + html;
                    modal.style.display = 'flex';
                };
            } catch (error) {
                console.error('❌ Error cargando formularios:', error);
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="8" style="text-align: center; color: red;">Error al cargar formularios</td>`;
                dataTable.appendChild(row);
            }
        }

        async function editForm(year, month) {
            try {
                const response = await fetch(`/api/formularios/${username}`, {
                    headers: getAuthHeaders()
                });

                if (!response.ok) {
                    if (handleAuthFailure(response)) return;
                    throw new Error(`Error HTTP ${response.status}`);
                }

                const rawFormularios = await response.json();
                const formularios = Array.isArray(rawFormularios) ? rawFormularios : [];
                const formDataRaw = formularios.find(f => f.year === year && f.month === month);
                const formData = formDataRaw ? {
                    ...formDataRaw,
                    desplazamientos: Array.isArray(formDataRaw.matches)
                        ? formDataRaw.matches
                        : (formDataRaw.desplazamientos || []),
                    gastosTransporte: formDataRaw.gastosTransporte || formDataRaw.transportExpenses || [],
                    gastosDietas: formDataRaw.gastosDietas || formDataRaw.dietExpenses || [],
                    asistencia: formDataRaw.asistencia ?? formDataRaw.trainingAttendance ?? 0,
                    semanas: formDataRaw.semanas ?? formDataRaw.weeksInMonth ?? 0
                } : null;
                
                if (formData) {
                    currentEditFormData = formData; // Guardar globalmente para submit
                    document.getElementById('formYearSelect').value = year;
                    document.getElementById('formMonthSelect').value = month;
                    document.getElementById('trainingAttendance').value = formData.asistencia || 0;
                    document.getElementById('weeksInMonth').value = formData.semanas || 0;

                    // Desplazamientos
                    const awayMatchesDetails = document.getElementById('awayMatchesDetails');
                    awayMatchesDetails.innerHTML = '';
                    const matches = formData.desplazamientos || [];
                    matches.forEach(match => {
                        const matchDiv = document.createElement('div');
                        matchDiv.innerHTML = `
                            <input type="date" value="${match.date}" required>
                            <input type="text" value="${match.locality}" required>
                            <input type="text" value="${match.place}" required>
                            <input type="number" value="${match.km}" required>
                        `;
                        awayMatchesDetails.appendChild(matchDiv);
                    });

                    // Gastos de transporte
                    const transportExpensesDetails = document.getElementById('transportExpensesDetails');
                    transportExpensesDetails.innerHTML = '';
                    const transportExpenses = formData.gastosTransporte || [];
                    transportExpenses.forEach(expense => {
                        const expenseDiv = document.createElement('div');
                        let fileUrl = expense.fileUrl || expense.url || (expense.file ? (typeof expense.file === 'string' ? expense.file : expense.file.url) : null);
                        let fileName = fileUrl ? fileUrl.split('/').pop() : '';
                        expenseDiv.innerHTML = `
                            <input type="date" value="${expense.date}" required>
                            <input type="text" value="${expense.concept}" required>
                            <input type="number" value="${expense.amount}" required>
                            <span class="file-upload-area">
                                ${fileUrl
                                    ? `<a href="${fileUrl}" target="_blank" style="color:#0288d1;display:inline-block;margin-left:8px;">Ver archivo (${fileName})</a>
                                       <button type="button" class="remove-file-btn" style="margin-left:8px;">Eliminar</button>`
                                    : `<input type="file" accept="image/*,application/pdf" style="width:100%;">`}
                            </span>
                        `;
                        if (fileUrl) {
                            expenseDiv.querySelector('.remove-file-btn').addEventListener('click', function() {
                                expense.fileUrl = null;
                                expense.url = null;
                                expense.file = null;
                                expenseDiv.querySelector('.file-upload-area').innerHTML = `<input type="file" accept="image/*,application/pdf" style="width:100%;">`;
                            });
                        }
                        transportExpensesDetails.appendChild(expenseDiv);
                    });

                    // Gastos de dietas
                    const dietExpensesDetails = document.getElementById('dietExpensesDetails');
                    dietExpensesDetails.innerHTML = '';
                    const dietExpenses = formData.gastosDietas || [];
                    dietExpenses.forEach(expense => {
                        const expenseDiv = document.createElement('div');
                        let fileUrl = expense.fileUrl || expense.url || (expense.file ? (typeof expense.file === 'string' ? expense.file : expense.file.url) : null);
                        let fileName = fileUrl ? fileUrl.split('/').pop() : '';
                        expenseDiv.innerHTML = `
                            <input type="date" value="${expense.date}" required>
                            <input type="text" value="${expense.concept}" required>
                            <input type="number" value="${expense.amount}" required>
                            <span class="file-upload-area">
                                ${fileUrl
                                    ? `<a href="${fileUrl}" target="_blank" style="color:#f57c00;display:inline-block;margin-left:8px;">Ver archivo (${fileName})</a>
                                       <button type="button" class="remove-file-btn" style="margin-left:8px;">Eliminar</button>`
                                    : `<input type="file" accept="image/*,application/pdf" style="width:100%;">`}
                            </span>
                        `;
                        if (fileUrl) {
                            expenseDiv.querySelector('.remove-file-btn').addEventListener('click', function() {
                                expense.fileUrl = null;
                                expense.url = null;
                                expense.file = null;
                                expenseDiv.querySelector('.file-upload-area').innerHTML = `<input type="file" accept="image/*,application/pdf" style="width:100%;">`;
                            });
                        }
                        dietExpensesDetails.appendChild(expenseDiv);
                    });

                    isEditMode = true;
                    editYear = year;
                    editMonth = month;
                    toggleForm({ preserveState: true });
                } else {
                    alert('No se encontró el formulario seleccionado.');
                }
            } catch (error) {
                console.error('❌ Error cargando formulario:', error);
                alert('Error al cargar el formulario');
            }
        }

        function incrementTransportExpenses() {
            const transportExpensesDetails = document.getElementById('transportExpensesDetails');
            const expenseDiv = document.createElement('div');
            const expenseIndex = transportExpensesDetails.children.length + 1;
            expenseDiv.innerHTML = `
                <input type="date" placeholder="Fecha Gasto Transporte ${expenseIndex}" required>
                <input type="text" placeholder="Concepto Gasto Transporte ${expenseIndex}" required>
                <input type="number" placeholder="Importe Gasto Transporte ${expenseIndex}" required>
                <input type="file" accept="image/*,application/pdf" style="width:100%;" title="Archivo Gasto Transporte ${expenseIndex}">
            `;
            transportExpensesDetails.appendChild(expenseDiv);
        }

        function decrementTransportExpenses() {
            const transportExpensesDetails = document.getElementById('transportExpensesDetails');
            if (transportExpensesDetails.children.length > 0) {
                transportExpensesDetails.removeChild(transportExpensesDetails.lastChild);
            }
        }

        function incrementDietExpenses() {
            const dietExpensesDetails = document.getElementById('dietExpensesDetails');
            const expenseDiv = document.createElement('div');
            const expenseIndex = dietExpensesDetails.children.length + 1;
            expenseDiv.innerHTML = `
                <input type="date" placeholder="Fecha Gasto Dieta ${expenseIndex}" required>
                <input type="text" placeholder="Concepto Gasto Dieta ${expenseIndex}" required>
                <input type="number" placeholder="Importe Gasto Dieta ${expenseIndex}" required>
                <input type="file" accept="image/*,application/pdf" style="width:100%;" title="Archivo Gasto Dieta ${expenseIndex}">
            `;
            dietExpensesDetails.appendChild(expenseDiv);
        }

        function decrementDietExpenses() {
            const dietExpensesDetails = document.getElementById('dietExpensesDetails');
            if (dietExpensesDetails.children.length > 0) {
                dietExpensesDetails.removeChild(dietExpensesDetails.lastChild);
            }
        }

        function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                if (!file) return resolve(null);
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        document.getElementById('monthlyForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const year = parseInt(document.getElementById('formYearSelect').value);
            const month = parseInt(document.getElementById('formMonthSelect').value);

            if (!validateFormDate(year, month)) {
                return;
            }

            // Verificar si ya existe un formulario para este mes y año (solo si no estamos en modo edición)
            if (!isEditMode) {
                try {
                    const response = await fetch(`/api/formularios/${username}`, {
                        headers: getAuthHeaders()
                    });

                    if (!response.ok) {
                        if (handleAuthFailure(response)) return;
                        throw new Error(`Error HTTP ${response.status}`);
                    }

                    const rawFormularios = await response.json();
                    const formularios = Array.isArray(rawFormularios) ? rawFormularios : [];
                    const exists = formularios.some(f => f.year === year && f.month === month);
                    
                    if (exists) {
                        alert(`Ya existe un formulario para ${new Date(0, month).toLocaleString('es-ES', { month: 'long' })} de ${year}. Si deseas modificarlo, usa el botón "Editar" o borra el formulario existente.`);
                        return;
                    }
                } catch (error) {
                    console.error('Error verificando formularios existentes:', error);
                }
            }


            // Transporte: subir archivo a Supabase y guardar SOLO la URL como fileUrl
            const transportExpenses = await Promise.all(
                Array.from(document.getElementById('transportExpensesDetails').children).map(async (expenseDiv, idx) => {
                    const date = expenseDiv.children[0].value;
                    const concept = expenseDiv.children[1].value;
                    const amount = expenseDiv.children[2].value;
                    const fileInput = expenseDiv.querySelector('input[type="file"]');
                    let fileUrl = null;
                    // Buscar el archivo anterior si existe
                    let previousExpense = null;
                    if (isEditMode && currentEditFormData && currentEditFormData.gastosTransporte && currentEditFormData.gastosTransporte[idx]) {
                        previousExpense = currentEditFormData.gastosTransporte[idx];
                    }
                    if (fileInput && fileInput.files[0]) {
                        try {
                            const uploadResult = await uploadFileToSupabase(fileInput.files[0], 'gastos_transporte');
                            fileUrl = uploadResult.url;
                        } catch (e) {
                            alert('Error subiendo archivo de transporte: ' + e.message);
                        }
                    } else if (previousExpense && (previousExpense.fileUrl || previousExpense.url || previousExpense.file)) {
                        fileUrl = previousExpense.fileUrl || previousExpense.url || (typeof previousExpense.file === 'string' ? previousExpense.file : previousExpense.file?.url);
                    }
                    return { date, concept, amount, fileUrl };
                })
            );

            // Dietas: subir archivo a Supabase y guardar SOLO la URL como fileUrl
            const dietExpenses = await Promise.all(
                Array.from(document.getElementById('dietExpensesDetails').children).map(async (expenseDiv, idx) => {
                    const date = expenseDiv.children[0].value;
                    const concept = expenseDiv.children[1].value;
                    const amount = expenseDiv.children[2].value;
                    const fileInput = expenseDiv.querySelector('input[type="file"]');
                    let fileUrl = null;
                    let previousExpense = null;
                    if (isEditMode && currentEditFormData && currentEditFormData.gastosDietas && currentEditFormData.gastosDietas[idx]) {
                        previousExpense = currentEditFormData.gastosDietas[idx];
                    }
                    if (fileInput && fileInput.files[0]) {
                        try {
                            const uploadResult = await uploadFileToSupabase(fileInput.files[0], 'gastos_dietas');
                            fileUrl = uploadResult.url;
                        } catch (e) {
                            alert('Error subiendo archivo de dieta: ' + e.message);
                        }
                    } else if (previousExpense && (previousExpense.fileUrl || previousExpense.url || previousExpense.file)) {
                        fileUrl = previousExpense.fileUrl || previousExpense.url || (typeof previousExpense.file === 'string' ? previousExpense.file : previousExpense.file?.url);
                    }
                    return { date, concept, amount, fileUrl };
                })
            );

            const matches = Array.from(document.getElementById('awayMatchesDetails').children).map(matchDiv => ({
                date: matchDiv.children[0].value,
                locality: matchDiv.children[1].value,
                place: matchDiv.children[2].value,
                km: matchDiv.children[3].value
            }));

            const formData = {
                username: username,
                year: parseInt(year),
                month: parseInt(month),
                asistencia: parseInt(document.getElementById('trainingAttendance').value || 0),
                desplazamientos: matches,
                gastosTransporte: transportExpenses,
                gastosDietas: dietExpenses,
                semanas: parseInt(document.getElementById('weeksInMonth').value || 0),
                clubCode: document.getElementById('clubCode').value
            };

            try {
                const response = await fetch('/api/formularios', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    alert(isEditMode ? 'Formulario actualizado exitosamente.' : 'Formulario guardado exitosamente.');
                    isEditMode = false;
                    editYear = null;
                    editMonth = null;
                    currentEditFormData = null;
                    toggleForm();
                    generateDataTable();
                } else {
                    if (handleAuthFailure(response)) return;
                    alert('Error al guardar el formulario');
                }
            } catch (error) {
                console.error('Error guardando formulario:', error);
                alert('Error al guardar el formulario');
            }
        });

        function incrementAwayMatches() {
            const awayMatchesDetails = document.getElementById('awayMatchesDetails');
            const matchDiv = document.createElement('div');
            const matchIndex = awayMatchesDetails.children.length + 1;
            matchDiv.innerHTML = `
                <input type="date" placeholder="Fecha del desplazamiento ${matchIndex}" required>
                <input type="text" placeholder="Localidad ${matchIndex}" required>
                <input type="text" placeholder="Equipo ${matchIndex}" required>
                <input type="number" placeholder="Km desde el club" required>
            `;
            awayMatchesDetails.appendChild(matchDiv);
        }

        function decrementAwayMatches() {
            const awayMatchesDetails = document.getElementById('awayMatchesDetails');
            if (awayMatchesDetails.children.length > 0) {
                awayMatchesDetails.removeChild(awayMatchesDetails.lastChild);
            }
        }

        generateDataTable();