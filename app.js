// ============================================
// MÉTÉO MARINE BRETAGNE - APPLICATION COMPLÈTE
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

// ============================================
// 3. INITIALISATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initialisation de l\'application...');
    
    // Appliquer le mode sombre
    if (CONFIG.darkMode) document.body.classList.add('dark-mode');
    
    // Configurer les événements
    setupEvents();
    
    // Mettre à jour l'heure
    mettreAJourHeure();
    setInterval(mettreAJourHeure, 60000);
    
    // Configurer PWA
    setupPWA();
    
    // CHARGER LES PRÉVISIONS IMMÉDIATEMENT
    mettreAJourPrevisions();
    
    // Charger les données météo
    verifierApiEtCharger();
    
    console.log('✅ Application initialisée');
});

// ============================================
// 4. GESTION DES ÉVÉNEMENTS
// ============================================
function setupEvents() {
    window.addEventListener('online', () => {
        state.isOnline = true;
        mettreAJourStatutConnexion();
        verifierApiEtCharger();
    });
    
    window.addEventListener('offline', () => {
        state.isOnline = false;
        mettreAJourStatutConnexion();
        chargerDonneesCache();
    });
    
    // Rafraîchissement toutes les 10 minutes
    setInterval(() => {
        if (state.isOnline && CONFIG.apiKey) {
            chargerDonneesMeteo();
        }
    }, 10 * 60 * 1000);
}

// ============================================
// 5. PRÉVISIONS 24H - VERSION FRANÇAISE CORRIGÉE
// ============================================
function mettreAJourPrevisions() {
    console.log('📊 Mise à jour des prévisions...');
    
    const conteneur = document.getElementById('forecastContainer');
    if (!conteneur) {
        console.log('❌ Conteneur des prévisions non trouvé');
        return;
    }

    // Vider le conteneur
    conteneur.innerHTML = '';

    // Données de démonstration POUR TOUT DE SUITE
    const previsionsDemo = [
        { heure: 14, temp: 16, vent: 12, vagues: 1.2, icone: 'fa-cloud-sun', condition: 'Peu nuageux' },
        { heure: 17, temp: 15, vent: 14, vagues: 1.4, icone: 'fa-cloud', condition: 'Nuageux' },
        { heure: 20, temp: 14, vent: 16, vagues: 1.6, icone: 'fa-wind', condition: 'Venté' },
        { heure: 23, temp: 13, vent: 18, vagues: 1.8, icone: 'fa-wind', condition: 'Vent fort' },
        { heure: 2, temp: 12, vent: 20, vagues: 2.0, icone: 'fa-cloud', condition: 'Nuageux' },
        { heure: 5, temp: 12, vent: 19, vagues: 1.9, icone: 'fa-cloud-sun', condition: 'Peu nuageux' },
        { heure: 8, temp: 14, vent: 15, vagues: 1.5, icone: 'fa-sun', condition: 'Ensoleillé' },
        { heure: 11, temp: 16, vent: 13, vagues: 1.3, icone: 'fa-sun', condition: 'Ensoleillé' }
    ];

    // Générer les cartes de prévision
    previsionsDemo.forEach(item => {
        const carte = document.createElement('div');
        carte.className = 'forecast-card'; // Garder le nom anglais pour le CSS
        
        // Format de l'heure (14h, 02h, etc.)
        let heureAffichage = item.heure + 'h';
        if (item.heure < 10) heureAffichage = '0' + item.heure + 'h';
        
        carte.innerHTML = `
            <div class="forecast-time">${heureAffichage}</div>
            <div class="forecast-icon">
                <i class="fas ${item.icone}"></i>
            </div>
            <div class="forecast-temp">${item.temp}°C</div>
            <div class="forecast-details">
                <div><i class="fas fa-wind"></i> ${item.vent} nd</div>
                <div><i class="fas fa-water"></i> ${item.vagues} m</div>
            </div>
            <div class="forecast-condition" style="font-size: 0.8rem; color: var(--text-light); margin-top: 5px;">
                ${item.condition}
            </div>
        `;
        
        conteneur.appendChild(carte);
    });

    console.log('✅ Prévisions 24h affichées avec succès');
}

