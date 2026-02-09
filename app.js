// Configuration
const CONFIG = {
    apiKey: localStorage.getItem('stormglass_api_key') || '',
    units: localStorage.getItem('units') || 'metric',
    darkMode: localStorage.getItem('darkMode') === 'true',
    locations: {
        nord: { name: 'Côte Nord Bretagne', lat: 48.7333, lng: -3.4667 },
        sud: { name: 'Côte Sud Bretagne', lat: 47.4833, lng: -2.4833 },
        morlaix: { name: 'Baie de Morlaix', lat: 48.6833, lng: -3.8333 },
        brest: { name: 'Rade de Brest', lat: 48.3833, lng: -4.4833 },
        quiberon: { name: 'Presqu\'île de Quiberon', lat: 47.4833, lng: -3.1167 },
        finistere: { name: 'Pointe du Finistère', lat: 48.3833, lng: -4.7667 }
    }
};

// État
let state = {
    currentLocation: 'nord',
    weatherData: null,
    forecastData: null,
    isOnline: navigator.onLine,
    deferredPrompt: null
};

// Initialisation
function init() {
    // Mode sombre
    if (CONFIG.darkMode) document.body.classList.add('dark-mode');
    
    // Événements
    setupEvents();
    
    // Charger données
    loadWeatherData();
    
    // Vérifier connexion
    updateConnectionStatus();
    
    // Install PWA
    setupPWA();
    
    console.log('Application initialisée');
}

// Événements
function setupEvents() {
    // Réseau
    window.addEventListener('online', () => {
        state.isOnline = true;
        updateConnectionStatus();
        loadWeatherData();
    });
    
    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateConnectionStatus();
        loadCachedData();
    });
    
    // Rafraîchissement auto
    setInterval(loadWeatherData, 10 * 60 * 1000);
}

// PWA
function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        setTimeout(showInstallPrompt, 5000);
    });
    
    document.getElementById('installButton')?.addEventListener('click', installPWA);
    document.getElementById('closeInstall')?.addEventListener('click', hideInstallPrompt);
}

// Données météo
async function loadWeatherData() {
    if (!CONFIG.apiKey) {
        showApiWarning();
        return;
    }
    
    if (!state.isOnline) {
        loadCachedData();
        return;
    }
    
    showLoading();
    
    try {
        const location = CONFIG.locations[state.currentLocation];
        
        // Données actuelles
        const weather = await fetchWeather(location.lat, location.lng);
        state.weatherData = weather;
        
        // Prévisions
        const forecast = await fetchForecast(location.lat, location.lng);
        state.forecastData = forecast;
        
        // Mettre à jour l'interface
        updateUI();
        
        // Mettre en cache
        cacheData();
        
    } catch (error) {
        console.error('Erreur:', error);
        showError('Impossible de charger les données');
        loadCachedData();
    }
}

async function fetchWeather(lat, lng) {
    const params = new URLSearchParams({
        lat, lng,
        params: 'airTemperature,waterTemperature,windSpeed,windDirection,waveHeight,pressure,visibility',
        source: 'sg'
    });
    
    const response = await fetch(`https://api.stormglass.io/v2/weather/point?${params}`, {
        headers: { 'Authorization': CONFIG.apiKey }
    });
    
    if (!response.ok) throw new Error(`API: ${response.status}`);
    return await response.json();
}

async function fetchForecast(lat, lng) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const params = new URLSearchParams({
        lat, lng,
        params: 'airTemperature,windSpeed,waveHeight',
        start: now.toISOString(),
        end: tomorrow.toISOString(),
        source: 'sg'
    });
    
    const response = await fetch(`https://api.stormglass.io/v2/weather/point?${params}`, {
        headers: { 'Authorization': CONFIG.apiKey }
    });
    
    if (!response.ok) throw new Error(`API: ${response.status}`);
    return await response.json();
}

// UI Updates
function updateUI() {
    updateCurrentWeather();
    updateForecast();
    updateWarnings();
    updateLastUpdate();
}

