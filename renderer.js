// El script que se ejecuta en la "página web" de Electron
// Ya que tenemos nodeIntegration: true en main.js, podemos usar funciones de Node desde aquí si hiciera falta.
// Pero vamos a usar JavaScript estándar del navegador para los relojes.

// Obtener zona horaria del sistema de forma nativa
const systemTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Inicializar desde localStorage si existe, o usar predeterminadas
let zones = JSON.parse(localStorage.getItem('savedZones'));

if (!zones) {
    zones = [
      { id: "📍 Mi Hora Local", tz: systemTz },
      { id: "América / New York", tz: "America/New_York" },
      { id: "Europa / Madrid", tz: "Europe/Madrid" }
    ];
} else {
    // Si viene de una versión anterior y no tiene un reloj que diga "Hora Local", se lo inyectamos al tope
    if (!zones.some(z => z.id.includes("Hora Local"))) {
        zones.unshift({ id: "📍 Mi Hora Local", tz: systemTz });
        localStorage.setItem('savedZones', JSON.stringify(zones));
    }
}

function saveZones() {
    localStorage.setItem('savedZones', JSON.stringify(zones));
}

const clockList = document.getElementById('clock-list');

// --- DRAG & DROP REORDERING ---
let dragSrcIndex = null;

// Crear las "Tarjetas" para cada reloj en el HTML
function renderClocks() {
  clockList.innerHTML = '';
  zones.forEach((zone, index) => {
    const card = document.createElement('div');
    card.className = 'clock-card';
    card.draggable = true;
    card.dataset.index = index;

    // Asa de arrastre (izquierda)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Arrastrar para reordenar';
    dragHandle.innerHTML = '⠿'; // Ícono de puntos

    // Contenedor del nombre
    const nameDiv = document.createElement('div');
    nameDiv.className = 'zone-name';
    nameDiv.textContent = zone.id;

    // Controles para cada reloj
    const infoDiv = document.createElement('div');
    infoDiv.className = 'zone-info';

    // Contenedor de la hora
    const timeDiv = document.createElement('div');
    timeDiv.className = 'zone-time';
    timeDiv.id = `time-${zone.tz.replace(/\//g, '-')}`;
    timeDiv.textContent = "--:--:--";

    // Botón borrar
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.title = "Eliminar reloj";
    deleteBtn.onclick = () => removeZone(zone.tz);

    infoDiv.appendChild(timeDiv);
    infoDiv.appendChild(deleteBtn);

    card.appendChild(dragHandle);
    card.appendChild(nameDiv);
    card.appendChild(infoDiv);
    clockList.appendChild(card);

    // Eventos drag & drop
    card.addEventListener('dragstart', (e) => {
      dragSrcIndex = index;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.clock-card').forEach(c => c.classList.remove('drag-over'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.clock-card').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragSrcIndex === null || dragSrcIndex === index) return;

      // Reordenar el arreglo
      const moved = zones.splice(dragSrcIndex, 1)[0];
      zones.splice(index, 0, moved);
      dragSrcIndex = null;

      saveZones();
      renderClocks();
      updateTime();
    });
  });
}

const tzFormatters = new Map();

function getFormatter(tz) {
    if (!tzFormatters.has(tz)) {
        tzFormatters.set(tz, new Intl.DateTimeFormat([], { 
            timeZone: tz, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false
        }));
    }
    return tzFormatters.get(tz);
}

// Función principal para actualizar la hora de cada zona
function updateTime() {
  const now = new Date(); // Un solo objeto Date para todos
  zones.forEach(zone => {
    const formatter = getFormatter(zone.tz);
    const dateString = formatter.format(now);
    
    const timeElement = document.getElementById(`time-${zone.tz.replace(/\//g, '-')}`);
    if (timeElement) {
        timeElement.textContent = dateString;
    }
  });
}