// ============================================
// 6. VÉRIFICATION API
// ============================================
function verifierApiEtCharger() {
    const apiInfo = document.getElementById('apiInfo');
    
    if (!CONFIG.apiKey) {
        if (apiInfo) apiInfo.style.display = 'flex';
        afficherAvertissement('🎭 Mode démonstration', 'Configurez votre clé API Stormglass');
        chargerDonneesDemo();
        mettreAJourPrevisions(); // Force l'affichage des prévisions
    } else {
        if (apiInfo) apiInfo.style.display = 'none';
        chargerDonneesMeteo();
    }
}

// ============================================
// 7. DONNÉES DE DÉMONSTRATION
// ============================================
function chargerDonneesDemo() {
    console.log('📱 Chargement des données de démonstration');
    
    const demoSites = {
        nord: { temp: 16, mer: 15, vent: 14, vagues: 1.8, pression: 1015, visibilite: 12, direction: 'NO' },
        sud: { temp: 19, mer: 17, vent: 8, vagues: 0.8, pression: 1020, visibilite: 20, direction: 'SE' },
        morlaix: { temp: 15, mer: 14, vent: 22, vagues: 2.5, pression: 1010, visibilite: 8, direction: 'O' },
        brest: { temp: 17, mer: 16, vent: 16, vagues: 1.5, pression: 1013, visibilite: 15, direction: 'SO' },
        quiberon: { temp: 20, mer: 18, vent: 10, vagues: 1.0, pression: 1018, visibilite: 18, direction: 'E' },
        finistere: { temp: 14, mer: 13, vent: 28, vagues: 3.5, pression: 1008, visibilite: 6, direction: 'ONO' }
    };
    
    const data = demoSites[state.currentLocation] || demoSites.nord;
    
    // Mise à jour de l'interface
    document.getElementById('locationName').textContent = CONFIG.locations[state.currentLocation].name;
    document.getElementById('currentTemp').textContent = `${data.temp}°C`;
    document.getElementById('seaTemp').textContent = `Mer: ${data.mer}°C`;
    document.getElementById('windValue').textContent = `${data.vent} nœuds (${data.direction})`;
    document.getElementById('waveValue').textContent = `${data.vagues} m`;
    document.getElementById('pressureValue').textContent = `${data.pression} hPa`;
    document.getElementById('visibilityValue').textContent = `${data.visibilite} km`;
    
    // Conditions
    const conditions = obtenirConditionsDepuisVent(data.vent);
    document.getElementById('conditions').textContent = conditions.text;
    document.getElementById('weatherIcon').innerHTML = `<i class="fas ${conditions.icon}"></i>`;
    
    // Avertissements
    mettreAJourAlertes(data.vent, data.vagues);
}

// ============================================
// 8. API STORMGLASS
// ============================================
async function chargerDonneesMeteo() {
    if (!CONFIG.apiKey) {
        chargerDonneesDemo();
        return;
    }
    
    if (!state.isOnline) {
        chargerDonneesCache();
        return;
    }
    
    afficherChargement(true);
    
    try {
        const location = CONFIG.locations[state.currentLocation];
        
        const [weather, forecast] = await Promise.all([
            fetchDonneesActuelles(location.lat, location.lng),
            fetchPrevisions(location.lat, location.lng)
        ]);
        
        state.weatherData = weather;
        state.forecastData = forecast;
        state.lastUpdate = new Date();
        
        mettreAJourMeteoActuelle();
        mettreAJourPrevisionsAPI();
        mettreAJourAlertes();
        mettreAJourHeureDerniereMAJ();
        
        mettreEnCache();
        
    } catch (error) {
        console.error('❌ Erreur API:', error);
        afficherAvertissement('⚠️ Erreur de chargement', error.message);
        chargerDonneesCache();
    } finally {
        afficherChargement(false);
    }
}

