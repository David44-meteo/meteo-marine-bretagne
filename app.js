// ============================================
// MÉTÉO MARINE BRETAGNE - API STORMGLASS
// ============================================

// 1. CONFIGURATION
const CONFIG = {
    apiKey: localStorage.getItem('stormglass_api_key') || '',
    units: localStorage.getItem('units') || 'metric',
    darkMode: localStorage.getItem('darkMode') === 'true',
    locations: {
        nord: { 
            name: 'Côte Nord Bretagne', 
            lat: 48.7333, 
            lng: -3.4667,
            desc: 'Perros-Guirec, Côtes-d\'Armor'
        },
        sud: { 
            name: 'Côte Sud Bretagne', 
            lat: 47.4833, 
            lng: -2.4833,
            desc: 'Golfe du Morbihan, Vannes'
        },
        morlaix: { 
            name: 'Baie de Morlaix', 
            lat: 48.6833, 
            lng: -3.8333,
            desc: 'Baie de Morlaix, Carantec'
        },
        brest: { 
            name: 'Rade de Brest', 
            lat: 48.3833, 
            lng: -4.4833,
            desc: 'Rade de Brest, Goulet'
        },
        quiberon: { 
            name: 'Presqu\'île de Quiberon', 
            lat: 47.4833, 
            lng: -3.1167,
            desc: 'Côte Sauvage, Quiberon'
        },
        finistere: { 
            name: 'Pointe du Finistère', 
            lat: 48.3833, 
            lng: -4.7667,
            desc: 'Mer d\'Iroise, Ouessant'
        }
    }
};

// 2. ÉTAT DE L'APPLICATION
let state = {
    currentLocation: 'nord',
    weatherData: null,
    forecastData: null,
    isOnline: navigator.onLine,
    deferredPrompt: null,
    lastUpdate: null
};

// 3. INITIALISATION
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application...');
    
    // Appliquer le mode sombre
    if (CONFIG.darkMode) document.body.classList.add('dark-mode');
    
    // Configurer les événements
    setupEvents();
    
    // Charger les données
    checkApiKeyAndLoad();
    
    // Mettre à jour l'heure
    updateTime();
    setInterval(updateTime, 60000);
    
    // Configurer PWA
    setupPWA();
});

// 4. GESTION DES ÉVÉNEMENTS
function setupEvents() {
    // Connexion réseau
    window.addEventListener('online', () => {
        state.isOnline = true;
        updateConnectionStatus();
        checkApiKeyAndLoad();
    });
    
    window.addEventListener('offline', () => {
        state.isOnline = false;
        updateConnectionStatus();
        loadCachedData();
    });
    
    // Rafraîchissement automatique (10 minutes)
    setInterval(() => {
        if (state.isOnline && CONFIG.apiKey) {
            loadWeatherData();
        }
    }, 10 * 60 * 1000);
}

// 5. VÉRIFICATION API
function checkApiKeyAndLoad() {
    const apiInfo = document.getElementById('apiInfo');
    
    if (!CONFIG.apiKey) {
        if (apiInfo) apiInfo.style.display = 'flex';
        showWarning('⚠️ Configuration requise', 'Veuillez configurer votre clé API Stormglass');
        loadDemoData(); // Données de démonstration
    } else {
        if (apiInfo) apiInfo.style.display = 'none';
        loadWeatherData();
    }
}

// 6. CHARGEMENT DES DONNÉES STORMGLASS
async function loadWeatherData() {
    if (!CONFIG.apiKey) {
        loadDemoData();
        return;
    }
    
    if (!state.isOnline) {
        loadCachedData();
        return;
    }
    
    showLoading(true);
    
    try {
        const location = CONFIG.locations[state.currentLocation];
        
        // Appel simultané aux 2 endpoints
        const [weather, forecast] = await Promise.all([
            fetchCurrentWeather(location.lat, location.lng),
            fetchForecast(location.lat, location.lng)
        ]);
        
        state.weatherData = weather;
        state.forecastData = forecast;
        state.lastUpdate = new Date();
        
        // Mise à jour de l'interface
        updateCurrentWeather();
        updateForecast();
        updateWarnings();
        updateLastUpdateTime();
        
        // Sauvegarde en cache
        cacheData();
        
        console.log('✅ Données mises à jour:', new Date().toLocaleTimeString());
        
    } catch (error) {
        console.error('❌ Erreur API:', error);
        showWarning('⚠️ Erreur de chargement', error.message);
        loadCachedData();
    } finally {
        showLoading(false);
    }
}