// Interacciones con la barra superior (Cerrar / Siempre Arriba)
function setupControls() {
    const closeBtn = document.getElementById('closeBtn');
    const pinBtn = document.getElementById('pinBtn');
    
    // Al presionar cerrar, simplemente cerramos la ventana web (Electron atrapará esto)
    closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

    // Pin logic usando IPC
    pinBtn.addEventListener('click', async () => {
        // Llamamos a la función segura que creamos en preload.js
        const isPinnedAhora = await window.electronAPI.togglePin();
        
        if (isPinnedAhora) {
            pinBtn.classList.add('active');
            pinBtn.title = "Dejar de fijar ventana";
        } else {
            pinBtn.classList.remove('active');
            pinBtn.title = "Siempre visible";
        }
    });
}

// Obtener dinámicamente +400 zonas del motor V8 (Chromium/Node)
const allTzStrings = Intl.supportedValuesOf('timeZone');

// Algoritmo para limpiar el nombre crudo para el usuario (Ej: America/Argentina/Buenos_Aires)
function formatTzLabel(tz) {
    let label = tz.replace(/_/g, ' '); 
    let parts = label.split('/');
    
    if (parts.length > 1) {
        let region = parts[0]; 
        let city = parts[parts.length - 1]; 
        
        // Si hay subtipo dentro de continente (ej. país intermedio)
        let middle = parts.length > 2 ? parts[1] : '';

        if (middle) {
             return `${region} / ${city} (${middle})`;
        } else {
             // Traducimos ligeramente algunas regiones para dar mejor UX
             if (region === 'America') region = 'América';
             if (region === 'Europe') region = 'Europa';
             if (region === 'Africa') region = 'África';
             if (region === 'Antarctica') region = 'Antártida';
             if (region === 'Atlantic') region = 'Atlántico';
             if (region === 'Indian') region = 'Índico';
             if (region === 'Pacific') region = 'Pacífico';

             return `${region} / ${city}`;
        }
    }
    return label;
}

// Array maestro dinámico
const availableTimezones = allTzStrings.map(tz => ({
    tz: tz,
    label: formatTzLabel(tz)
}));

// Inyectamos como primer elemento del buscador la Hora Local del sistema
availableTimezones.unshift({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    label: "📍 Mi Hora Local (Automática)"
});

// Lógica para agregar nuevas y quitar zonas
function removeZone(tzToRemove) {
    zones = zones.filter(z => z.tz !== tzToRemove);
    saveZones();
    renderClocks();
    updateTime();
    if(typeof populateCalculatorDropdowns === 'function') populateCalculatorDropdowns();
}

function setupAddZone() {
    const searchInput = document.getElementById('zoneSearch');
    const searchResults = document.getElementById('searchResults');

    const showResults = (query) => {
        searchResults.innerHTML = '';
        if (query === null || query === undefined) {
            searchResults.classList.add('hidden');
            return;
        }

        const lowerQuery = query.toLowerCase().trim();
        // Mostrar todo si es un espacio, o filtrar
        const filtered = lowerQuery === '' ? availableTimezones : availableTimezones.filter(z => 
            z.label.toLowerCase().includes(lowerQuery) || 
            z.tz.toLowerCase().includes(lowerQuery)
        );

        if (filtered.length === 0) {
            searchResults.innerHTML = '<div class="search-item" style="color:#aaa;">No se encontraron ciudades...</div>';
            searchResults.classList.remove('hidden');
            return;
        }

        filtered.forEach(z => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.textContent = z.label;
            
            div.addEventListener('click', () => {
                if (!zones.some(existing => existing.tz === z.tz)) {
                    zones.push({ id: z.label, tz: z.tz });
                    saveZones();
                    renderClocks();
                    updateTime();
                    if(typeof populateCalculatorDropdowns === 'function') populateCalculatorDropdowns();
                }
                searchInput.value = '';
                searchResults.classList.add('hidden');
            });
            
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    };

    searchInput.addEventListener('input', (e) => {
        showResults(e.target.value);
    });

    // Ocultar al hacer clic fuera de la búsqueda
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });
    
    // Mostrar todo al hacer clic en el input vacío
    searchInput.addEventListener('focus', () => {
        showResults(searchInput.value);
    });
}

