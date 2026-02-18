// ============================================
// MÉTÉO MARINE - VERSION FINALE CORRIGÉE
// ============================================

console.log("🔥 app.js chargé - Démarrage...");

// ===== CONFIGURATION =====
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

// ===== ÉTAT =====
let state = {
    currentLocation: 'nord',
    weatherData: null,
    forecastData: null,
    isOnline: navigator.onLine,
    deferredPrompt: null,
    lastUpdate: null
};

// ===== UN SEUL ÉCOUTEUR PRINCIPAL =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ DOM prêt - Initialisation complète...');
    
    // TEST VISIBLE (fond rouge)
    document.body.style.backgroundColor = 'red';
    console.log('✅ Test visuel : fond rouge');
    
    // Mode sombre
    if (CONFIG.darkMode) document.body.classList.add('dark-mode');
    
    // AFFICHER LES PRÉVISIONS IMMÉDIATEMENT
    afficherPrevisionsDemo();
    
    // Charger les données météo
    if (!CONFIG.apiKey) {
        afficherModeDemo();
    } else {
        chargerDonneesMeteo();
    }
    
    // Heure
    mettreAJourHeure();
    setInterval(mettreAJourHeure, 60000);
    
    console.log('✅ Initialisation terminée');
});

// ===== PRÉVISIONS =====
function afficherPrevisionsDemo() {
    console.log('📊 Affichage des prévisions');
    const container = document.getElementById('forecastContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    const previsions = [
        { heure: 14, temp: 16, vent: 12, vagues: 1.2, icone: 'fa-cloud-sun' },
        { heure: 17, temp: 15, vent: 14, vagues: 1.4, icone: 'fa-cloud' },
        { heure: 20, temp: 14, vent: 16, vagues: 1.6, icone: 'fa-wind' },
        { heure: 23, temp: 13, vent: 18, vagues: 1.8, icone: 'fa-wind' },
        { heure: 2, temp: 12, vent: 20, vagues: 2.0, icone: 'fa-cloud' },
        { heure: 5, temp: 12, vent: 19, vagues: 1.9, icone: 'fa-cloud-sun' },
        { heure: 8, temp: 14, vent: 15, vagues: 1.5, icone: 'fa-sun' },
        { heure: 11, temp: 16, vent: 13, vagues: 1.3, icone: 'fa-sun' }
    ];
    
    previsions.forEach(p => {
        const card = document.createElement('div');
        card.className = 'forecast-card';
        let h = p.heure + 'h';
        if (p.heure < 10) h = '0' + p.heure + 'h';
        
        card.innerHTML = `
            <div class="forecast-time">${h}</div>
            <div class="forecast-icon"><i class="fas ${p.icone}"></i></div>
            <div class="forecast-temp">${p.temp}°C</div>
            <div class="forecast-details">
                <div><i class="fas fa-wind"></i> ${p.vent} nd</div>
                <div><i class="fas fa-water"></i> ${p.vagues} m</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== MODE DÉMO =====
function afficherModeDemo() {
    console.log('🎭 Mode démo');
    
    const demoSites = {
        nord: { temp: 16, mer: 15, vent: 14, vagues: 1.8, pression: 1015, visibilite: 12, dir: 'NO' },
        sud: { temp: 19, mer: 17, vent: 8, vagues: 0.8, pression: 1020, visibilite: 20, dir: 'SE' },
        morlaix: { temp: 15, mer: 14, vent: 22, vagues: 2.5, pression: 1010, visibilite: 8, dir: 'O' },
        brest: { temp: 17, mer: 16, vent: 16, vagues: 1.5, pression: 1013, visibilite: 15, dir: 'SO' },
        quiberon: { temp: 20, mer: 18, vent: 10, vagues: 1.0, pression: 1018, visibilite: 18, dir: 'E' },
        finistere: { temp: 14, mer: 13, vent: 28, vagues: 3.5, pression: 1008, visibilite: 6, dir: 'ONO' }
    };
    
    const data = demoSites[state.currentLocation] || demoSites.nord;
    
    document.getElementById('locationName').textContent = CONFIG.locations[state.currentLocation].name;
    document.getElementById('currentTemp').textContent = `${data.temp}°C`;
    document.getElementById('seaTemp').textContent = `Mer: ${data.mer}°C`;
    document.getElementById('windValue').textContent = `${data.vent} nœuds (${data.dir})`;
    document.getElementById('waveValue').textContent = `${data.vagues} m`;
    document.getElementById('pressureValue').textContent = `${data.pression} hPa`;
    document.getElementById('visibilityValue').textContent = `${data.visibilite} km`;
    document.getElementById('conditions').textContent = 'Partiellement nuageux';
    document.getElementById('weatherIcon').innerHTML = '<i class="fas fa-cloud-sun"></i>';
    
    document.getElementById('warningTitle').textContent = '🎭 Mode démonstration';
    document.getElementById('warningText').textContent = 'Configurez votre clé API Stormglass pour les données réelles';
    
    mettreAJourCarte(state.currentLocation, data);
}

// ===== API STORMGLASS =====
async function chargerDonneesMeteo() {
    if (!CONFIG.apiKey) {
        afficherModeDemo();
        return;
    }
    
    try {
        const loc = CONFIG.locations[state.currentLocation];
        const params = new URLSearchParams({
            lat: loc.lat, lng: loc.lng,
            params: 'airTemperature,waterTemperature,windSpeed,windDirection,waveHeight,pressure,visibility',
            source: 'sg'
        });
        
        const response = await fetch(`https://api.stormglass.io/v2/weather/point?${params}`, {
            headers: { 'Authorization': CONFIG.apiKey }
        });
        
        if (!response.ok) throw new Error(`Erreur ${response.status}`);
        
        const data = await response.json();
        const current = data.hours?.[0] || {};
        
        document.getElementById('currentTemp').textContent = `${Math.round(current.airTemperature?.sg || 0)}°C`;
        document.getElementById('seaTemp').textContent = `Mer: ${Math.round(current.waterTemperature?.sg || 0)}°C`;
        document.getElementById('windValue').textContent = `${Math.round(current.windSpeed?.sg || 0)} nœuds`;
        document.getElementById('waveValue').textContent = `${(current.waveHeight?.sg || 0).toFixed(1)} m`;
        document.getElementById('pressureValue').textContent = `${Math.round(current.pressure?.sg || 0)} hPa`;
        document.getElementById('visibilityValue').textContent = `${(current.visibility?.sg || 0).toFixed(1)} km`;
        
        document.getElementById('warningTitle').textContent = '✅ Données temps réel';
        document.getElementById('warningText').textContent = 'Mise à jour via Stormglass API';
        
    } catch (error) {
        console.error('Erreur API:', error);
        afficherModeDemo();
    }
}

