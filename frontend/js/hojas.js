 function goBack() {
            const params = new URLSearchParams(window.location.search);
            const username = params.get('nombre');
            window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
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
        const sessionClubCode = sessionUserData.clubCode;

        // Map: username -> array de { key, year, month }
        const userFormsMap = {};

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('formData_')) {
                const [_, username, year, month] = key.split('_');
                // Solo incluir usuarios que compartan el mismo código de club
                const userData = JSON.parse(localStorage.getItem(username));
                if (userData && userData.clubCode === sessionClubCode) {
                    if (!userFormsMap[username]) userFormsMap[username] = [];
                    userFormsMap[username].push({ key, year, month });
                }
            }
        }

        // Llenar select de usuarios (solo los del mismo club)
        Object.keys(userFormsMap).forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            userSelect.appendChild(option);
        });

        userSelect.addEventListener('change', function() {
            formSelect.innerHTML = '<option value="">-- Selecciona formulario --</option>';
            formDetails.innerHTML = '';
            generatePdfBtn.style.display = 'none';
            if (this.value && userFormsMap[this.value]) {
                formsSection.style.display = '';
                // Llenar select de formularios
                userFormsMap[this.value].forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.key;
                    opt.textContent = `Año: ${f.year}, Mes: ${new Date(0, f.month).toLocaleString('es-ES', { month: 'long' })}`;
                    formSelect.appendChild(opt);
                });
            } else {
                formsSection.style.display = 'none';
            }
        });

        formSelect.addEventListener('change', function() {
            formDetails.innerHTML = '';
            generatePdfBtn.style.display = 'none';
            if (this.value) {
                const formData = JSON.parse(localStorage.getItem(this.value));
                const username = userSelect.value;
                const userData = JSON.parse(localStorage.getItem(username)) || {};
                // Obtener año y mes de formData o de la clave
                let year = formData.year;
                let month = formData.month;
                if (typeof year === "undefined" || typeof month === "undefined" || year === "" || month === "") {
                    const parts = this.value.split('_');
                    year = parts[2] || '';
                    month = parts[3] || '';
                }
                // Mostrar detalles
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
                `;
                generatePdfBtn.style.display = '';
            }
        });

        generatePdfBtn.addEventListener('click', function() {
            const username = userSelect.value;
            const formKey = formSelect.value;
            if (!username || !formKey) return;
            const formData = JSON.parse(localStorage.getItem(formKey));
            const userData = JSON.parse(localStorage.getItem(username)) || {};

            // Obtener año y mes de formData o de la clave
            let year = formData.year;
            let month = formData.month;
            if (typeof year === "undefined" || typeof month === "undefined" || year === "" || month === "") {
                const parts = formKey.split('_');
                year = parts[2] || '';
                month = parts[3] || '';
            }

            // Obtener nombre del club personalizado (como en interfaz_personalizada)
            let clubName = "";
            if (userData.clubCode === '1337') {
                clubName = "TAVERNES BLANQUES C.F.";
            } else if (userData.clubCode === '1234') {
                clubName = "ALBORAYA UD.";
            } else if (userData.clubCode === '2828') {
                clubName = "TORRENT C.F.";
            } else if (userData.clubCode === '2024') {
                clubName = "TBCFFORMA";
            } else if (userData.clubCode === '82801') {
                clubName = "tuGestClub";
            } else if (userData.clubCode) {
                clubName = `Bienvenido, ${username}!`;
            } else {
                clubName = "Club no identificado";
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
            const doc = new jsPDF();

            // Colores y estilos
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
            doc.setFillColor(227, 242, 253); // colorBox
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
            doc.setFillColor(224, 247, 250); // colorTableHeader
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

            // Gasto por dietas en caja
            doc.setFillColor(232, 245, 233);
            doc.roundedRect(8, y - 2, 194, 9, 2, 2, 'F');
            doc.setFontSize(11);
            doc.setTextColor(56, 142, 60);
            doc.text(`Gasto por dietas: ${semanas} semanas x 15€ = ${importeDietas} €`, 12, y + 5);
            y += 13;

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
                doc.text('Tabla de Gastos en Dietas', 10, y); y += 7;
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
            doc.text(`TOTAL DE GASTOS: ${totalGastos} €`, 10, y); y += 20;

            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.setFont("helvetica", "normal");
            doc.text('Firma del presidente:',10,y); 
            doc.text('Firma del solicitante:', 150, y); y +=20;
            doc.text('________________________',10,y);
            doc.text('________________________',150,y); y+=20;
            doc.text('Fecha: ' + new Date().toLocaleDateString(), 170, y);

            doc.save(`hoja_${username}_${year}_${month}.pdf`);
        });