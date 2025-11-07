const params = new URLSearchParams(window.location.search);
        const username = params.get('nombre'); // Get the username from the query parameter

        if (!username) {
            alert('Error: Usuario no identificado.');
            window.location.href = 'inicio_app1.html'; // Redirect to the main page
        }

        const userData = JSON.parse(localStorage.getItem(username)) || {};

        document.getElementById('user-title').textContent = `Formulario Mensual: ${username}`;

        function redirectToPersonalizedInterface() {
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
        }

        const formWidget = document.createElement('div');
        formWidget.className = 'form-widget';
        formWidget.innerHTML = `
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

        function toggleForm() {
            const formWidget = document.querySelector('.form-widget');
            formWidget.style.display = formWidget.style.display === 'none' ? 'block' : 'none';
            if (formWidget.style.display === 'block') {
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

        function generateDataTable() {
            dataTable.innerHTML = '';
            for (let month = 0; month < 12; month++) {
                for (let year = 2020; year <= new Date().getFullYear(); year++) {
                    const formDataKey = `formData_${username}_${year}_${month}`;
                    const formData = JSON.parse(localStorage.getItem(formDataKey));
                    if (formData) {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${year}</td>
                            <td>${new Date(0, month).toLocaleString('es-ES', { month: 'long' })}</td>
                            <td>${formData.trainingAttendance || ''}</td>
                            <td>${formData.matches.length}</td>
                            <td>${formData.matches.map(match => `Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}`).join('<br>')}</td>
                            <td>${formData.transportExpenses.length}</td>
                            <td>${formData.transportExpenses.map(expense => 
                                `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '')
                            ).join('<br>')}</td>
                            <td>${formData.dietExpenses.length}</td>
                            <td>${formData.dietExpenses.map(expense => 
                                `Fecha: ${expense.date}, Concepto: ${expense.concept}, Importe: ${expense.amount}` +
                                (expense.file ? `<br><a href="${expense.file}" target="_blank">Archivo</a>` : '')
                            ).join('<br>')}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="edit-button" onclick="editForm(${year}, ${month})">Editar</button>
                                    <button class="delete-button" onclick="deleteForm(${year}, ${month})">Borrar</button>
                                </div>
                            </td>
                        `;
                        dataTable.appendChild(row);
                    }
                }
            }
        }

        function editForm(year, month) {
            const formDataKey = `formData_${username}_${year}_${month}`;
            const formData = JSON.parse(localStorage.getItem(formDataKey));
            if (formData) {
                document.getElementById('formYearSelect').value = year;
                document.getElementById('formMonthSelect').value = month;
                document.getElementById('trainingAttendance').value = formData.trainingAttendance;

                const awayMatchesDetails = document.getElementById('awayMatchesDetails');
                awayMatchesDetails.innerHTML = '';
                formData.matches.forEach(match => {
                    const matchDiv = document.createElement('div');
                    matchDiv.innerHTML = `
                        <input type="date" value="${match.date}" required>
                        <input type="text" value="${match.locality}" required>
                        <input type="text" value="${match.place}" required>
                        <input type="number" value="${match.km}" required>
                    `;
                    awayMatchesDetails.appendChild(matchDiv);
                });

                const transportExpensesDetails = document.getElementById('transportExpensesDetails');
                transportExpensesDetails.innerHTML = '';
                formData.transportExpenses.forEach(expense => {
                    const expenseDiv = document.createElement('div');
                    expenseDiv.innerHTML = `
                        <input type="date" value="${expense.date}" required>
                        <input type="text" value="${expense.concept}" required>
                        <input type="number" value="${expense.amount}" required>
                    `;
                    transportExpensesDetails.appendChild(expenseDiv);
                });

                const dietExpensesDetails = document.getElementById('dietExpensesDetails');
                dietExpensesDetails.innerHTML = '';
                formData.dietExpenses.forEach(expense => {
                    const expenseDiv = document.createElement('div');
                    expenseDiv.innerHTML = `
                        <input type="date" value="${expense.date}" required>
                        <input type="text" value="${expense.concept}" required>
                        <input type="number" value="${expense.amount}" required>
                    `;
                    dietExpensesDetails.appendChild(expenseDiv);
                });

                document.getElementById('weeksInMonth').value = formData.weeksInMonth;

                isEditMode = true;
                editYear = year;
                editMonth = month;
                toggleForm();
            }
        }

        function deleteForm(year, month) {
            const confirmation = confirm("¿Estás seguro de que quieres borrar este formulario?");
            if (confirmation) {
                const formDataKey = `formData_${username}_${year}_${month}`;
                localStorage.removeItem(formDataKey);
                generateDataTable();
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

            // Transporte: guardar archivo por gasto
            const transportExpenses = await Promise.all(
                Array.from(document.getElementById('transportExpensesDetails').children).map(async expenseDiv => {
                    const date = expenseDiv.children[0].value;
                    const concept = expenseDiv.children[1].value;
                    const amount = expenseDiv.children[2].value;
                    const fileInput = expenseDiv.children[3];
                    let fileBase64 = null;
                    if (fileInput && fileInput.files[0]) {
                        fileBase64 = await fileToBase64(fileInput.files[0]);
                    }
                    return { date, concept, amount, file: fileBase64 };
                })
            );

            // Dietas: guardar archivo por gasto
            const dietExpenses = await Promise.all(
                Array.from(document.getElementById('dietExpensesDetails').children).map(async expenseDiv => {
                    const date = expenseDiv.children[0].value;
                    const concept = expenseDiv.children[1].value;
                    const amount = expenseDiv.children[2].value;
                    const fileInput = expenseDiv.children[3];
                    let fileBase64 = null;
                    if (fileInput && fileInput.files[0]) {
                        fileBase64 = await fileToBase64(fileInput.files[0]);
                    }
                    return { date, concept, amount, file: fileBase64 };
                })
            );

            const matches = Array.from(document.getElementById('awayMatchesDetails').children).map(matchDiv => ({
                date: matchDiv.children[0].value,
                locality: matchDiv.children[1].value,
                place: matchDiv.children[2].value,
                km: matchDiv.children[3].value
            }));

            const formDataKey = `formData_${username}_${year}_${month}`;
            const formData = {
                trainingAttendance: document.getElementById('trainingAttendance').value,
                matches,
                transportExpenses,
                dietExpenses,
                weeksInMonth: document.getElementById('weeksInMonth').value,
                clubCode: document.getElementById('clubCode').value
            };

            localStorage.setItem(formDataKey, JSON.stringify(formData));
            alert(isEditMode ? 'Formulario actualizado exitosamente.' : 'Formulario guardado exitosamente.');
            isEditMode = false;
            editYear = null;
            editMonth = null;
            toggleForm();
            generateDataTable();
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