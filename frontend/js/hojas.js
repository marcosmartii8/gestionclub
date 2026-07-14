 function goBack() {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('nombre');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
        }

        function getAuthHeaders(extraHeaders = {}) {
            if (window.AuthUtils && typeof window.AuthUtils.getAuthHeaders === 'function') {
                return window.AuthUtils.getAuthHeaders({ userHint: sessionUsername, extraHeaders });
            }

            return { ...extraHeaders };
        }

        // --- Lógica principal ---
        // 1. Obtener usuarios con formularios
        const userSelect = document.getElementById('user-select');
        const formSelect = document.getElementById('form-select');
        const formsSection = document.getElementById('forms-section');
        const formDetails = document.getElementById('form-details');
        const generatePdfBtn = document.getElementById('generate-pdf-btn');

        // Obtener usuario en sesión y su código de club
        const params = new URLSearchParams(window.location.search);
        const sessionUsername = params.get('nombre');
        const sessionUserData = JSON.parse(localStorage.getItem(sessionUsername)) || {};

        function getSessionClubCode() {
            const currentUser = JSON.parse(localStorage.getItem(sessionUsername)) || sessionUserData || {};
            return currentUser.clubCode || localStorage.getItem('clubCode') || sessionUserData.clubCode || '';
        }

        // Map: username -> array de { year, month, formData }
        let userFormsMap = {};

        async function cargarFormularios() {
            try {
                const response = await fetch('/api/formularios', {
                    headers: getAuthHeaders()
                });
                const formularios = await response.json();
                
                userFormsMap = {};
                
                // Filtrar formularios del mismo club y agrupar por usuario
                for (const formData of formularios) {
                    if (formData.clubCode === getSessionClubCode()) {
                        const username = formData.username;
                        if (!userFormsMap[username]) userFormsMap[username] = [];
                        userFormsMap[username].push({
                            year: formData.year,
                            month: formData.month,
                            formData: formData
                        });
                    }
                }

                // Llenar select de usuarios (solo los del mismo club)
                userSelect.innerHTML = '<option value="">-- Selecciona usuario --</option>';
                Object.keys(userFormsMap).forEach(username => {
                    const option = document.createElement('option');
                    option.value = username;
                    option.textContent = username;
                    userSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error cargando formularios:', error);
                alert('Error al cargar los formularios');
            }
        }

        userSelect.addEventListener('change', function() {
            formSelect.innerHTML = '<option value="">-- Selecciona formulario --</option>';
            formDetails.innerHTML = '';
            generatePdfBtn.style.display = 'none';
            if (this.value && userFormsMap[this.value]) {
                formsSection.style.display = '';
                // Llenar select de formularios
                userFormsMap[this.value].forEach((f, index) => {
                    const opt = document.createElement('option');
                    opt.value = index; // Usar índice como valor
                    opt.textContent = `Año: ${f.year}, Mes: ${new Date(0, f.month).toLocaleString('es-ES', { month: 'long' })}`;
                    formSelect.appendChild(opt);
                });
            } else {
                formsSection.style.display = 'none';
            }
        });

        formSelect.addEventListener('change', async function() {
            formDetails.innerHTML = '';
            generatePdfBtn.style.display = 'none';
            if (this.value !== '') {
                const username = userSelect.value;
                const formIndex = parseInt(this.value);
                const selectedForm = userFormsMap[username][formIndex];
                const formData = selectedForm.formData;
                
                try {
                    // Obtener datos del usuario desde la API
                    const userResponse = await fetch(`/api/users/${username}`, {
                        headers: getAuthHeaders()
                    });
                    const userData = userResponse.ok ? await userResponse.json() : {};
                    
                    const year = formData.year;
                    const month = formData.month;
                // Mostrar detalles
                // Obtener nombre y dni del presidente según clubCode
                let presidenteHtml = '';
                try {
                    const clubsResponse = await fetch('http://localhost:3000/api/clubs');
                    if (clubsResponse.ok) {
                        const clubs = await clubsResponse.json();
                        const userClub = clubs.find(club => club.club_code === userData.clubCode);
                        if (userClub) {
                            if (userClub.nom_presidente) {
                                presidenteHtml += `<p><strong>Presidente:</strong> ${userClub.nom_presidente}</p>`;
                            }
                            if (userClub.dni_presidente) {
                                presidenteHtml += `<p><strong>DNI Presidente:</strong> ${userClub.dni_presidente}</p>`;
                            }
                        }
                    }
                } catch (error) {
                    presidenteHtml = '';
                }
                formDetails.innerHTML = `
                    <h3>Datos del Usuario</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 30px;">
                        <div style="flex:1; min-width:220px;">
                            <p><strong>Nombre de Usuario:</strong> ${userData.username || ''}</p>
                            <p><strong>Nombre Completo:</strong> ${userData.fullName || ''}</p>
                            <p><strong>Correo Electrónico:</strong> ${userData.email || ''}</p>
                        </div>
                        <div style="flex:1; min-width:220px;">
                            <p><strong>DNI:</strong> ${userData.dni || ''}</p>
                            <p><strong>Dirección:</strong> ${userData.address || ''}</p>
                            <p><strong>Kilómetros:</strong> ${userData.km || ''}</p>
                        </div>
                    </div>
                    <h3>Datos del Formulario</h3>
                    <table class="form-table">
                        <tr><th>Año</th><td>${year || ''}</td></tr>
                        <tr><th>Mes</th><td>${
                            (typeof month !== 'undefined' && month !== '') 
                                ? new Date(0, month).toLocaleString('es-ES', { month: 'long' }) 
                                : ''
                        }</td></tr>
                        <tr><th>Asistencia entrenamientos y partidos</th><td>${formData.trainingAttendance || ''}</td></tr>
                        <tr><th>Desplazamientos fuera del club</th><td>${formData.matches?.length || 0}</td></tr>
                        <tr><th>Detalles de partidos</th><td>
                            <ul style="text-align:left; margin:0; padding-left:18px;">
                                ${(formData.matches || []).map(match => `<li>Fecha: <b>${match.date}</b>, Localidad: <b>${match.locality}</b>, Equipo: <b>${match.place}</b>, Km: <b>${match.km}</b></li>`).join('')}
                            </ul>
                        </td></tr>
                        <tr><th>Gasto Transporte</th><td>${formData.transportExpenses?.length || 0}</td></tr>
                        <tr><th>Detalles Gasto Transporte</th><td>
                            <ul style="text-align:left; margin:0; padding-left:18px;">
                                ${(formData.transportExpenses || []).map(exp => `<li>Fecha: <b>${exp.date}</b>, Importe: <b>${exp.amount}</b></li>`).join('')}
                            </ul>
                        </td></tr>
                        <tr><th>Gasto en Dietas</th><td>${formData.dietExpenses?.length || 0}</td></tr>
                        <tr><th>Detalles Gasto en Dietas</th><td>
                            <ul style="text-align:left; margin:0; padding-left:18px;">
                                ${(formData.dietExpenses || []).map(exp => `<li>Fecha: <b>${exp.date}</b>, Importe: <b>${exp.amount}</b></li>`).join('')}
                            </ul>
                        </td></tr>
                        <tr><th>Semanas en el mes</th><td>${formData.weeksInMonth || ''}</td></tr>
                        <tr>
                            <th>Tickets</th>
                            <td>
                                ${formData.transportTicket ? `<a href="${formData.transportTicket}" target="_blank" style="color:#26a69a;">Ticket Transporte</a><br>` : ''}
                                ${formData.dietTicket ? `<a href="${formData.dietTicket}" target="_blank" style="color:#26a69a;">Ticket Dietas</a>` : 'No disponible'}
                            </td>
                        </tr>
                    </table>
                    <div id="presidente-details">${presidenteHtml}</div>
                `;
                generatePdfBtn.style.display = '';
                } catch (error) {
                    console.error('Error cargando datos:', error);
                    alert('Error al cargar los datos del formulario');
                }
            }
        });

        generatePdfBtn.addEventListener('click', async function() {
            const username = userSelect.value;
            const formIndex = parseInt(formSelect.value);
            if (!username || formSelect.value === '') return;
            
            try {
                const selectedForm = userFormsMap[username][formIndex];
                const formData = selectedForm.formData;
                
                // Obtener datos del usuario desde la API
                const userResponse = await fetch(`/api/users/${username}`, {
                    headers: getAuthHeaders()
                });
                const userData = userResponse.ok ? await userResponse.json() : {};

                const year = formData.year;
                const month = formData.month;

            // Obtener nombre del club personalizado desde la API
            let clubName = "Club no identificado";
            try {
                const clubsResponse = await fetch('http://localhost:3000/api/clubs');
                if (clubsResponse.ok) {
                    const clubs = await clubsResponse.json();
                    const userClub = clubs.find(club => club.club_code === userData.clubCode);
                    if (userClub) {
                        clubName = userClub.club_name;
                    } else if (userData.clubCode) {
                        clubName = userData.clubCode;
                    }
                }
            } catch (error) {
                console.error('Error al cargar el nombre del club:', error);
                if (userData.clubCode) {
                    clubName = userData.clubCode;
                }
            }
            const cif = userData.clubCode || '';

            // Preparar datos de desplazamientos
            const matches = (formData.matches || []);
            let totalKm = 0;
            const matchRows = matches.map(match => {
                const kmIdaVuelta = (parseFloat(match.km) || 0) * 2;
                totalKm += kmIdaVuelta;
                return [
                    match.date || '',
                    match.locality || '',
                    kmIdaVuelta.toFixed(2)
                ];
            });
            const importeKm = (totalKm * 0.26).toFixed(2);

            // Gasto por dietas
            const semanas = parseInt(formData.weeksInMonth) || 0;
            const importeDietas = (semanas * 15).toFixed(2);

            // Tabla de gastos de transporte
            const transportExpenses = (formData.transportExpenses || []);
            let totalGastoTransporte = 0;
            const transportRows = transportExpenses.map(exp => {
                const amount = parseFloat(exp.amount) || 0;
                totalGastoTransporte += amount;
                return [
                    exp.date || '',
                    amount.toFixed(2)
                ];
            });

            // Preparar datos de gastos en dietas
            const dietExpenses = (formData.dietExpenses || []);
            let totalGastoDietas = 0;
            const dietRows = dietExpenses.map(exp => {
                const amount = parseFloat(exp.amount) || 0;
                totalGastoDietas += amount;
                return [
                    exp.date || '',
                    amount.toFixed(2)
                ];
            });

            // Cálculo de recorrido y gasto en recorrido
            const kmClub = parseFloat(userData.km) || 0;
            const asistencia = parseInt(formData.trainingAttendance) || 0;
            const recorrido = kmClub * 2 * asistencia;
            const gastoRecorrido = (recorrido * 0.26).toFixed(2);

            // Calcular total de gastos
            const totalGastos = (
                parseFloat(importeKm) +
                parseFloat(gastoRecorrido) +
                parseFloat(totalGastoTransporte) +
                parseFloat(importeDietas) +
                parseFloat(totalGastoDietas)
            ).toFixed(2);

            // Generar PDF tipo contrato con estilo visual mejorado
            const { jsPDF } = window.jspdf;
            // --- Ajuste dinámico de fuente para que todo quepa en una hoja ---
            const PAGE_HEIGHT = 297; // A4 vertical mm
            const PAGE_WIDTH = 210;
            let minFontSize = 7;
            let maxFontSize = 14;
            let fontSize = maxFontSize;
            let fits = false;
            let doc, y;

            // Función para estimar el alto total del contenido
            function estimateContentHeight(fontSize) {
                let baseY = 15;
                let y = baseY;
                y += 8; // título
                y += 7; // club
                y += 10; // cif
                y += 38; // datos solicitante
                y += 15; // resumen recorridos
                y += 10; // resumen recorridos info
                // Tabla de desplazamientos
                let matchRowsCount = matchRows.length + 3; // filas + totales
                y += 7 + matchRowsCount * 7 * (fontSize / 10) + 3;
                // Tabla de transporte
                if (transportRows.length > 0) {
                    y += 7 + (transportRows.length + 1) * 7 * (fontSize / 10) + 10;
                } else {
                    y += 5;
                }
                // Tabla de dietas
                if (dietRows.length > 0) {
                    y += 7 + (dietRows.length + 1) * 7 * (fontSize / 10);
                }
                // Bloque de dietas sin justificación, siempre visible
                y += 13;
                y += 10; // total gastos
                y += 20; // firmas
                y += 10; // nombre/dni
                y += 12; // fecha
                return y;
            }

            // Buscar el tamaño de fuente adecuado
            while (!fits && fontSize >= minFontSize) {
                let estimatedHeight = estimateContentHeight(fontSize);
                if (estimatedHeight < PAGE_HEIGHT - 10) {
                    fits = true;
                } else {
                    fontSize--;
                }
            }

            // Generar PDF con el tamaño de fuente calculado
            doc = new jsPDF();
            y = 15;
            // Colores y estilos
            const colorHeader = "#004d40";
            const colorTableHeader = "#e0f7fa";
            const colorTableRow = "#f9f9f9";
            const colorTableTotal = "#b2dfdb";
            const colorClub = "#388e3c";
            const colorBox = "#e3f2fd";

            // Título principal
            doc.setFontSize(fontSize);
            doc.setTextColor(colorHeader);
            doc.setFont("helvetica", "bold");
            doc.text('LIQUIDACIÓN DE GASTOS DE CARACTER INDIVIDUAL POR DESPLAZAMIENTOS', 105, y, { align: 'center' });
            y += 8 * (fontSize / 14);

            // Nombre del club
            doc.setFontSize(fontSize - 1);
            doc.setTextColor(colorClub);
            doc.setFont("helvetica", "bold");
            doc.text(clubName, 105, y, { align: 'center' });
            y += 7 * (fontSize / 13);

            // CIF
            doc.setFontSize(Math.max(fontSize - 3, minFontSize));
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");
            doc.text(`CIF: ${cif}`, 105, y, { align: 'center' });
            y += 10 * (fontSize / 11);

            // Datos del solicitante en caja
            doc.setFillColor(227, 242, 253); // colorBox
            doc.roundedRect(8, y - 2, 194, 36 * (fontSize / 11), 3, 3, 'F');
            doc.setFontSize(Math.max(fontSize - 3, minFontSize));
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "normal");
            doc.text(`Nombre: ${userData.fullName || ''}`, 12, y + 4 * (fontSize / 11));
            doc.text(`DNI: ${userData.dni || ''}`, 100, y + 4 * (fontSize / 11));
            doc.text(`Dirección: ${userData.address || ''}`, 12, y + 11 * (fontSize / 11));
            doc.text(`Correo electrónico: ${userData.email || ''}`, 100, y + 11 * (fontSize / 11));
            doc.text(`Kilómetros hasta el club: ${userData.km || ''}`, 12, y + 18 * (fontSize / 11));
            doc.text(`Año: ${year !== undefined ? year : ''}`, 100, y + 18 * (fontSize / 11));
            doc.text(`Mes: ${month !== undefined && month !== '' ? new Date(0, month).toLocaleString('es-ES', { month: 'long' }) : ''}`, 12, y + 25 * (fontSize / 11));
            y += 38 * (fontSize / 11);

            // Resumen de Recorridos en caja
            doc.setFillColor(224, 247, 250); // colorTableHeader
            doc.roundedRect(8, y - 2, 194, 15 * (fontSize / 11), 2, 2, 'F');
            doc.setFontSize(Math.max(fontSize - 3, minFontSize));
            doc.setTextColor(44, 62, 80);
            doc.text('Resumen de Recorridos:', 12, y + 3 * (fontSize / 11));
            doc.setFontSize(10);
            doc.text(`Km hasta el club: ${kmClub}`, 12, y + 9);
            doc.text(`Asistencia a entrenamientos y partidos: ${asistencia}`, 70, y + 9);
            doc.text(`Recorrido: ${recorrido.toFixed(2)} km`, 140, y + 9);
            y += 15;
            doc.setFontSize(10);
            doc.setTextColor(33, 150, 243);
            doc.text(`Total gasto en recorrido: ${gastoRecorrido} €`, 140, y + 3);
            y += 10;

            // Tabla de Desplazamientos (mejor visualización)
            doc.setFontSize(12);
            doc.setTextColor(colorHeader);
            doc.setFont("helvetica", "bold");
            doc.text('Tabla de Desplazamientos', 10, y); y += 7;

            // Encabezados tabla
            const tableColumnHeaders = ["Fecha", "Localidad", "Km (ida y vuelta)"];
            const tableRows = matchRows.slice();
            tableRows.push([
                "TOTAL",
                "",
                totalKm.toFixed(2)
            ]);
            tableRows.push([
                "",
                "Importe por km",
                "0,26"
            ]);
            tableRows.push([
                "",
                "Importe total (€)",
                importeKm
            ]);

            // Ajuste de columnas para mejor visualización
            let tableStartY = y;
            let colX = [10, 70, 150]; // Más espacio para localidad y km
            doc.setFontSize(10);
            doc.setTextColor(0, 77, 64);
            doc.setFillColor(224, 247, 250);
            // Encabezados
            doc.rect(colX[0] - 2, tableStartY - 5, 55, 8, 'F');
            doc.rect(colX[1] - 2, tableStartY - 5, 75, 8, 'F');
            doc.rect(colX[2] - 2, tableStartY - 5, 40, 8, 'F');
            tableColumnHeaders.forEach((header, i) => {
                doc.text(header, colX[i], tableStartY);
            });
            let rowY = tableStartY + 6;
            tableRows.forEach((row, idx) => {
                // Alternar color de fondo
                if (idx === tableRows.length - 3) {
                    doc.setFillColor(178, 223, 219); // colorTableTotal
                } else if (idx % 2 === 0) {
                    doc.setFillColor(249, 249, 249);
                } else {
                    doc.setFillColor(224, 247, 250);
                }
                // Celdas
                doc.rect(colX[0] - 2, rowY - 4, 55, 7, 'F');
                doc.rect(colX[1] - 2, rowY - 4, 75, 7, 'F');
                doc.rect(colX[2] - 2, rowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text(String(row[0]), colX[0], rowY, { maxWidth: 50 });
                doc.text(String(row[1]), colX[1], rowY, { maxWidth: 70 });
                doc.text(String(row[2]), colX[2], rowY, { maxWidth: 35 });
                rowY += 7;
                if (rowY > 270) { doc.addPage(); rowY = 15; }
            });
            y = rowY + 3;


            // Tabla de gastos de transporte (mejor visualización)
            if (transportRows.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(colorHeader);
                doc.setFont("helvetica", "bold");
                doc.text('Tabla de Gastos de Transporte', 10, y); y += 7;
                // Añadir columna Concepto
                const transportHeaders = ["Fecha", "Concepto", "Importe (€)"];
                doc.setFontSize(10);
                doc.setTextColor(0, 77, 64);
                doc.setFillColor(224, 247, 250);
                // Encabezados
                doc.rect(10 - 2, y - 5, 40, 8, 'F');
                doc.rect(55 - 2, y - 5, 60, 8, 'F');
                doc.rect(120 - 2, y - 5, 40, 8, 'F');
                doc.text(transportHeaders[0], 10, y);
                doc.text(transportHeaders[1], 55, y);
                doc.text(transportHeaders[2], 120, y);
                let tRowY = y + 6;
                (formData.transportExpenses || []).forEach((exp, idx) => {
                    if (idx % 2 === 0) {
                        doc.setFillColor(249, 249, 249);
                    } else {
                        doc.setFillColor(224, 247, 250);
                    }
                    doc.rect(10 - 2, tRowY - 4, 40, 7, 'F');
                    doc.rect(55 - 2, tRowY - 4, 60, 7, 'F');
                    doc.rect(120 - 2, tRowY - 4, 40, 7, 'F');
                    doc.setTextColor(44, 62, 80);
                    doc.text(String(exp.date || ''), 10, tRowY, { maxWidth: 35 });
                    doc.text(String(exp.concept || ''), 55, tRowY, { maxWidth: 55 });
                    doc.text(String((parseFloat(exp.amount) || 0).toFixed(2)), 120, tRowY, { maxWidth: 35 });
                    tRowY += 7;
                    if (tRowY > 270) { doc.addPage(); tRowY = 15; }
                });
                // Fila total gasto transporte
                doc.setFillColor(178, 223, 219);
                doc.rect(10 - 2, tRowY - 4, 110, 7, 'F');
                doc.rect(120 - 2, tRowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text("TOTAL GASTO TRANSPORTE", 10, tRowY);
                doc.text(totalGastoTransporte.toFixed(2), 120, tRowY);
                y = tRowY + 10;
            } else {
                y += 5;
            }

            // Tabla de gastos en dietas (igual visual que transporte)
            if (dietRows.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(colorHeader);
                doc.setFont("helvetica", "bold");
                doc.text('Tabla de gastos: dietas y material deportivo con justificación', 10, y); y += 7;
                // Añadir columna Concepto
                const dietHeaders = ["Fecha", "Concepto", "Importe (€)"];
                doc.setFontSize(10);
                doc.setTextColor(0, 77, 64);
                doc.setFillColor(224, 247, 250);
                // Encabezados
                doc.rect(10 - 2, y - 5, 40, 8, 'F');
                doc.rect(55 - 2, y - 5, 60, 8, 'F');
                doc.rect(120 - 2, y - 5, 40, 8, 'F');
                doc.text(dietHeaders[0], 10, y);
                doc.text(dietHeaders[1], 55, y);
                doc.text(dietHeaders[2], 120, y);
                let dRowY = y + 6;
                (formData.dietExpenses || []).forEach((exp, idx) => {
                    if (idx % 2 === 0) {
                        doc.setFillColor(249, 249, 249);
                    } else {
                        doc.setFillColor(224, 247, 250);
                    }
                    doc.rect(10 - 2, dRowY - 4, 40, 7, 'F');
                    doc.rect(55 - 2, dRowY - 4, 60, 7, 'F');
                    doc.rect(120 - 2, dRowY - 4, 40, 7, 'F');
                    doc.setTextColor(44, 62, 80);
                    doc.text(String(exp.date || ''), 10, dRowY, { maxWidth: 35 });
                    doc.text(String(exp.concept || ''), 55, dRowY, { maxWidth: 55 });
                    doc.text(String((parseFloat(exp.amount) || 0).toFixed(2)), 120, dRowY, { maxWidth: 35 });
                    dRowY += 7;
                    if (dRowY > 270) { doc.addPage(); dRowY = 15; }
                });
                // Fila total gasto dietas
                doc.setFillColor(178, 223, 219);
                doc.rect(10 - 2, dRowY - 4, 110, 7, 'F');
                doc.rect(120 - 2, dRowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text("TOTAL GASTO DIETAS", 10, dRowY);
                doc.text(totalGastoDietas.toFixed(2), 120, dRowY);
                y = dRowY + 10;
            } else {
                y += 5;
            }

            // Añadir gasto por dietas (sin justificación) siempre, aunque no haya gastos con justificación
            doc.setFillColor(232, 245, 233);
            doc.roundedRect(8, y - 2, 194, 9, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(56, 142, 60);
            doc.text(`Gasto por dietas (sin justificación): ${semanas} semanas x 15€ = ${importeDietas} €`, 12, y + 5);
            y += 13;

            // Eliminar los textos debajo de la tabla de gasto en dietas:
            // doc.setFontSize(11);
            // doc.setTextColor(44, 62, 80);
            // doc.text(`Asistencia entrenamientos y partidos: ${formData.trainingAttendance || ''}`, 10, y); y += 7;
            // doc.text(`Gastos en dietas: ${formData.dietExpenses?.length || 0}`, 10, y); y += 7;
            // doc.text(`Semanas en el mes: ${formData.weeksInMonth || ''}`, 10, y); y += 10;

            // Total de gastos antes de la firma
            doc.setFontSize(13);
            doc.setTextColor(233, 30, 99);
            doc.setFont("helvetica", "bold");
            doc.text(`TOTAL DE GASTOS: ${totalGastos} €`, 10, y); y += 10;

            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "normal");
            doc.text('Firma del presidente:',10,y); 
            doc.text('Firma del solicitante:', 150, y); y +=20;

            doc.text('________________________',10,y);
            doc.text('________________________',150,y);

            // Añadir nombre completo y DNI del usuario debajo de la firma del solicitante, más juntos

            y += 10;
            const nombreDniOffset = -2;
            let fechaY = y + nombreDniOffset + 6;
            if (userData && userData.fullName) {
                doc.text(userData.fullName, 150, y + nombreDniOffset);
                fechaY = y + nombreDniOffset + 6;
            }
            if (userData && userData.dni) {
                doc.text(userData.dni, 150, y + nombreDniOffset + 6);
                fechaY = y + nombreDniOffset + 12;
            }

            // Mostrar la fecha justo debajo del DNI del solicitante
            doc.text('Fecha: ' + new Date().toLocaleDateString(), 190, fechaY, { align: 'right' });

            // Obtener datos del presidente desde la vista (ya renderizados en presidente-details)
            let nombrePresidente = '';
            let dniPresidente = '';
            const presidenteDiv = document.getElementById('presidente-details');
            if (presidenteDiv) {
                const html = presidenteDiv.innerHTML;
                const matchNombre = html.match(/Presidente:<\/strong> ([^<]+)/);
                const matchDni = html.match(/DNI Presidente:<\/strong> ([^<]+)/);
                if (matchNombre) nombrePresidente = matchNombre[1];
                if (matchDni) dniPresidente = matchDni[1];
            }

            // Mostrar nombre y DNI del presidente justo debajo de la línea de firma del presidente
            let yPresidente = y - 2; // y está justo después de la línea de firma
            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            if (nombrePresidente) {
                doc.text(`${nombrePresidente}`, 10, yPresidente);
                yPresidente += 6;
            }
            if (dniPresidente) {
                doc.text(`${dniPresidente}`, 10, yPresidente);
                yPresidente += 6;
            }

            doc.save(`hoja_${username}_${year}_${month}.pdf`);
            } catch (error) {
                console.error('Error generando PDF:', error);
                alert('Error al generar el PDF');
            }
        });
        
        // Cargar formularios al iniciar
        cargarFormularios();

        // --- Funcionalidad de generación masiva de PDFs ---
        const filterUserSelect = document.getElementById('filter-user');
        const filterYearSelect = document.getElementById('filter-year');
        const filterMonthSelect = document.getElementById('filter-month');
        const generateBatchPdfBtn = document.getElementById('generate-batch-pdf-btn');
        const batchStatus = document.getElementById('batch-status');

        // Poblar filtros cuando se carguen los formularios
        async function poblarFiltros() {
            try {
                const response = await fetch('/api/formularios', {
                    headers: getAuthHeaders()
                });
                const formularios = await response.json();
                
                const clubForms = formularios.filter(f => f.clubCode === getSessionClubCode());
                
                // Obtener usuarios únicos
                const users = new Set();
                const years = new Set();
                
                clubForms.forEach(form => {
                    users.add(form.username);
                    years.add(form.year);
                });
                
                // Poblar select de usuarios
                filterUserSelect.innerHTML = '<option value="all">Todos</option>';
                Array.from(users).sort().forEach(user => {
                    const option = document.createElement('option');
                    option.value = user;
                    option.textContent = user;
                    filterUserSelect.appendChild(option);
                });
                
                // Poblar select de años
                filterYearSelect.innerHTML = '<option value="all">Todos</option>';
                Array.from(years).sort().forEach(year => {
                    const option = document.createElement('option');
                    option.value = year;
                    option.textContent = year;
                    filterYearSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Error poblando filtros:', error);
            }
        }

        // Función auxiliar para generar un PDF individual
        async function generarPDFIndividual(formData, userData) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            const year = formData.year;
            const month = formData.month;
            const username = formData.username;

            // Obtener nombre del club personalizado desde la API
            let clubName = "Club no identificado";
            try {
                const clubsResponse = await fetch('http://localhost:3000/api/clubs');
                if (clubsResponse.ok) {
                    const clubs = await clubsResponse.json();
                    const userClub = clubs.find(club => club.club_code === userData.clubCode);
                    if (userClub) {
                        clubName = userClub.club_name;
                    } else if (userData.clubCode) {
                        clubName = userData.clubCode;
                    }
                }
            } catch (error) {
                console.error('Error al cargar el nombre del club:', error);
                if (userData.clubCode) {
                    clubName = userData.clubCode;
                }
            }
            const cif = userData.clubCode || '';

            // Preparar datos de desplazamientos
            const matches = (formData.matches || []);
            let totalKm = 0;
            const matchRows = matches.map(match => {
                const kmIdaVuelta = (parseFloat(match.km) || 0) * 2;
                totalKm += kmIdaVuelta;
                return [
                    match.date || '',
                    match.locality || '',
                    kmIdaVuelta.toFixed(2)
                ];
            });
            const importeKm = (totalKm * 0.26).toFixed(2);

            // Gasto por dietas
            const semanas = parseInt(formData.weeksInMonth) || 0;
            const importeDietas = (semanas * 15).toFixed(2);

            // Tabla de gastos de transporte
            const transportExpenses = (formData.transportExpenses || []);
            let totalGastoTransporte = 0;
            const transportRows = transportExpenses.map(exp => {
                const amount = parseFloat(exp.amount) || 0;
                totalGastoTransporte += amount;
                return [
                    exp.date || '',
                    amount.toFixed(2)
                ];
            });

            // Preparar datos de gastos en dietas
            const dietExpenses = (formData.dietExpenses || []);
            let totalGastoDietas = 0;
            const dietRows = dietExpenses.map(exp => {
                const amount = parseFloat(exp.amount) || 0;
                totalGastoDietas += amount;
                return [
                    exp.date || '',
                    amount.toFixed(2)
                ];
            });

            // Cálculo de recorrido y gasto en recorrido
            const kmClub = parseFloat(userData.km) || 0;
            const asistencia = parseInt(formData.trainingAttendance) || 0;
            const recorrido = kmClub * 2 * asistencia;
            const gastoRecorrido = (recorrido * 0.26).toFixed(2);

            // Calcular total de gastos
            const totalGastos = (
                parseFloat(importeKm) +
                parseFloat(gastoRecorrido) +
                parseFloat(totalGastoTransporte) +
                parseFloat(importeDietas) +
                parseFloat(totalGastoDietas)
            ).toFixed(2);

            // Generar PDF tipo contrato con estilo visual mejorado (FORMATO ORIGINAL)
            const colorHeader = "#004d40";
            const colorTableHeader = "#e0f7fa";
            const colorTableRow = "#f9f9f9";
            const colorTableTotal = "#b2dfdb";
            const colorClub = "#388e3c";
            const colorBox = "#e3f2fd";

            let y = 15;
            // Título principal
            doc.setFontSize(14);
            doc.setTextColor(colorHeader);
            doc.setFont("helvetica", "bold");
            doc.text('LIQUIDACIÓN DE GASTOS DE CARACTER INDIVIDUAL POR DESPLAZAMIENTOS', 105, y, { align: 'center' });
            y += 8;

            // Nombre del club
            doc.setFontSize(13);
            doc.setTextColor(colorClub);
            doc.setFont("helvetica", "bold");
            doc.text(clubName, 105, y, { align: 'center' });
            y += 7;

            // CIF
            doc.setFontSize(11);
            doc.setTextColor(60, 60, 60);
            doc.setFont("helvetica", "normal");
            doc.text(`CIF: ${cif}`, 105, y, { align: 'center' });
            y += 10;

            // Datos del solicitante en caja
            doc.setFillColor(227, 242, 253);
            doc.roundedRect(8, y - 2, 194, 36, 3, 3, 'F');
            doc.setFontSize(11);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "normal");
            doc.text(`Nombre: ${userData.fullName || ''}`, 12, y + 4);
            doc.text(`DNI: ${userData.dni || ''}`, 100, y + 4);
            doc.text(`Dirección: ${userData.address || ''}`, 12, y + 11);
            doc.text(`Correo electrónico: ${userData.email || ''}`, 100, y + 11);
            doc.text(`Kilómetros hasta el club: ${userData.km || ''}`, 12, y + 18);
            doc.text(`Año: ${year !== undefined ? year : ''}`, 100, y + 18);
            doc.text(`Mes: ${month !== undefined && month !== '' ? new Date(0, month).toLocaleString('es-ES', { month: 'long' }) : ''}`, 12, y + 25);
            y += 38;

            // Resumen de Recorridos en caja
            doc.setFillColor(224, 247, 250);
            doc.roundedRect(8, y - 2, 194, 15, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(44, 62, 80);
            doc.text('Resumen de Recorridos:', 12, y + 3);
            doc.setFontSize(10);
            doc.text(`Km hasta el club: ${kmClub}`, 12, y + 9);
            doc.text(`Asistencia a entrenamientos y partidos: ${asistencia}`, 70, y + 9);
            doc.text(`Recorrido: ${recorrido.toFixed(2)} km`, 140, y + 9);
            y += 15;
            doc.setFontSize(10);
            doc.setTextColor(33, 150, 243);
            doc.text(`Total gasto en recorrido: ${gastoRecorrido} €`, 140, y + 3);
            y += 10;

            // Tabla de Desplazamientos
            doc.setFontSize(12);
            doc.setTextColor(colorHeader);
            doc.setFont("helvetica", "bold");
            doc.text('Tabla de Desplazamientos', 10, y); y += 7;

            // Encabezados tabla
            const tableColumnHeaders = ["Fecha", "Localidad", "Km (ida y vuelta)"];
            const tableRows = matchRows.slice();
            tableRows.push([
                "TOTAL",
                "",
                totalKm.toFixed(2)
            ]);
            tableRows.push([
                "",
                "Importe por km",
                "0,26"
            ]);
            tableRows.push([
                "",
                "Importe total (€)",
                importeKm
            ]);

            let tableStartY = y;
            let colX = [10, 70, 150];
            doc.setFontSize(10);
            doc.setTextColor(0, 77, 64);
            doc.setFillColor(224, 247, 250);
            doc.rect(colX[0] - 2, tableStartY - 5, 55, 8, 'F');
            doc.rect(colX[1] - 2, tableStartY - 5, 75, 8, 'F');
            doc.rect(colX[2] - 2, tableStartY - 5, 40, 8, 'F');
            tableColumnHeaders.forEach((header, i) => {
                doc.text(header, colX[i], tableStartY);
            });
            let rowY = tableStartY + 6;
            tableRows.forEach((row, idx) => {
                if (idx === tableRows.length - 3) {
                    doc.setFillColor(178, 223, 219);
                } else if (idx % 2 === 0) {
                    doc.setFillColor(249, 249, 249);
                } else {
                    doc.setFillColor(224, 247, 250);
                }
                doc.rect(colX[0] - 2, rowY - 4, 55, 7, 'F');
                doc.rect(colX[1] - 2, rowY - 4, 75, 7, 'F');
                doc.rect(colX[2] - 2, rowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text(String(row[0]), colX[0], rowY, { maxWidth: 50 });
                doc.text(String(row[1]), colX[1], rowY, { maxWidth: 70 });
                doc.text(String(row[2]), colX[2], rowY, { maxWidth: 35 });
                rowY += 7;
                if (rowY > 270) { doc.addPage(); rowY = 15; }
            });
            y = rowY + 3;

            // Gasto por dietas en caja
            doc.setFillColor(232, 245, 233);
            doc.roundedRect(8, y - 2, 194, 9, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(56, 142, 60);
            doc.text(`Gasto por dietas (sin justificación): ${semanas} semanas x 15€ = ${importeDietas} €`, 12, y + 5);
            y += 13;

            // Tabla de gastos de transporte
            if (transportRows.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(colorHeader);
                doc.setFont("helvetica", "bold");
                doc.text('Tabla de Gastos de Transporte', 10, y); y += 7;
                const transportHeaders = ["Fecha", "Concepto", "Importe (€)"];
                doc.setFontSize(10);
                doc.setTextColor(0, 77, 64);
                doc.setFillColor(224, 247, 250);
                doc.rect(10 - 2, y - 5, 40, 8, 'F');
                doc.rect(55 - 2, y - 5, 60, 8, 'F');
                doc.rect(120 - 2, y - 5, 40, 8, 'F');
                doc.text(transportHeaders[0], 10, y);
                doc.text(transportHeaders[1], 55, y);
                doc.text(transportHeaders[2], 120, y);
                let tRowY = y + 6;
                (formData.transportExpenses || []).forEach((exp, idx) => {
                    if (idx % 2 === 0) {
                        doc.setFillColor(249, 249, 249);
                    } else {
                        doc.setFillColor(224, 247, 250);
                    }
                    doc.rect(10 - 2, tRowY - 4, 40, 7, 'F');
                    doc.rect(55 - 2, tRowY - 4, 60, 7, 'F');
                    doc.rect(120 - 2, tRowY - 4, 40, 7, 'F');
                    doc.setTextColor(44, 62, 80);
                    doc.text(String(exp.date || ''), 10, tRowY, { maxWidth: 35 });
                    doc.text(String(exp.concept || ''), 55, tRowY, { maxWidth: 55 });
                    doc.text(String((parseFloat(exp.amount) || 0).toFixed(2)), 120, tRowY, { maxWidth: 35 });
                    tRowY += 7;
                    if (tRowY > 270) { doc.addPage(); tRowY = 15; }
                });
                doc.setFillColor(178, 223, 219);
                doc.rect(10 - 2, tRowY - 4, 110, 7, 'F');
                doc.rect(120 - 2, tRowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text("TOTAL GASTO TRANSPORTE", 10, tRowY);
                doc.text(totalGastoTransporte.toFixed(2), 120, tRowY);
                y = tRowY + 10;
            } else {
                y += 5;
            }

            // Tabla de gastos en dietas
            if (dietRows.length > 0) {
                doc.setFontSize(12);
                doc.setTextColor(colorHeader);
                doc.setFont("helvetica", "bold");
                doc.text('Tabla de Gastos en Dietas', 10, y); y += 7;
                const dietHeaders = ["Fecha", "Concepto", "Importe (€)"];
                doc.setFontSize(10);
                doc.setTextColor(0, 77, 64);
                doc.setFillColor(224, 247, 250);
                doc.rect(10 - 2, y - 5, 40, 8, 'F');
                doc.rect(55 - 2, y - 5, 60, 8, 'F');
                doc.rect(120 - 2, y - 5, 40, 8, 'F');
                doc.text(dietHeaders[0], 10, y);
                doc.text(dietHeaders[1], 55, y);
                doc.text(dietHeaders[2], 120, y);
                let dRowY = y + 6;
                (formData.dietExpenses || []).forEach((exp, idx) => {
                    if (idx % 2 === 0) {
                        doc.setFillColor(249, 249, 249);
                    } else {
                        doc.setFillColor(224, 247, 250);
                    }
                    doc.rect(10 - 2, dRowY - 4, 40, 7, 'F');
                    doc.rect(55 - 2, dRowY - 4, 60, 7, 'F');
                    doc.rect(120 - 2, dRowY - 4, 40, 7, 'F');
                    doc.setTextColor(44, 62, 80);
                    doc.text(String(exp.date || ''), 10, dRowY, { maxWidth: 35 });
                    doc.text(String(exp.concept || ''), 55, dRowY, { maxWidth: 55 });
                    doc.text(String((parseFloat(exp.amount) || 0).toFixed(2)), 120, dRowY, { maxWidth: 35 });
                    dRowY += 7;
                    if (dRowY > 270) { doc.addPage(); dRowY = 15; }
                });
                doc.setFillColor(178, 223, 219);
                doc.rect(10 - 2, dRowY - 4, 110, 7, 'F');
                doc.rect(120 - 2, dRowY - 4, 40, 7, 'F');
                doc.setTextColor(44, 62, 80);
                doc.text("TOTAL GASTO DIETAS", 10, dRowY);
                doc.text(totalGastoDietas.toFixed(2), 120, dRowY);
                y = dRowY + 10;
            } else {
                y += 5;
            }

            // Total de gastos antes de la firma
            doc.setFontSize(13);
            doc.setTextColor(233, 30, 99);
            doc.setFont("helvetica", "bold");
            doc.text(`TOTAL DE GASTOS: ${totalGastos} €`, 10, y); y += 20;

            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "normal");
            doc.text('Firma del presidente:',10,y); 
            doc.text('Firma del solicitante:', 150, y); y += 12;
            doc.text('________________________',10,y - 10);
            doc.text('________________________',150,y - 10);
            y += 6;
            doc.text('Fecha: ' + new Date().toLocaleDateString(), 170, y);

            return doc;
        }

        // Generar PDFs en lote
        generateBatchPdfBtn.addEventListener('click', async function() {
            const selectedUser = filterUserSelect.value;
            const selectedYear = filterYearSelect.value;
            const selectedMonth = filterMonthSelect.value;

            batchStatus.textContent = 'Generando PDFs...';
            batchStatus.className = 'batch-status info';

            try {
                const response = await fetch('/api/formularios', {
                    headers: getAuthHeaders()
                });
                const formularios = await response.json();
                
                // Filtrar formularios según selección
                let filteredForms = formularios.filter(f => f.clubCode === getSessionClubCode());
                
                if (selectedUser !== 'all') {
                    filteredForms = filteredForms.filter(f => f.username === selectedUser);
                }
                if (selectedYear !== 'all') {
                    filteredForms = filteredForms.filter(f => f.year.toString() === selectedYear);
                }
                if (selectedMonth !== 'all') {
                    filteredForms = filteredForms.filter(f => f.month.toString() === selectedMonth);
                }

                if (filteredForms.length === 0) {
                    batchStatus.textContent = 'No se encontraron formularios con los filtros seleccionados.';
                    batchStatus.className = 'batch-status error';
                    return;
                }

                // Generar PDFs uno por uno
                let count = 0;
                for (const formData of filteredForms) {
                    try {
                        // Obtener datos del usuario
                        const userResponse = await fetch(`/api/users/${formData.username}`, {
                            headers: getAuthHeaders()
                        });
                        const userData = userResponse.ok ? await userResponse.json() : {};
                        
                        // Generar PDF
                        const doc = await generarPDFIndividual(formData, userData);
                        doc.save(`hoja_${formData.username}_${formData.year}_${formData.month}.pdf`);
                        
                        count++;
                        batchStatus.textContent = `Generando PDFs... ${count}/${filteredForms.length}`;
                        
                        // Pequeña pausa para permitir la descarga
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error('Error generando PDF para:', formData.username, error);
                    }
                }

                batchStatus.textContent = `✓ Se generaron ${count} PDFs correctamente.`;
                batchStatus.className = 'batch-status success';
            } catch (error) {
                console.error('Error en generación masiva:', error);
                batchStatus.textContent = 'Error al generar los PDFs.';
                batchStatus.className = 'batch-status error';
            }
        });

        // Poblar filtros al cargar la página
        poblarFiltros();