// ===== UTILITAIRES =====
function mettreAJourHeure() {
    const el = document.getElementById('lastUpdate');
    if (el) {
        const now = new Date();
        const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        el.textContent = `Mis à jour: ${time}`;
    }
}

function mettreAJourCarte(location, data) {
    document.getElementById('selectedZoneName').textContent = CONFIG.locations[location]?.name || 'Côte Nord';
    document.getElementById('selectedZoneTemp').textContent = `${data?.temp || 16}°C`;
    document.getElementById('selectedZoneSea').textContent = `${data?.mer || 15}°C`;
    document.getElementById('selectedZoneWind').textContent = `${data?.vent || 14} nd`;
    document.getElementById('selectedZoneWaves').textContent = `${data?.vagues || 1.8} m`;
}

// ===== FONCTIONS GLOBALES =====
window.selectLocation = function(locationId) {
    if (CONFIG.locations[locationId]) {
        state.currentLocation = locationId;
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        document.querySelector(`[data-location="${locationId}"]`)?.classList.add('active');
        
        if (!CONFIG.apiKey) {
            afficherModeDemo();
        } else {
            chargerDonneesMeteo();
        }
    }
};

window.selectLocationFromMap = function(locationId) {
    window.selectLocation(locationId);
    document.querySelectorAll('.marine-zone').forEach(z => z.classList.remove('active'));
    document.querySelector(`.marine-zone[data-location="${locationId}"]`)?.classList.add('active');
};

window.refreshData = function() {
    if (!CONFIG.apiKey) {
        afficherModeDemo();
    } else {
        chargerDonneesMeteo();
    }
};

window.toggleMenu = function() {
    document.getElementById('sideMenu')?.classList.toggle('open');
};

window.openSettings = function() {
    document.getElementById('settingsModal')?.classList.add('show');
    const input = document.getElementById('apiKeyInput');
    if (input) input.value = CONFIG.apiKey;
};

window.closeModal = function() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
};

window.saveApiKey = function() {
    const input = document.getElementById('apiKeyInput');
    if (input && input.value.trim()) {
        CONFIG.apiKey = input.value.trim();
        localStorage.setItem('stormglass_api_key', input.value.trim());
        alert('✅ Clé API sauvegardée !');
        window.closeModal();
        chargerDonneesMeteo();
    }
};

window.showAbout = function() {
    document.getElementById('aboutModal')?.classList.add('show');
};

window.goToSelectedZone = function() {
    document.querySelector('.weather-card')?.scrollIntoView({ behavior: 'smooth' });
};

// ===== PWA =====
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
        document.getElementById('installButton')?.style.display = 'flex';
        document.getElementById('installMenuButton')?.style.display = 'flex';
    }, 2000);
});

window.installFromMenu = async function() {
    if (!deferredPrompt) {
        alert('L\'application est déjà installée.');
        return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById('installButton')?.style.display = 'none';
    document.getElementById('installMenuButton')?.style.display = 'none';
};

window.installPWA = window.installFromMenu;

console.log('✅ Script chargé - En attente du DOM...');
