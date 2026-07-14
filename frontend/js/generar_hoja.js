const params = new URLSearchParams(window.location.search);
        const formKey = params.get('formKey');
        const username = params.get('nombre');
        const userData = JSON.parse(localStorage.getItem(username));

        const welcomeMessageElement = document.getElementById('welcome-message');
        
        // Función para cargar el nombre del club desde la API
        async function loadClubName() {
            if (!userData) {
                welcomeMessageElement.textContent = "Usuario no identificado.";
                return;
            }

            try {
                const response = await fetch('http://localhost:3000/api/clubs');
                if (!response.ok) throw new Error('Error al cargar clubes');
                
                const clubs = await response.json();
                const userClub = clubs.find(club => club.club_code === userData.clubCode);
                
                if (userClub) {
                    welcomeMessageElement.textContent = userClub.club_name;
                } else {
                    welcomeMessageElement.textContent = username || "Club";
                }
            } catch (error) {
                console.error('Error al cargar el nombre del club:', error);
                welcomeMessageElement.textContent = username || "Club";
            }
        }

        // Cargar el nombre del club
        loadClubName();

        // Mostrar datos del formulario y usuario
        if (formKey) {
            const formData = JSON.parse(localStorage.getItem(formKey));
            if (formData && userData) {
                const sheet = document.getElementById('sheet-container');
                // Obtener la fecha actual en formato dd/mm/yyyy
                const today = new Date();
                const fechaActual = today.toLocaleDateString('es-ES');
                // Obtener año y mes de la clave si no están en formData
                let year = formData.year;
                let month = formData.month;
                if (typeof year === "undefined" || typeof month === "undefined") {
                    const parts = formKey.split('_');
                    year = parts[2] || '';
                    month = parts[3] || '';
                }
                sheet.innerHTML = `
                    <div class="welcome-message" id="welcome-message">${welcomeMessageElement.textContent}</div>
                    <h3>Datos del Usuario</h3>
                    <p><strong>Nombre de Usuario:</strong> ${userData.username || ''}</p>
                    <p><strong>Nombre Completo:</strong> ${userData.fullName || ''}</p>
                    <p><strong>Correo Electrónico:</strong> ${userData.email || ''}</p>
                    <p><strong>DNI:</strong> ${userData.dni || ''}</p>
                    <p><strong>Dirección:</strong> ${userData.address || ''}</p>
                    <p><strong>Kilómetros:</strong> ${userData.km || ''}</p>
                    <h3>Datos del Formulario (${formKey})</h3>
                    <p><strong>Año:</strong> ${year || ''}</p>
                    <p><strong>Mes:</strong> ${typeof month !== 'undefined' && month !== '' ? new Date(0, month).toLocaleString('es-ES', { month: 'long' }) : ''}</p>
                    <p><strong>Asistencia entrenamientos y partidos:</strong> ${formData.trainingAttendance || ''}</p>
                    <p><strong>Desplazamientos fuera del club:</strong> ${formData.matches?.length || 0}</p>
                    <ul>
                        ${(formData.matches || []).map(match => `<li>Fecha: ${match.date}, Localidad: ${match.locality}, Equipo: ${match.place}, Km: ${match.km}</li>`).join('')}
                    </ul>
                    <p><strong>Gastos Transporte:</strong> ${formData.transportExpenses?.length || 0}</p>
                    <ul>
                        ${(formData.transportExpenses || []).map(exp => `<li>Fecha: ${exp.date}, Importe: ${exp.amount}</li>`).join('')}
                    </ul>
                    <p><strong>Gastos en Dietas:</strong> ${formData.dietExpenses?.length || 0}</p>
                    <ul>
                        ${(formData.dietExpenses || []).map(exp => `<li>Fecha: ${exp.date}, Importe: ${exp.amount}</li>`).join('')}
                    </ul>
                    <p><strong>Semanas en el mes:</strong> ${formData.weeksInMonth || ''}</p>
                    <p><strong>Tickets:</strong><br>
                        ${formData.transportTicket ? `<a href="${formData.transportTicket}" target="_blank">Ticket Transporte</a><br>` : ''}
                        ${formData.dietTicket ? `<a href="${formData.dietTicket}" target="_blank">Ticket Dietas</a>` : 'No disponible'}
                    </p>
                    <div class="signatures-row">
                        <div class="signature-block right">
                            <span class="signature-label">Firma del Presidente</span>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature-block">
                            <span class="signature-label">Firma del Solicitante</span>
                            <div class="signature-line"></div>
                            <div class="signature-date">Fecha: ${fechaActual}</div>
                        </div>
                    </div>
                `;
            }
        }

        console.log('Formulario seleccionado:', formKey);