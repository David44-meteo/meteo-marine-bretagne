console.log("✅ FICHIER OK - Le JavaScript fonctionne !");

document.addEventListener('DOMContentLoaded', function() {
    console.log("✅ DOM chargé - Application démarre");
    
    // Message visible sur la page
    const warning = document.getElementById('warningTitle');
    if (warning) warning.textContent = "✅ TEST RÉUSSI";
    
    document.getElementById('currentTemp').textContent = "16°C";
    document.getElementById('seaTemp').textContent = "Mer: 15°C";
    document.getElementById('windValue').textContent = "14 nœuds";
    document.getElementById('waveValue').textContent = "1.8 m";
});