async function fetchDonneesActuelles(lat, lng) {
    const params = new URLSearchParams({
        lat, lng,
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

async function fetchPrevisions(lat, lng) {
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
    
    if (!response.ok) throw new Error(`Erreur prévisions (${response.status})`);
    return await response.json();
}

// ============================================
// 9. PRÉVISIONS AVEC API
// ============================================
function mettreAJourPrevisionsAPI() {
    if (!state.forecastData || !state.forecastData.hours) {
        mettreAJourPrevisions();
        return;
    }

    const conteneur = document.getElementById('forecastContainer');
    if (!conteneur) return;

    conteneur.innerHTML = '';
    
    const heures = state.forecastData.hours || [];
    let compteur = 0;
    
    for (let i = 0; i < heures.length; i += 3) {
        if (compteur >= 8) break;
        
        const donneesHeure = heures[i];
        if (!donneesHeure) continue;
        
        const date = new Date(donneesHeure.time);
        const heure = date.getHours();
        const temp = donneesHeure.airTemperature?.sg;
        const vent = donneesHeure.windSpeed?.sg || 0;
        const vagues = donneesHeure.waveHeight?.sg;
        
        let icone = 'fa-cloud-sun';
        if (vent < 3) icone = 'fa-sun';
        else if (vent < 10) icone = 'fa-cloud-sun';
        else if (vent < 20) icone = 'fa-cloud';
        else if (vent < 30) icone = 'fa-wind';
        else icone = 'fa-poo-storm';
        
        const carte = document.createElement('div');
        carte.className = 'forecast-card';
        
        let heureAffichage = heure + 'h';
        if (heure < 10) heureAffichage = '0' + heure + 'h';
        
        carte.innerHTML = `
            <div class="forecast-time">${heureAffichage}</div>
            <div class="forecast-icon"><i class="fas ${icone}"></i></div>
            <div class="forecast-temp">${temp ? Math.round(temp) + '°C' : '--°C'}</div>
            <div class="forecast-details">
                <div><i class="fas fa-wind"></i> ${Math.round(vent)} nd</div>
                <div><i class="fas fa-water"></i> ${vagues ? vagues.toFixed(1) + ' m' : '-- m'}</div>
            </div>
        `;
        
        conteneur.appendChild(carte);
        compteur++;
    }
}

// ============================================
// 10. MISE À JOUR INTERFACE
// ============================================
function mettreAJourMeteoActuelle() {
    if (!state.weatherData) return;
    
    const data = state.weatherData;
    const currentHour = new Date().getHours();
    const currentData = data.hours?.find(h => 
        new Date(h.time).getHours() === currentHour
    ) || data.hours?.[0] || {};
    
    document.getElementById('locationName').textContent = CONFIG.locations[state.currentLocation].name;
    
    const airTemp = currentData.airTemperature?.sg;
    if (airTemp) document.getElementById('currentTemp').textContent = `${Math.round(airTemp)}°C`;
    
    const waterTemp = currentData.waterTemperature?.sg;
    if (waterTemp) document.getElementById('seaTemp').textContent = `Mer: ${Math.round(waterTemp)}°C`;
    
    const windSpeed = currentData.windSpeed?.sg || 0;
    const conditions = obtenirConditionsDepuisVent(windSpeed);
    document.getElementById('conditions').textContent = conditions.text;
    document.getElementById('weatherIcon').innerHTML = `<i class="fas ${conditions.icon}"></i>`;
    
    if (currentData.windSpeed?.sg) {
        const dir = currentData.windDirection?.sg;
        const dirText = dir ? ` ${obtenirDirectionVent(dir)}` : '';
        document.getElementById('windValue').textContent = `${Math.round(currentData.windSpeed.sg)} nœuds${dirText}`;
    }
    
    if (currentData.waveHeight?.sg) {
        document.getElementById('waveValue').textContent = `${currentData.waveHeight.sg.toFixed(1)} m`;
    }
    
    if (currentData.pressure?.sg) {
        document.getElementById('pressureValue').textContent = `${Math.round(currentData.pressure.sg)} hPa`;
    }
    
    if (currentData.visibility?.sg) {
        document.getElementById('visibilityValue').textContent = `${currentData.visibility.sg.toFixed(1)} km`;
    }
}

// ============================================
// 11. ALERTES MÉTÉO
// ============================================
function mettreAJourAlertes(ventForce, hauteurVagues) {
    if (state.weatherData) {
        const data = state.weatherData;
        const currentHour = new Date().getHours();
        const currentData = data.hours?.find(h => 
            new Date(h.time).getHours() === currentHour
        ) || data.hours?.[0] || {};
        
        ventForce = currentData.windSpeed?.sg || 0;
        hauteurVagues = currentData.waveHeight?.sg || 0;
    }
    
    const warningCard = document.getElementById('warningCard');
    const warningTitle = document.getElementById('warningTitle');
    const warningText = document.getElementById('warningText');
    
    if (!warningCard || !warningTitle || !warningText) return;
    
    if (ventForce > 30 || hauteurVagues > 4) {
        warningCard.className = 'warning-card danger';
        warningTitle.textContent = '🚨 DANGER';
        warningText.textContent = 'Conditions extrêmes. Navigation interdite.';
    } else if (ventForce > 20 || hauteurVagues > 2.5) {
        warningCard.className = 'warning-card';
        warningTitle.textContent = '⚠️ ATTENTION';
        warningText.textContent = 'Mer agitée. Prudence recommandée.';
    } else if (ventForce > 10 || hauteurVagues > 1.5) {
        warningCard.className = 'warning-card';
        warningTitle.textContent = 'ℹ️ AVIS';
        warningText.textContent = 'Vent modéré. Navigation normale.';
    } else {
        warningCard.className = 'warning-card safe';
        warningTitle.textContent = '✅ FAVORABLE';
        warningText.textContent = 'Excellentes conditions.';
    }
}

// ============================================
// 12. FONCTIONS UTILITAIRES
// ============================================
function obtenirConditionsDepuisVent(vitesseVent) {
    if (vitesseVent < 3) return { text: 'Calme plat', icon: 'fa-sun' };
    if (vitesseVent < 8) return { text: 'Léger vent', icon: 'fa-cloud-sun' };
    if (vitesseVent < 15) return { text: 'Petite brise', icon: 'fa-cloud' };
    if (vitesseVent < 22) return { text: 'Jolie brise', icon: 'fa-wind' };
    if (vitesseVent < 30) return { text: 'Vent frais', icon: 'fa-wind' };
    return { text: 'Coup de vent', icon: 'fa-poo-storm' };
}

function obtenirDirectionVent(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                       'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return directions[Math.round((degrees % 360) / 22.5) % 16];
}

function mettreAJourStatutConnexion() {
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
        state.isOnline ? offlineEl.classList.remove('show') : offlineEl.classList.add('show');
    }
}

function mettreAJourHeure() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `Mis à jour: ${time}`;
    }
}

