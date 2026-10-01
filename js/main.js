/**
 * main.js
 * Fő belépési pont. Összeköti a 3D motort (solarSystem.js) és a kezelőfelületet (ui.js).
 */

import { SolarSystemEngine } from './solarSystem.js';
import { UIManager } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('webgl-container');

  let ui = null;

  // Egér pozíció követése a tooltiphez
  window.addEventListener('pointermove', (e) => {
    window.lastPointerX = e.clientX;
    window.lastPointerY = e.clientY;
  });

  // 3D motor inicializálása
  const engine = new SolarSystemEngine(
    container,
    // On planet select callback
    (planetData) => {
      if (ui) {
        ui.showPlanetInfo(planetData);
      }
    },
    // On hover change callback
    (planetData) => {
      if (ui) {
        ui.updateHoverTooltip(planetData);
      }
    }
  );

  // UI kezelő inicializálása
  ui = new UIManager(engine);

  console.log("🚀 Naprendszer Felfedező sikeresen betöltve!");
});
