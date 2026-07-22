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

const params = new URLSearchParams(window.location.search);
const sessionUsername = params.get('nombre');
const sessionUserData = JSON.parse(localStorage.getItem(sessionUsername)) || {};
const sessionClubCode = sessionUserData.clubCode;

let gastosPorUsuario = {};

// Cargar datos desde la API
async function cargarGastos() {
    try {
        const response = await fetch('/api/formularios', {
            headers: getAuthHeaders()
        });
        const formularios = await response.json();
        
        gastosPorUsuario = {};
        
        // Procesar cada formulario
        for (const formData of formularios) {
            if (formData.clubCode === sessionClubCode) {
                const username = formData.username;
                
                // Obtener datos del usuario
                const userResponse = await fetch(`/api/users/${username}`, {
                    headers: getAuthHeaders()
                });
                const userData = userResponse.ok ? await userResponse.json() : {};
                
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
                    year: formData.year,
                    month: formData.month,
                    total: totalGastos.toFixed(2),
                    totalDesplazamientos: totalDesplazamientos.toFixed(2),
                    totalGastoDietas: totalGastoPorDietas.toFixed(2),
                    sumaTransporteDietas: sumaTransporteDietas.toFixed(2)
                });
            }
        }
        
        inicializarFiltros();
        renderTablaGastos();
    } catch (error) {
        console.error('Error cargando gastos:', error);
        alert('Error al cargar los gastos');
    }
}

// Filtros
const filtroUsuario = document.getElementById('filtro-usuario');
const filtroMes = document.getElementById('filtro-mes');
const filtroAnio = document.getElementById('filtro-anio');
const gastosTableDiv = document.getElementById('gastos-table');

function inicializarFiltros() {
    // Limpiar opciones existentes
    filtroUsuario.innerHTML = '<option value="">Todos los usuarios</option>';
    filtroAnio.innerHTML = '<option value="">Todos los años</option>';
    
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
}

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

// Función para exportar a Excel
function exportarAExcel() {
    const usuarioSel = filtroUsuario.value;
    const mesSel = filtroMes.value;
    const anioSel = filtroAnio.value;
    
    let datos = [];
    let totalSuma = 0;
    
    // Recopilar datos para exportar
    Object.entries(gastosPorUsuario).forEach(([username, forms]) => {
        if (usuarioSel && username !== usuarioSel) return;
        forms.forEach(form => {
            if (mesSel !== "" && String(form.month) !== mesSel) return;
            if (anioSel !== "" && String(form.year) !== anioSel) return;
            
            totalSuma += parseFloat(form.total);
            const nombreMes = typeof form.month !== 'undefined' ? 
                new Date(0, form.month).toLocaleString('es-ES', { month: 'long' }) : '';
            
            datos.push({
                'Usuario': username,
                'Año': form.year,
                'Mes': nombreMes,
                'Total Desplazamientos (€)': parseFloat(form.totalDesplazamientos),
                'Total Gasto Dietas (€)': parseFloat(form.totalGastoDietas),
                'Suma Transporte + Dietas (€)': parseFloat(form.sumaTransporteDietas),
                'Gasto Total (€)': parseFloat(form.total)
            });
        });
    });
    
    if (datos.length === 0) {
        alert('No hay datos para exportar con los filtros seleccionados.');
        return;
    }
    
    // Agregar fila de total
    datos.push({
        'Usuario': 'TOTAL',
        'Año': '',
        'Mes': '',
        'Total Desplazamientos (€)': '',
        'Total Gasto Dietas (€)': '',
        'Suma Transporte + Dietas (€)': '',
        'Gasto Total (€)': totalSuma.toFixed(2)
    });
    
    // Generar archivo Excel usando HTML/XLSX
    generarExcelHTML(datos);
}

// Función para generar Excel con estilos reales usando HTML (.xls)
function generarExcelHTML(datos) {
    try {
        const cabeceras = Object.keys(datos[0]);

        const escapeHTML = (valor) => String(valor ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const formatearNumero = (valor) => {
            const numero = Number(valor);
            if (Number.isNaN(numero)) return '';
            return numero.toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        const esColumnaImporte = (cabecera) => cabecera.includes('€');

        const thead = `<thead><tr>${cabeceras
            .map((cabecera) => `<th>${escapeHTML(cabecera)}</th>`)
            .join('')}</tr></thead>`;

        const tbody = `<tbody>${datos.map((fila) => {
            const esTotal = fila.Usuario === 'TOTAL';
            const celdas = cabeceras.map((cabecera, indice) => {
                const valor = fila[cabecera];
                const contenido = esColumnaImporte(cabecera) ? formatearNumero(valor) : escapeHTML(valor);

                if (esTotal && indice === 6) {
                    return `<td class="total-final">${contenido}</td>`;
                }
                if (esTotal && indice === 0) {
                    return `<td class="total-label">${escapeHTML(valor)}</td>`;
                }
                if (esTotal) {
                    return '<td class="total-empty"></td>';
                }
                return `<td>${contenido}</td>`;
            }).join('');

            return `<tr>${celdas}</tr>`;
        }).join('')}</tbody>`;

        const htmlExcel = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
    th, td { border: 1px solid #7f7f7f; padding: 8px 10px; white-space: nowrap; }
    th { background: #d9ead3; color: #000; font-weight: 700; text-align: center; }
    tbody td { background: #f2f2f2; }
    .total-label { background: #ffffff; font-weight: 700; }
    .total-empty { background: #ffffff; }
    .total-final { background: #ff0000; color: #ffffff; font-weight: 700; text-align: right; }
  </style>
</head>
<body>
  <table>
    ${thead}
    ${tbody}
  </table>
</body>
</html>`;

        const blob = new Blob(['\uFEFF' + htmlExcel], {
            type: 'application/vnd.ms-excel;charset=utf-8;'
        });

        const hoy = new Date();
        const nombreArchivo = `Gastos_${hoy.toISOString().slice(0,10)}.xls`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = nombreArchivo;
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generando Excel con estilos:', error);
        generarExcelCSV(datos);
    }
}

// Función para generar archivo CSV (compatible con Excel)
function generarExcelCSV(datos) {
    // Obtener cabeceras
    const cabeceras = Object.keys(datos[0]);
    
    // Crear contenido CSV con delimitador ; para mejor compatibilidad
    let csv = cabeceras.join(';') + '\n';
    
    datos.forEach(row => {
        const valores = cabeceras.map(cabecera => {
            let valor = row[cabecera] || '';
            // Convertir a string y escapar comillas
            valor = String(valor).replace(/"/g, '""');
            // Envolver en comillas si contiene separadores
            if (valor.includes(';') || valor.includes('\n') || valor.includes('"')) {
                valor = '"' + valor + '"';
            }
            return valor;
        });
        csv += valores.join(';') + '\n';
    });
    
    // Agregar BOM para UTF-8 (Excel reconoce caracteres especiales)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const hoy = new Date();
    const nombreArchivo = `Gastos_${hoy.toISOString().slice(0,10)}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Cargar datos al iniciar
cargarGastos();