// --- POMODORO LOGIC ---
let pomodoroInterval = null;
let timeRemaining = 25 * 60; // En segundos
let isPomodoroRunning = false;

// Presets de temporizadores
let savedTimers = JSON.parse(localStorage.getItem('savedTimers')) || [
    { id: Date.now().toString(), name: "Saludos a clientes", mins: 15 }
];

function saveTimers() {
    localStorage.setItem('savedTimers', JSON.stringify(savedTimers));
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function playAlarmSound() {
    // Alarma usando Web Audio API estándar sin archivos externos
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine'; // Sonido suave
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
}

function setupPomodoro() {
    const display = document.getElementById('pomodoro-display');
    const input = document.getElementById('pomodoro-input');
    const startBtn = document.getElementById('pomodoro-start');
    const resetBtn = document.getElementById('pomodoro-reset');
    
    // --- LÓGICA DE PRESETS (TEMPORIZADORES PERSONALIZADOS) ---
    const presetsList = document.getElementById('presets-list');
    const presetNameInput = document.getElementById('preset-name');
    const presetTimeInput = document.getElementById('preset-time');
    const addPresetBtn = document.getElementById('add-preset-btn');

    const renderPresets = () => {
        presetsList.innerHTML = '';
        savedTimers.forEach(timer => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            
            // Boton de play rápido
            const playBtn = document.createElement('button');
            playBtn.className = 'preset-play-btn';
            playBtn.title = "Iniciar este temporizador";
            playBtn.innerHTML = '▶';
            playBtn.onclick = () => {
                // Seleccionar e iniciar enseguida
                input.value = timer.mins;
                
                // Si ya está corriendo uno, lo limpiamos
                if (isPomodoroRunning) {
                    clearInterval(pomodoroInterval);
                    isPomodoroRunning = false;
                }
                
                timeRemaining = timer.mins * 60;
                display.textContent = formatTime(timeRemaining);
                
                // Disparamos iniciar automáticamente
                startBtn.click();
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'preset-info';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'preset-name';
            nameDiv.textContent = timer.name;
            nameDiv.title = timer.name; // Por si se corta
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'preset-duration';
            timeDiv.textContent = `${timer.mins} min`;

            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(timeDiv);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'preset-delete-btn';
            deleteBtn.title = 'Eliminar preset';
            deleteBtn.innerHTML = '🗑';
            deleteBtn.onclick = () => {
                savedTimers = savedTimers.filter(t => t.id !== timer.id);
                saveTimers();
                renderPresets();
            };

            card.appendChild(playBtn);
            card.appendChild(infoDiv);
            card.appendChild(deleteBtn);

            presetsList.appendChild(card);
        });
    };

    addPresetBtn.addEventListener('click', () => {
        const name = presetNameInput.value.trim();
        const mins = parseInt(presetTimeInput.value);

        if (name && mins && mins > 0) {
            savedTimers.push({
                id: Date.now().toString(),
                name: name,
                mins: mins
            });
            saveTimers();
            renderPresets();
            
            // Limpiar inputs
            presetNameInput.value = '';
            presetTimeInput.value = '';
        }
    });

    // Render original
    renderPresets();

    // --- FIN LÓGICA DE PRESETS ---

    // Función para manejar el tick del reloj
    const tick = () => {
        if (timeRemaining > 0) {
            timeRemaining--;
            display.textContent = formatTime(timeRemaining);
        } else {
            // Tiempo terminado!
            clearInterval(pomodoroInterval);
            isPomodoroRunning = false;
            startBtn.innerHTML = '▶ Iniciar';
            startBtn.classList.remove('running');
            
            // Destello visual y sonido
            document.body.classList.add('alert-mode');
            playAlarmSound();
            
            // Quitar la alerta después de 5 segundos
            setTimeout(() => {
                document.body.classList.remove('alert-mode');
            }, 5000);
        }
    };

    startBtn.addEventListener('click', () => {
        // Pausar
        if (isPomodoroRunning) {
            clearInterval(pomodoroInterval);
            isPomodoroRunning = false;
            startBtn.innerHTML = '▶ Continuar';
            startBtn.classList.remove('running');
        } 
        // Iniciar
        else {
            // Si el texto es 0, usamos el valor del input
            if (timeRemaining <= 0) {
                const mins = parseInt(input.value) || 25;
                timeRemaining = mins * 60;
            }
            display.textContent = formatTime(timeRemaining);
            
            pomodoroInterval = setInterval(tick, 1000);
            isPomodoroRunning = true;
            startBtn.innerHTML = '⏸ Pausar';
            startBtn.classList.add('running');
            document.body.classList.remove('alert-mode'); // si había quedado destellando
        }
    });

    resetBtn.addEventListener('click', () => {
        clearInterval(pomodoroInterval);
        isPomodoroRunning = false;
        startBtn.innerHTML = '▶ Iniciar';
        startBtn.classList.remove('running');
        document.body.classList.remove('alert-mode');
        
        const mins = parseInt(input.value) || 25;
        timeRemaining = mins * 60;
        display.textContent = formatTime(timeRemaining);
    });

    // Validar input y actualizar display al escribir
    input.addEventListener('change', () => {
        if (!isPomodoroRunning) {
            const mins = parseInt(input.value) || 25;
            timeRemaining = mins * 60;
            display.textContent = formatTime(timeRemaining);
        }
    });
}

function setupResizeHandle() {
    const handle = document.getElementById('resizeHandle');
    if (!handle) return;

    let isResizing = false;
    let startY = 0;
    let initialHeight = 0;
    let isWaitingForSize = false;

    handle.addEventListener('mousedown', async (e) => {
        e.preventDefault();
        isWaitingForSize = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ns-resize';
        
        // Pedimos a Electron el alto inicial de la ventana
        const size = await window.electronAPI.getWindowSize();
        initialHeight = size[1];
        startY = e.screenY;
        isWaitingForSize = false;
        isResizing = true;
    });

    let updatePending = false;
    document.addEventListener('mousemove', (e) => {
        if (!isResizing || isWaitingForSize || updatePending) return;

        // Calculamos el delta desde donde se hizo click
        const deltaY = e.screenY - startY;
        const newHeight = initialHeight + deltaY;

        // requestAnimationFrame para evitar saturar el bus IPC de Electron
        updatePending = true;
        requestAnimationFrame(() => {
            window.electronAPI.resizeWindow(400, newHeight);
            updatePending = false;
        });
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing && !isWaitingForSize) return;
        isResizing = false;
        isWaitingForSize = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    });
}