// 7. APPELS API STORMGLASS
async function fetchCurrentWeather(lat, lng) {
    const params = new URLSearchParams({
        lat: lat,
        lng: lng,
        params: 'airTemperature,waterTemperature,windSpeed,windDirection,waveHeight,pressure,visibility',
        source: 'sg'
    });
    
    const response = await fetch(`https://api.stormglass.io/v2/weather/point?${params}`, {
        headers: { 'Authorization': CONFIG.apiKey }
    });
    
    if (!response.ok) {
        if (response.status === 401) throw new Error('Clé API invalide');
        if (response.status === 429) throw new Error('Limite de requêtes dépassée');
        throw new Error(`Erreur API (${response.status})`);
    }
    
    return await response.json();
}

async function fetchForecast(lat, lng) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const params = new URLSearchParams({
        lat: lat,
        lng: lng,
        params: 'airTemperature,windSpeed,waveHeight',
        start: now.toISOString(),
        end: tomorrow.toISOString(),
        source: 'sg'
    });
    
    const response = await fetch(`https://api.stormglass.io/v2/weather/point?${params}`, {
        headers: { 'Authorization': CONFIG.apiKey }
    });
    
    if (!response.ok) {
        throw new Error(`Erreur prévisions (${response.status})`);
    }
    
    return await response.json();
}

// 8. MISE À JOUR DE L'INTERFACE
function updateCurrentWeather() {
    if (!state.weatherData) return;
    
    const data = state.weatherData;
    const currentHour = new Date().getHours();
    
    // Chercher les données de l'heure actuelle
    let currentData = data.hours?.find(h => 
        new Date(h.time).getHours() === currentHour
    ) || data.hours?.[0] || {};
    
    // Nom de la localisation
    const locationEl = document.getElementById('locationName');
    if (locationEl) {
        locationEl.textContent = CONFIG.locations[state.currentLocation].name;
    }
    
    // Température air
    const airTemp = currentData.airTemperature?.sg;
    if (airTemp !== undefined) {
        const tempEl = document.getElementById('currentTemp');
        if (tempEl) tempEl.textContent = `${Math.round(airTemp)}°C`;
    }
    
    // Température mer
    const waterTemp = currentData.waterTemperature?.sg;
    if (waterTemp !== undefined) {
        const seaEl = document.getElementById('seaTemp');
        if (seaEl) seaEl.textContent = `Mer: ${Math.round(waterTemp)}°C`;
    }
    
    // Conditions météo (basées sur le vent)
    const windSpeed = currentData.windSpeed?.sg || 0;
    const conditions = getConditionsFromWind(windSpeed);
    
    const conditionsEl = document.getElementById('conditions');
    if (conditionsEl) conditionsEl.textContent = conditions.text;
    
    const iconEl = document.getElementById('weatherIcon');
    if (iconEl) iconEl.innerHTML = `<i class="fas ${conditions.icon}"></i>`;
    
    // Vent
    if (currentData.windSpeed?.sg !== undefined) {
        const speed = Math.round(currentData.windSpeed.sg);
        const dir = currentData.windDirection?.sg;
        const dirText = dir ? ` ${getWindDirection(dir)}` : '';
        const windEl = document.getElementById('windValue');
        if (windEl) windEl.textContent = `${speed} nœuds${dirText}`;
    }
    
    // Vagues
    if (currentData.waveHeight?.sg !== undefined) {
        const waveEl = document.getElementById('waveValue');
        if (waveEl) waveEl.textContent = `${currentData.waveHeight.sg.toFixed(1)} m`;
    }
    
    // Pression
    if (currentData.pressure?.sg !== undefined) {
        const pressureEl = document.getElementById('pressureValue');
        if (pressureEl) pressureEl.textContent = `${Math.round(currentData.pressure.sg)} hPa`;
    }
    
    // Visibilité
    if (currentData.visibility?.sg !== undefined) {
        const visEl = document.getElementById('visibilityValue');
        if (visEl) visEl.textContent = `${currentData.visibility.sg.toFixed(1)} km`;
    }
}