function updateCurrentWeather() {
    if (!state.weatherData) return;
    
    const data = state.weatherData;
    const currentHour = new Date().getHours();
    const currentData = data.hours?.find(h => 
        new Date(h.time).getHours() === currentHour
    ) || data.hours?.[0] || {};
    
    // Location
    document.getElementById('locationName').textContent = 
        CONFIG.locations[state.currentLocation].name;
    
    // Température
    const airTemp = currentData.airTemperature?.sg;
    if (airTemp) {
        document.getElementById('currentTemp').textContent = `${Math.round(airTemp)}°C`;
    }
    
    // Mer
    const waterTemp = currentData.waterTemperature?.sg;
    if (waterTemp) {
        document.getElementById('seaTemp').textContent = `Mer: ${Math.round(waterTemp)}°C`;
    }
    
    // Conditions
    const windSpeed = currentData.windSpeed?.sg || 0;
    const conditions = getConditions(windSpeed);
    document.getElementById('conditions').textContent = conditions.text;
    document.getElementById('weatherIcon').innerHTML = `<i class="fas ${conditions.icon}"></i>`;
    
    // Détails
    if (windSpeed !== undefined) {
        const dir = currentData.windDirection?.sg;
        const dirText = dir ? ` ${getWindDirection(dir)}` : '';
        document.getElementById('windValue').textContent = `${Math.round(windSpeed)} nœuds${dirText}`;
    }
    
    const waveHeight = currentData.waveHeight?.sg;
    if (waveHeight) {
        document.getElementById('waveValue').textContent = `${waveHeight.toFixed(1)} m`;
    }
    
    const pressure = currentData.pressure?.sg;
    if (pressure) {
        document.getElementById('pressureValue').textContent = `${Math.round(pressure)} hPa`;
    }
    
    const visibility = currentData.visibility?.sg;
    if (visibility) {
        document.getElementById('visibilityValue').textContent = `${visibility.toFixed(1)} km`;
    }
}

