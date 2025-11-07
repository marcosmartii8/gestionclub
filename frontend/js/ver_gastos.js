function goBack() {
    const params = new URLSearchParams(window.location.search);
    const username = params.get('nombre');
    window.location.href = `interfaz_personalizada.html?nombre=${encodeURIComponent(username)}`;
}

const params = new URLSearchParams(window.location.search);
const sessionUsername = params.get('nombre');
const sessionUserData = JSON.parse(localStorage.getItem(sessionUsername)) || {};
const sessionClubCode = sessionUserData.clubCode;

const gastosPorUsuario = {};

// Recorrer localStorage y calcular gastos por usuario
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('formData_')) {
        const [_, username, year, month] = key.split('_');
        const userData = JSON.parse(localStorage.getItem(username));
        if (userData && userData.clubCode === sessionClubCode) {
            const formData = JSON.parse(localStorage.getItem(key));

            let totalKm = 0;
            (formData.matches || []).forEach(match => {
                totalKm += ((parseFloat(match.km) || 0) * 2);
            });
            const importeKm = totalKm * 0.26;
            const semanas = parseInt(formData.weeksInMonth) || 0;
            const importeDietas = semanas * 15;

            let totalGastoTransporte = 0;
            (formData.transportExpenses || []).forEach(exp => {
                totalGastoTransporte += parseFloat(exp.amount) || 0;
            });

            let totalGastoDietas = 0;
            (formData.dietExpenses || []).forEach(exp => {
                totalGastoDietas += parseFloat(exp.amount) || 0;
            });

            const kmClub = parseFloat(userData.km) || 0;
            const asistencia = parseInt(formData.trainingAttendance) || 0;
            const recorrido = kmClub * 2 * asistencia;
            const gastoRecorrido = recorrido * 0.26;

            const totalDesplazamientos = importeKm + gastoRecorrido;
            const totalGastos = importeKm + gastoRecorrido + totalGastoTransporte + importeDietas + totalGastoDietas;
            const totalGastoPorDietas = importeDietas + totalGastoDietas;
            const sumaTransporteDietas = totalGastoTransporte + totalGastoPorDietas;

            if (!gastosPorUsuario[username]) gastosPorUsuario[username] = [];
            gastosPorUsuario[username].push({
                year,
                month,
                total: totalGastos.toFixed(2),
                totalDesplazamientos: totalDesplazamientos.toFixed(2),
                totalGastoDietas: totalGastoPorDietas.toFixed(2),
                sumaTransporteDietas: sumaTransporteDietas.toFixed(2)
            });
        }
    }
}

// Filtros
const filtroUsuario = document.getElementById('filtro-usuario');
const filtroMes = document.getElementById('filtro-mes');
const filtroAnio = document.getElementById('filtro-anio');
const gastosTableDiv = document.getElementById('gastos-table');

// Llenar select de usuarios únicos
Object.keys(gastosPorUsuario).forEach(username => {
    const opt = document.createElement('option');
    opt.value = username;
    opt.textContent = username;
    filtroUsuario.appendChild(opt);
});

// Llenar select de años únicos
const aniosSet = new Set();
Object.values(gastosPorUsuario).forEach(formsArr => {
    formsArr.forEach(form => {
        if (form.year) aniosSet.add(form.year);
    });
});
Array.from(aniosSet).sort().forEach(anio => {
    const opt = document.createElement('option');
    opt.value = anio;
    opt.textContent = anio;
    filtroAnio.appendChild(opt);
});

function renderTablaGastos() {
    const usuarioSel = filtroUsuario.value;
    const mesSel = filtroMes.value;
    const anioSel = filtroAnio.value;
    let html = '';
    let totalSuma = 0;
    let hayDatos = false;

    html = '<table><thead><tr><th>Usuario</th><th>Año</th><th>Mes</th><th>Total Desplazamientos (€)</th><th>Total Gasto Dietas (€)</th><th>Suma Transporte + Dietas (€)</th><th>Gasto Total (€)</th></tr></thead><tbody>';
    
    Object.entries(gastosPorUsuario).forEach(([username, forms]) => {
        if (usuarioSel && username !== usuarioSel) return;
        forms.forEach(form => {
            if (mesSel !== "" && String(form.month) !== mesSel) return;
            if (anioSel !== "" && String(form.year) !== anioSel) return;
            hayDatos = true;
            totalSuma += parseFloat(form.total);
            html += `<tr>
                <td>${username}</td>
                <td>${form.year}</td>
                <td>${typeof form.month !== 'undefined' ? new Date(0, form.month).toLocaleString('es-ES', { month: 'long' }) : ''}</td>
                <td>${form.totalDesplazamientos}</td>
                <td>${form.totalGastoDietas}</td>
                <td>${form.sumaTransporteDietas}</td>
                <td>${form.total}</td>
            </tr>`;
        });
    });

    if (!hayDatos) {
        html += `<tr><td colspan="7" style="text-align:center;">No hay gastos registrados para este filtro.</td></tr>`;
    }

    html += `<tr style="font-weight:bold; background:#e0f2f1;">
                <td colspan="6" style="text-align:right;">TOTAL SUMA:</td>
                <td>${totalSuma.toFixed(2)}</td>
            </tr>`;
    html += '</tbody></table>';
    gastosTableDiv.innerHTML = html;
}

filtroUsuario.addEventListener('change', renderTablaGastos);
filtroMes.addEventListener('change', renderTablaGastos);
filtroAnio.addEventListener('change', renderTablaGastos);

// Render inicial
renderTablaGastos();