function mettreAJourHeureDerniereMAJ() {
    const el = document.getElementById('lastUpdate');
    if (el && state.lastUpdate) {
        const time = state.lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `Mis à jour: ${time}`;
    }
}

function afficherChargement(show) {
    const icon = document.getElementById('weatherIcon');
    if (icon && show) {
        icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
}

function afficherAvertissement(titre, message) {
    const warningTitle = document.getElementById('warningTitle');
    const warningText = document.getElementById('warningText');
    if (warningTitle && warningText) {
        warningTitle.textContent = titre;
        warningText.textContent = message;
    }
}

// ============================================
// 13. GESTION DU CACHE
// ============================================
function mettreEnCache() {
    const cache = {
        weather: state.weatherData,
        forecast: state.forecastData,
        location: state.currentLocation,
        timestamp: Date.now()
    };
    localStorage.setItem('weather_cache', JSON.stringify(cache));
}

function chargerDonneesCache() {
    const cached = localStorage.getItem('weather_cache');
    if (!cached) {
        chargerDonneesDemo();
        return;
    }
    
    try {
        const data = JSON.parse(cached);
        const age = Date.now() - data.timestamp;
        
        if (age < 30 * 60 * 1000) {
            state.weatherData = data.weather;
            state.forecastData = data.forecast;
            state.currentLocation = data.location;
            
            mettreAJourMeteoActuelle();
            mettreAJourPrevisionsAPI();
            mettreAJourAlertes();
            
            afficherAvertissement('📱 Mode hors ligne', 'Données du ' + new Date(data.timestamp).toLocaleTimeString());
        } else {
            chargerDonneesDemo();
        }
    } catch (e) {
        chargerDonneesDemo();
    }
}

function viderCache() {
    localStorage.removeItem('weather_cache');
    alert('🧹 Cache vidé !');
}

// ============================================
// 14. CONFIGURATION API
// ============================================
window.saveApiKey = function() {
    const input = document.getElementById('apiKeyInput');
    if (input && input.value.trim()) {
        CONFIG.apiKey = input.value.trim();
        localStorage.setItem('stormglass_api_key', input.value.trim());
        alert('✅ Clé API sauvegardée !');
        verifierApiEtCharger();
        fermerModal();
    } else {
        alert('❌ Veuillez entrer une clé API');
    }
};

// ============================================
// 15. SÉLECTION DE LOCALISATION
// ============================================
window.selectLocation = function(locationId) {
    if (CONFIG.locations[locationId]) {
        state.currentLocation = locationId;
        
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        const activeItem = document.querySelector(`[data-location="${locationId}"]`);
        if (activeItem) activeItem.classList.add('active');
        
        verifierApiEtCharger();
        mettreAJourPrevisions(); // Force l'affichage des prévisions
        
        // Mettre à jour la carte
        if (window.selectLocationFromMap) {
            window.selectLocationFromMap(locationId);
        }
    }
};

// ============================================
// 16. RAFRAÎCHISSEMENT
// ============================================
window.refreshData = function() {
    const btn = document.querySelector('.icon-btn[title="Actualiser"]');
    if (btn) {
        btn.classList.add('refreshing');
        setTimeout(() => btn.classList.remove('refreshing'), 1000);
    }
    verifierApiEtCharger();
    mettreAJourPrevisions();
};

// ============================================
// 17. PWA INSTALLATION
// ============================================
let deferredPrompt;

function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        setTimeout(() => {
            if (deferredPrompt) {
                const installBtn = document.getElementById('installButton');
                const installMenuBtn = document.getElementById('installMenuButton');
                if (installBtn) installBtn.style.display = 'flex';
                if (installMenuBtn) installMenuBtn.style.display = 'flex';
            }
        }, 3000);
    });
    
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const installBtn = document.getElementById('installButton');
        const installMenuBtn = document.getElementById('installMenuButton');
        if (installBtn) installBtn.style.display = 'none';
        if (installMenuBtn) installMenuBtn.style.display = 'none';
        console.log('✅ PWA installée');
    });
}