// --- CALCULATOR AND TABS LOGIC ---
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function getTzOffsetMinutes(timeZone, date) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    }).formatToParts(date);
    
    const obj = {};
    for (let {type, value} of parts) obj[type] = parseInt(value, 10);
    
    // Convert to Unix Time representing the "wall clock" time in UTC
    const wallClockUTC = Date.UTC(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute, obj.second);
    const actualUTC = date.getTime();
    
    return Math.round((wallClockUTC - actualUTC) / 60000);
}

function populateCalculatorDropdowns() {
    const sourceSelect = document.getElementById('calc-source-tz');
    const destSelect = document.getElementById('calc-dest-tz');
    
    if(!sourceSelect || !destSelect) return;

    const currentSource = sourceSelect.value;
    const currentDest = destSelect.value;

    sourceSelect.innerHTML = '';
    destSelect.innerHTML = '';

    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Hora Local
    const localOption = document.createElement('option');
    localOption.value = localTz;
    localOption.textContent = "📍 Hora Local";
    sourceSelect.appendChild(localOption.cloneNode(true));
    destSelect.appendChild(localOption.cloneNode(true));

    zones.forEach(z => {
        if (z.tz === localTz) return;
        const opt = document.createElement('option');
        opt.value = z.tz;
        opt.textContent = z.id;
        sourceSelect.appendChild(opt.cloneNode(true));
        destSelect.appendChild(opt.cloneNode(true));
    });

    if (currentSource && Array.from(sourceSelect.options).some(o => o.value === currentSource)) {
        sourceSelect.value = currentSource;
    }
    if (currentDest && Array.from(destSelect.options).some(o => o.value === currentDest)) {
        destSelect.value = currentDest;
    }
}