// 9. PRÉVISIONS
function updateForecast() {
    if (!state.forecastData) return;
    
    const container = document.getElementById('forecastContainer');
    if (!container) return;
    
    const hours = state.forecastData.hours || [];
    container.innerHTML = '';
    
    // Afficher les 8 prochaines heures (toutes les 3h)
    for (let i = 0; i < Math.min(8, hours.length); i += 3) {
        const hourData = hours[i];
        if (!hourData) continue;
        
        const time = new Date(hourData.time);
        const hour = time.getHours();
        const temp = hourData.airTemperature?.sg;
        const wind = hourData.windSpeed?.sg || 0;
        const waves = hourData.waveHeight?.sg;
        const conditions = getConditionsFromWind(wind);
        
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

// 10. ALERTES MÉTÉO
function updateWarnings() {
    if (!state.weatherData) return;
    
    const data = state.weatherData;
    const currentHour = new Date().getHours();
    const currentData = data.hours?.find(h => 
        new Date(h.time).getHours() === currentHour
    ) || data.hours?.[0] || {};
    
    const windSpeed = currentData.windSpeed?.sg || 0;
    const waveHeight = currentData.waveHeight?.sg || 0;
    
    const warningCard = document.getElementById('warningCard');
    const warningTitle = document.getElementById('warningTitle');
    const warningText = document.getElementById('warningText');
    
    if (!warningCard || !warningTitle || !warningText) return;
    
    // Seuils de danger
    if (windSpeed > 30 || waveHeight > 4) {
        warningCard.className = 'warning-card danger';
        warningTitle.textContent = '🚨 DANGER';
        warningText.textContent = 'Conditions extrêmes. Navigation interdite.';
    } else if (windSpeed > 20 || waveHeight > 2.5) {
        warningCard.className = 'warning-card';
        warningTitle.textContent = '⚠️ ATTENTION';
        warningText.textContent = 'Mer agitée. Prudence recommandée.';
    } else if (windSpeed > 10 || waveHeight > 1.5) {
        warningCard.className = 'warning-card';
        warningTitle.textContent = 'ℹ️ AVIS';
        warningText.textContent = 'Vent modéré. Navigation normale.';
    } else {
        warningCard.className = 'warning-card safe';
        warningTitle.textContent = '✅ FAVORABLE';
        warningText.textContent = 'Excellentes conditions.';
    }
}

// 11. DONNÉES DE DÉMONSTRATION (SANS API)
function loadDemoData() {
    // Simule des données météo réalistes pour la Bretagne
    const demoSites = {
        nord: { temp: 16, mer: 15, vent: 14, vagues: 1.8, pression: 1015, visibilite: 12 },
        sud: { temp: 19, mer: 17, vent: 8, vagues: 0.8, pression: 1020, visibilite: 20 },
        morlaix: { temp: 15, mer: 14, vent: 22, vagues: 2.5, pression: 1010, visibilite: 8 },
        brest: { temp: 17, mer: 16, vent: 16, vagues: 1.5, pression: 1013, visibilite: 15 },
        quiberon: { temp: 20, mer: 18, vent: 10, vagues: 1.0, pression: 1018, visibilite: 18 },
        finistere: { temp: 14, mer: 13, vent: 28, vagues: 3.5, pression: 1008, visibilite: 6 }
    };
    
    const data = demoSites[state.currentLocation] || demoSites.nord;
    
    // Mise à jour interface
    document.getElementById('locationName').textContent = CONFIG.locations[state.currentLocation].name;
    document.getElementById('currentTemp').textContent = `${data.temp}°C`;
    document.getElementById('seaTemp').textContent = `Mer: ${data.mer}°C`;
    document.getElementById('windValue').textContent = `${data.vent} nœuds`;
    document.getElementById('waveValue').textContent = `${data.vagues} m`;
    document.getElementById('pressureValue').textContent = `${data.pression} hPa`;
    document.getElementById('visibilityValue').textContent = `${data.visibilite} km`;
    
    // Conditions
    const conditions = getConditionsFromWind(data.vent);
    document.getElementById('conditions').textContent = conditions.text;
    document.getElementById('weatherIcon').innerHTML = `<i class="fas ${conditions.icon}"></i>`;
    
    // Avertissement
    updateWarnings();
    
    showWarning('🎭 Mode démonstration', 'Configurez votre clé API pour les données réelles');
}

// 12. GESTION DU CACHE
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
    if (!cached) {
        loadDemoData();
        return;
    }
    
    try {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        // Cache valide 30 minutes
        if (age < 30 * 60 * 1000) {
            state.weatherData = data.weather;
            state.forecastData = data.forecast;
            state.currentLocation = data.location;
            
            updateCurrentWeather();
            updateForecast();
            updateWarnings();
            
            showWarning('📱 Mode hors ligne', 'Données du ' + new Date(data.timestamp).toLocaleTimeString());
        } else {
            loadDemoData();
        }
    } catch (e) {
        loadDemoData();
    }
}

// 13. FONCTIONS UTILITAIRES
function getConditionsFromWind(windSpeed) {
    if (windSpeed < 3) return { text: 'Calme plat', icon: 'fa-sun' };
    if (windSpeed < 8) return { text: 'Léger vent', icon: 'fa-cloud-sun' };
    if (windSpeed < 15) return { text: 'Petite brise', icon: 'fa-cloud' };
    if (windSpeed < 22) return { text: 'Jolie brise', icon: 'fa-wind' };
    if (windSpeed < 30) return { text: 'Vent frais', icon: 'fa-wind' };
    return { text: 'Coup de vent', icon: 'fa-poo-storm' };
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return directions[Math.round((degrees % 360) / 22.5) % 16];
}

function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    const offlineEl = document.getElementById('offlineIndicator');
    
    if (statusEl) {
        if (state.isOnline) {
            statusEl.innerHTML = '<i class="fas fa-circle"></i> En ligne';
            statusEl.className = 'status online';
        } else {
            statusEl.innerHTML = '<i class="fas fa-circle"></i> Hors ligne';
            statusEl.className = 'status offline';
        }
    }
    
    if (offlineEl) {
        if (state.isOnline) {
            offlineEl.classList.remove('show');
        } else {
            offlineEl.classList.add('show');
        }
    }
}

function updateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `Mis à jour: ${time}`;
    }
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el && state.lastUpdate) {
        const time = state.lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `Mis à jour: ${time}`;
    }
}

function showLoading(show) {
    const icon = document.getElementById('weatherIcon');
    if (icon) {
        if (show) {
            icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }
    }
}

function showWarning(title, message) {
    const warningTitle = document.getElementById('warningTitle');
    const warningText = document.getElementById('warningText');
    if (warningTitle && warningText) {
        warningTitle.textContent = title;
        warningText.textContent = message;
    }
}

// 14. CONFIGURATION API
window.saveApiKey = function() {
    const input = document.getElementById('apiKeyInput');
    if (input && input.value.trim()) {
        CONFIG.apiKey = input.value.trim();
        localStorage.setItem('stormglass_api_key', input.value.trim());
        alert('✅ Clé API sauvegardée !');
        checkApiKeyAndLoad();
        closeModal();
    } else {
        alert('❌ Veuillez entrer une clé API');
    }
};

// 15. SÉLECTION DE LOCALISATION
window.selectLocation = function(locationId) {
    if (CONFIG.locations[locationId]) {
        state.currentLocation = locationId;
        
        // Mise à jour menu
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-location="${locationId}"]`);
        if (activeItem) activeItem.classList.add('active');
        
        // Recharger données
        checkApiKeyAndLoad();
    }
};

// 16. RAFRAÎCHISSEMENT MANUEL
window.refreshData = function() {
    const btn = document.querySelector('.icon-btn[title="Actualiser"]');
    if (btn) {
        btn.classList.add('refreshing');
        setTimeout(() => btn.classList.remove('refreshing'), 1000);
    }
    checkApiKeyAndLoad();
};

// 17. PWA INSTALLATION
function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        state.deferredPrompt = e;
        
        // Afficher le bouton d'installation après 3 secondes
        setTimeout(() => {
            if (state.deferredPrompt) {
                const installBtn = document.getElementById('installButton');
                if (installBtn) installBtn.classList.add('show');
            }
        }, 3000);
    });
    
    window.addEventListener('appinstalled', () => {
        state.deferredPrompt = null;
        const installBtn = document.getElementById('installButton');
        if (installBtn) installBtn.classList.remove('show');
        console.log('✅ PWA installée avec succès');
    });
}

window.installPWA = async function() {
    if (!state.deferredPrompt) return;
    
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('✅ Installation acceptée');
        document.getElementById('installButton')?.classList.remove('show');
    }
    
    state.deferredPrompt = null;
};

// 18. UTILITAIRES INTERFACE
window.toggleMenu = function() {
    document.getElementById('sideMenu')?.classList.toggle('open');
};

window.openSettings = function() {
    document.getElementById('settingsModal')?.classList.add('show');
    
    // Pré-remplir la clé API
    const input = document.getElementById('apiKeyInput');
    if (input && CONFIG.apiKey) {
        input.value = CONFIG.apiKey;
    }
};

window.showAbout = function() {
    document.getElementById('aboutModal')?.classList.add('show');
    
    // Date de version
    const versionEl = document.getElementById('versionDate');
    if (versionEl) {
        const today = new Date();
        versionEl.textContent = today.toLocaleDateString('fr-FR');
    }
};

window.closeModal = function() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
};

window.clearCache = function() {
    localStorage.removeItem('weather_cache');
    alert('🧹 Cache vidé !');
};

// 19. EXPORTATION DES DONNÉES (optionnel)
window.exportData = function() {
    const data = {
        app: 'Météo Marine Bretagne',
        version: '1.0.0',
        date: new Date().toISOString(),
        location: CONFIG.locations[state.currentLocation],
        weather: state.weatherData,
        forecast: state.forecastData
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meteo-marine-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
// ============================================
// CODE SPÉCIAL ANDROID - À AJOUTER
// ============================================

// Détection Android
const isAndroid = /Android/i.test(navigator.userAgent);

if (isAndroid) {
    console.log('📱 Appareil Android détecté');
    
    // Forcer l'affichage du bouton d'installation
    window.addEventListener('load', function() {
        // Afficher le bouton directement (sans attendre beforeinstallprompt)
        const installBtn = document.getElementById('installMenuButton');
        const installFloatBtn = document.getElementById('installButton');
        
        if (installBtn) {
            installBtn.style.display = 'flex';
            installBtn.classList.add('show');
            
            // Remplacer la fonction d'installation
            installBtn.onclick = function() {
                // Sur Android, on utilise le menu Chrome
                alert('📲 Pour installer :\n\n1. Appuyez sur ⋮\n2. "Ajouter à l\'écran d\'accueil"\n3. "Installer"');
                
                // Ouvrir le menu Chrome
                // (pas possible programmatiquement, donc on guide l'utilisateur)
            };
        }
        
        if (installFloatBtn) {
            installFloatBtn.style.display = 'flex';
            installFloatBtn.classList.add('show');
        }
    });
}