window.installFromMenu = async function() {
    if (!deferredPrompt) {
        alert('L\'application est déjà installée.');
        return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('✅ Installation acceptée');
        document.getElementById('installButton')?.style.display = 'none';
        document.getElementById('installMenuButton')?.style.display = 'none';
    }
    
    deferredPrompt = null;
};

window.installPWA = window.installFromMenu;

// ============================================
// 18. INTERFACE UTILISATEUR
// ============================================
window.toggleMenu = function() {
    document.getElementById('sideMenu')?.classList.toggle('open');
};

window.openSettings = function() {
    document.getElementById('settingsModal')?.classList.add('show');
    const input = document.getElementById('apiKeyInput');
    if (input && CONFIG.apiKey) input.value = CONFIG.apiKey;
};

window.showAbout = function() {
    document.getElementById('aboutModal')?.classList.add('show');
    const versionEl = document.getElementById('versionDate');
    if (versionEl) {
        versionEl.textContent = new Date().toLocaleDateString('fr-FR');
    }
};

window.fermerModal = window.closeModal = function() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('show');
    });
};

window.clearCache = viderCache;

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
// 19. FONCTIONS POUR LA CARTE
// ============================================
window.selectLocationFromMap = function(locationId) {
    if (window.selectLocation) {
        window.selectLocation(locationId);
        document.querySelectorAll('.marine-zone').forEach(z => z.classList.remove('active'));
        document.querySelector(`.marine-zone[data-location="${locationId}"]`)?.classList.add('active');
        mettreAJourCarteSelectionnee(locationId);
    }
};

function mettreAJourCarteSelectionnee(locationId) {
    const location = CONFIG.locations[locationId];
    if (!location) return;
    
    document.getElementById('selectedZoneName').textContent = location.name;
    
    const data = {
        nord: { temp: 16, mer: 15, vent: 14, vagues: 1.8 },
        sud: { temp: 19, mer: 17, vent: 8, vagues: 0.8 },
        morlaix: { temp: 15, mer: 14, vent: 22, vagues: 2.5 },
        brest: { temp: 17, mer: 16, vent: 16, vagues: 1.5 },
        quiberon: { temp: 20, mer: 18, vent: 10, vagues: 1.0 },
        finistere: { temp: 14, mer: 13, vent: 28, vagues: 3.5 }
    };
    
    const zoneData = data[locationId] || data.nord;
    
    document.getElementById('selectedZoneTemp').textContent = `${zoneData.temp}°C`;
    document.getElementById('selectedZoneSea').textContent = `${zoneData.mer}°C`;
    document.getElementById('selectedZoneWind').textContent = `${zoneData.vent} nd`;
    document.getElementById('selectedZoneWaves').textContent = `${zoneData.vagues} m`;
    
    document.getElementById('mapUpdateTime').textContent = 
        `Mise à jour: ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

window.goToSelectedZone = function() {
    document.querySelector('.weather-card').scrollIntoView({ behavior: 'smooth' });
};

window.switchTab = function(tab) {
    console.log('Navigation vers:', tab);
    // À implémenter selon vos besoins
};

// Initialisation de la carte
setTimeout(() => {
    if (window.selectLocationFromMap) {
        window.selectLocationFromMap(state.currentLocation);
    }
}, 1000);