function updateForecast() {
    if (!state.forecastData) return;
    
    const container = document.getElementById('forecastContainer');
    const hours = state.forecastData.hours || [];
    
    container.innerHTML = '';
    
    // 8 points (toutes les 3 heures)
    for (let i = 0; i < Math.min(8, hours.length); i += 3) {
        const hourData = hours[i];
        if (!hourData) continue;
        
        const time = new Date(hourData.time);
        const hour = time.getHours();
        const temp = hourData.airTemperature?.sg;
        const wind = hourData.windSpeed?.sg || 0;
        const waves = hourData.waveHeight?.sg;
        const conditions = getConditions(wind);
        
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-time">${hour}h</div>
            <div class="forecast-icon"><i class="fas ${conditions.icon}"></i></div>
            <div class="forecast-temp">${temp ? Math.round(temp) + '°C' : '--°C'}</div>
            <div class="forecast-details">
                <div><i class="fas fa-wind"></i> ${Math.round(wind)}</div>
                <div><i class="fas fa-water"></i> ${waves ? waves.toFixed(1) : '--'}</div>
            </div>
        `;
        
        container.appendChild(card);
    }
}

function updateWarnings() {
    if (!state.weatherData) return;
    
    const data = state.weatherData;
    const currentHour = new Date().getHours();
    const currentData = data.hours?.find(h => 
        new Date(h.time).getHours() === currentHour
    ) || data.hours?.[0] || {};
    
    const wind = currentData.windSpeed?.sg || 0;
    const waves = currentData.waveHeight?.sg || 0;
    
    const warning = document.getElementById('warningCard');
    const title = document.getElementById('warningTitle');
    const text = document.getElementById('warningText');
    
    if (wind > 30 || waves > 4) {
        warning.className = 'warning-card danger';
        title.textContent = 'DANGER';
        text.textContent = 'Conditions dangereuses. Navigation déconseillée.';
    } else if (wind > 20 || waves > 2.5) {
        warning.className = 'warning-card';
        title.textContent = 'ATTENTION';
        text.textContent = 'Mer agitée. Prudence recommandée.';
    } else if (wind > 10 || waves > 1.5) {
        warning.className = 'warning-card';
        title.textContent = 'AVIS';
        text.textContent = 'Conditions normales de navigation.';
    } else {
        warning.className = 'warning-card safe';
        title.textContent = 'FAVORABLE';
        text.textContent = 'Excellentes conditions.';
    }
}

// Utilitaires
function getConditions(windSpeed) {
    if (windSpeed < 3) return { text: 'Calme', icon: 'fa-sun' };
    if (windSpeed < 10) return { text: 'Léger vent', icon: 'fa-cloud-sun' };
    if (windSpeed < 20) return { text: 'Vent modéré', icon: 'fa-cloud' };
    if (windSpeed < 30) return { text: 'Vent fort', icon: 'fa-wind' };
    return { text: 'Tempête', icon: 'fa-poo-storm' };
}

function getWindDirection(degrees) {
    const directions = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
    return directions[Math.round((degrees % 360) / 22.5) % 16];
}

function updateConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    const offline = document.getElementById('offlineIndicator');
    
    if (state.isOnline) {
        status.innerHTML = '<i class="fas fa-circle"></i> En ligne';
        status.className = 'status online';
        offline?.classList.remove('show');
    } else {
        status.innerHTML = '<i class="fas fa-circle"></i> Hors ligne';
        status.className = 'status offline';
        offline?.classList.add('show');
    }
}

function updateLastUpdate() {
    const element = document.getElementById('lastUpdate');
    if (element) {
        const time = new Date().toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        element.textContent = `Mis à jour: ${time}`;
    }
}

// Cache
function cacheData() {
    const cache = {
        weather: state.weatherData,
        forecast: state.forecastData,
        location: state.currentLocation,
        timestamp: Date.now()
    };
    localStorage.setItem('weather_cache', JSON.stringify(cache));
}

function loadCachedData() {
    const cached = localStorage.getItem('weather_cache');
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (Date.now() - data.timestamp < 30 * 60 * 1000) {
                state.weatherData = data.weather;
                state.forecastData = data.forecast;
                updateUI();
                showWarning('Mode hors ligne', 'Données en cache');
            }
        } catch (e) {
            console.error('Cache error:', e);
        }
    }
}

// Interface
function showInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    if (prompt && state.deferredPrompt) {
        prompt.classList.add('show');
    }
}

function hideInstallPrompt() {
    const prompt = document.getElementById('installPrompt');
    if (prompt) prompt.classList.remove('show');
}

async function installPWA() {
    if (!state.deferredPrompt) return;
    
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('PWA installée');
        hideInstallPrompt();
    }
    
    state.deferredPrompt = null;
}

function toggleMenu() {
    const menu = document.getElementById('sideMenu');
    menu.classList.toggle('open');
}

function selectLocation(location) {
    if (CONFIG.locations[location]) {
        state.currentLocation = location;
        
        // Mettre à jour le menu
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');
        
        loadWeatherData();
    }
}

function refreshData() {
    const btn = event.target.closest('button');
    if (btn) {
        btn.classList.add('refreshing');
        setTimeout(() => btn.classList.remove('refreshing'), 1000);
    }
    loadWeatherData();
}

function openSettings() {
    document.getElementById('settingsModal').classList.add('show');
}

function showAbout() {
    document.getElementById('aboutModal').classList.add('show');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
}

function saveApiKey() {
    const input = document.getElementById('apiKeyInput');
    if (input && input.value) {
        CONFIG.apiKey = input.value;
        localStorage.setItem('stormglass_api_key', input.value);
        alert('Clé API sauvegardée !');
        loadWeatherData();
    }
}

function clearCache() {
    localStorage.removeItem('weather_cache');
    alert('Cache vidé !');
}

function showApiWarning() {
    document.getElementById('apiInfo').style.display = 'block';
    showWarning('Configuration requise', 'Veuillez configurer votre clé API');
}

function showWarning(title, text) {
    const card = document.getElementById('warningCard');
    const titleEl = document.getElementById('warningTitle');
    const textEl = document.getElementById('warningText');
    
    if (card && titleEl && textEl) {
        card.className = 'warning-card';
        titleEl.textContent = title;
        textEl.textContent = text;
    }
}

function showError(message) {
    showWarning('Erreur', message);
}

function showLoading() {
    // Animation de chargement
    const icon = document.getElementById('weatherIcon');
    if (icon) {
        icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
}

// Démarrer l'application
document.addEventListener('DOMContentLoaded', init);