function updateCalculator() {
    const sourceTz = document.getElementById('calc-source-tz').value;
    const destTz = document.getElementById('calc-dest-tz').value;
    const timeStr = document.getElementById('calc-source-time').value;
    const resultDiv = document.getElementById('calc-result-time');
    const diffDiv = document.getElementById('calc-diff-label');

    if (!timeStr || !sourceTz || !destTz) {
        resultDiv.textContent = '--:--';
        diffDiv.textContent = 'Diferencia: --';
        return;
    }

    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    
    // Extraemos de forma exacta los offsets usando nuestra función blindada DST
    const sourceOffsetMins = getTzOffsetMinutes(sourceTz, now);
    const destOffsetMins = getTzOffsetMinutes(destTz, now);

    // Diferencia neta entre los dos lugares en minutos
    const totalDiffMinutes = destOffsetMins - sourceOffsetMins;
    
    const diffHours = Math.floor(Math.abs(totalDiffMinutes) / 60);
    const diffMins = Math.abs(totalDiffMinutes) % 60;
    
    let sign = totalDiffMinutes >= 0 ? '+' : '-';
    let diffText = `Diferencia: ${sign}${diffHours}h`;
    if (diffMins > 0) diffText += ` ${diffMins}m`;
    if (totalDiffMinutes === 0) diffText = 'Diferencia: 0h (Misma hora)';
    
    diffDiv.textContent = diffText;

    // Calculamos la hora destino haciendo matemática abstracta de reloj
    // sin pasar por el Date() local para evitar los saltos de DST del sistema operativo.
    let destMinutes = minutes + totalDiffMinutes;
    let destHours = hours + Math.floor(destMinutes / 60);
    
    destMinutes = destMinutes % 60;
    if (destMinutes < 0) destMinutes += 60;

    let daysDiff = Math.floor(destHours / 24);
    destHours = destHours % 24;
    if (destHours < 0) destHours += 24;

    let dayIndicator = "";
    if (daysDiff > 0) dayIndicator = ` (+${daysDiff} día${daysDiff > 1 ? 's' : ''})`;
    if (daysDiff < 0) dayIndicator = ` (${daysDiff} día${daysDiff < -1 ? 's' : ''})`;

    const resHours = destHours.toString().padStart(2, '0');
    const resMins = destMinutes.toString().padStart(2, '0');
    
    resultDiv.innerHTML = `${resHours}:${resMins} <span style="font-size: 14px; opacity: 0.7;">${dayIndicator}</span>`;
}

function setupCalculator() {
    const sourceSelect = document.getElementById('calc-source-tz');
    const destSelect = document.getElementById('calc-dest-tz');
    const timeInput = document.getElementById('calc-source-time');
    const swapBtn = document.getElementById('calc-swap-btn');

    const nowLocal = new Date();
    timeInput.value = `${nowLocal.getHours().toString().padStart(2, '0')}:${nowLocal.getMinutes().toString().padStart(2, '0')}`;

    const onChange = () => updateCalculator();

    sourceSelect.addEventListener('change', onChange);
    destSelect.addEventListener('change', onChange);
    timeInput.addEventListener('input', onChange);

    swapBtn.addEventListener('click', () => {
        const temp = sourceSelect.value;
        sourceSelect.value = destSelect.value;
        destSelect.value = temp;
        updateCalculator();
    });

    populateCalculatorDropdowns();
    updateCalculator();
}

// Inicialización de la aplicación
setupTabs();
setupCalculator();
setupAddZone();
setupPomodoro();
renderClocks();
updateTime();
setInterval(updateTime, 1000); // Actualizar cada 1000ms (1 segundo)
setupControls();
setupResizeHandle();
