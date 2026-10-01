/**
 * ui.js
 * Kezeli a glassmorphic felületet, az infopanelt, a lebegő hover címkét,
 * az alsó bolygó-dokkolót és a szimulációs vezérlőket.
 */

import { solarSystemData } from './planetsData.js';

export class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.currentPlanet = null;
    this.audioContext = null;
    this.isMuted = true;
    this.ambientNodes = null;

    this.cacheElements();
    this.buildPlanetList();
    this.setupEventListeners();
    this.setupAudio();
  }

  cacheElements() {
    this.infoDrawer = document.getElementById('infoDrawer');
    this.hoverTooltip = document.getElementById('hoverTooltip');
    this.planetSidebar = document.getElementById('planetSidebar');
    this.planetList = document.getElementById('planetList');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.btnModeOrbit = document.getElementById('btnModeOrbit');
    this.btnModeLineup = document.getElementById('btnModeLineup');
    this.btnResetView = document.getElementById('btnResetView');
    this.btnPlayPause = document.getElementById('btnPlayPause');
    this.speedButtons = document.querySelectorAll('.speed-btn');
    this.btnSound = document.getElementById('btnSound');
    this.helpModal = document.getElementById('helpModal');
    this.btnHelp = document.getElementById('btnHelp');
    this.btnCloseHelp = document.getElementById('btnCloseHelp');
    this.lineupBanner = document.getElementById('lineupBanner');
  }

  buildPlanetList() {
    if (!this.planetList) return;
    this.planetList.innerHTML = '';
    solarSystemData.forEach((planet) => {
      const btn = document.createElement('button');
      btn.className = 'planet-list-item';
      btn.dataset.id = planet.id;
      btn.setAttribute('aria-label', planet.name);

      const shortType = planet.type.split(' ')[0];

      btn.innerHTML = `
        <span class="item-dot" style="background-color: ${planet.color}; box-shadow: 0 0 10px ${planet.glowColor}"></span>
        <div class="item-text">
          <div class="item-name">${planet.name}</div>
          <div class="item-sub">${shortType}</div>
        </div>
        <div class="item-metric">${planet.distanceFromSunKm !== '0 km' ? planet.distanceFromSunAU : 'Centrum'}</div>
      `;

      btn.addEventListener('click', () => {
        this.engine.selectPlanet(planet.id);
      });

      this.planetList.appendChild(btn);
    });
  }

  setupEventListeners() {
    // Bal oldali égitest sáv összecsukása / kinyitása
    if (this.btnToggleSidebar && this.planetSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => {
        const isCollapsed = this.planetSidebar.classList.toggle('collapsed');
        this.btnToggleSidebar.innerHTML = isCollapsed ? '▶' : '◀';
        this.btnToggleSidebar.setAttribute('title', isCollapsed ? 'Égitest lista megjelenítése' : 'Égitest lista elrejtése');
      });
    }

    // Módváltó gombok (Pályák vs Méretarány)
    if (this.btnModeOrbit && this.btnModeLineup) {
      this.btnModeOrbit.addEventListener('click', () => {
        this.btnModeOrbit.classList.add('active');
        this.btnModeLineup.classList.remove('active');
        if (this.lineupBanner) this.lineupBanner.classList.remove('visible');
        this.engine.setMode('orbit');
      });

      this.btnModeLineup.addEventListener('click', () => {
        this.btnModeLineup.classList.add('active');
        this.btnModeOrbit.classList.remove('active');
        if (this.lineupBanner) this.lineupBanner.classList.add('visible');
        this.engine.setMode('lineup');
      });
    }

    // Info panel bezárása
    const btnCloseDrawer = document.getElementById('btnCloseDrawer');
    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => {
        this.hidePlanetInfo();
        this.engine.resetView();
      });
    }

    // Teljes nézet visszaállítása
    if (this.btnResetView) {
      this.btnResetView.addEventListener('click', () => {
        this.hidePlanetInfo();
        this.engine.resetView();
      });
    }

    // Lejátszás / Szünet
    if (this.btnPlayPause) {
      this.btnPlayPause.addEventListener('click', () => {
        const isPaused = this.engine.togglePause();
        this.btnPlayPause.innerHTML = isPaused ? '▶️' : '⏸️';
        this.btnPlayPause.classList.toggle('active', !isPaused);
        this.btnPlayPause.setAttribute('title', isPaused ? 'Idő indítása' : 'Idő megállítása');
      });
    }

    // Sebesség gombok
    this.speedButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        this.engine.setSpeed(speed);
      });
    });

    // Hang be/kikapcsolás
    if (this.btnSound) {
      this.btnSound.addEventListener('click', () => {
        this.toggleSound();
      });
    }

    // Súgó modál
    if (this.btnHelp && this.helpModal) {
      this.btnHelp.addEventListener('click', () => {
        this.helpModal.classList.toggle('visible');
      });
    }
    if (this.btnCloseHelp && this.helpModal) {
      this.btnCloseHelp.addEventListener('click', () => {
        this.helpModal.classList.remove('visible');
      });
    }

    // ESC billentyűre bezárás
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.helpModal && this.helpModal.classList.contains('visible')) {
          this.helpModal.classList.remove('visible');
        } else {
          this.hidePlanetInfo();
          this.engine.resetView();
        }
      }
    });
  }

  showPlanetInfo(planet) {
    this.currentPlanet = planet;
    if (!planet) {
      this.hidePlanetInfo();
      return;
    }

    // Bal oldali lista aktív elemének frissítése
    document.querySelectorAll('.planet-list-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === planet.id);
    });

    // Infopanel elemek kitöltése
    const badge = document.getElementById('drawerBadge');
    const title = document.getElementById('drawerTitle');
    const subtitle = document.getElementById('drawerSubtitle');
    const tagline = document.getElementById('drawerTagline');

    const statDiameter = document.getElementById('statDiameter');
    const statDiameterRatio = document.getElementById('statDiameterRatio');
    const statDistance = document.getElementById('statDistance');
    const statDistanceAU = document.getElementById('statDistanceAU');
    const statOrbit = document.getElementById('statOrbit');
    const statRotation = document.getElementById('statRotation');
    const statTemp = document.getElementById('statTemp');
    const statMoons = document.getElementById('statMoons');

    const descText = document.getElementById('drawerDesc');
    const factsList = document.getElementById('drawerFactsList');

    if (badge) {
      badge.textContent = planet.type;
      badge.style.borderColor = planet.color;
      badge.style.color = planet.color;
    }
    if (title) title.textContent = planet.name;
    if (subtitle) subtitle.textContent = planet.latinName;
    if (tagline) tagline.textContent = planet.tagline;

    if (statDiameter) statDiameter.textContent = planet.diameterKm;
    if (statDiameterRatio) statDiameterRatio.textContent = planet.diameterEarthRatio;
    if (statDistance) statDistance.textContent = planet.distanceFromSunKm;
    if (statDistanceAU) statDistanceAU.textContent = planet.distanceFromSunAU;
    if (statOrbit) statOrbit.textContent = planet.orbitalPeriod;
    if (statRotation) statRotation.textContent = planet.rotationPeriod;
    if (statTemp) statTemp.textContent = planet.temperature;
    if (statMoons) statMoons.textContent = `${planet.moonsCount} ismert hold`;

    if (descText) descText.textContent = planet.overview;

    if (factsList) {
      factsList.innerHTML = '';
      planet.facts.forEach((fact, idx) => {
        const item = document.createElement('div');
        item.className = 'fact-item';
        item.innerHTML = `
          <div class="fact-num" style="color: ${planet.color}">0${idx + 1}</div>
          <div class="fact-text">${fact}</div>
        `;
        factsList.appendChild(item);
      });
    }

    // Mini 3D orv / textúra előnézet
    this.renderMiniPreview(planet);

    this.infoDrawer.classList.add('open');
  }

  hidePlanetInfo() {
    this.currentPlanet = null;
    this.infoDrawer.classList.remove('open');
    document.querySelectorAll('.planet-list-item').forEach(btn => btn.classList.remove('active'));
  }

  updateHoverTooltip(planet) {
    if (!planet) {
      this.hoverTooltip.classList.remove('visible');
      return;
    }

    this.hoverTooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-dot" style="background-color: ${planet.color}"></span>
        <strong>${planet.name}</strong>
      </div>
      <div class="tooltip-sub">${planet.distanceFromSunKm !== '0 km' ? 'Távolság: ' + planet.distanceFromSunKm : planet.type}</div>
      <div class="tooltip-hint">Kattints a részletes bemutatáshoz ➔</div>
    `;

    // Követjük az egeret
    const x = window.lastPointerX || window.innerWidth / 2;
    const y = window.lastPointerY || window.innerHeight / 2;

    this.hoverTooltip.style.left = `${Math.min(window.innerWidth - 220, x + 18)}px`;
    this.hoverTooltip.style.top = `${Math.min(window.innerHeight - 100, y + 18)}px`;
    this.hoverTooltip.classList.add('visible');
  }

  renderMiniPreview(planet) {
    const canvas = document.getElementById('miniPlanetCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const globeRadius = planet.hasRings ? w * 0.28 : w * 0.38;

    // Ha Nap, rajzoljunk külső tüzes ragyogást
    if (planet.id === 'sun') {
      const sunHalo = ctx.createRadialGradient(cx, cy, globeRadius * 0.8, cx, cy, globeRadius * 1.35);
      sunHalo.addColorStop(0, 'rgba(255, 170, 0, 0.9)');
      sunHalo.addColorStop(0.5, 'rgba(255, 90, 0, 0.4)');
      sunHalo.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = sunHalo;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius * 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Szaturnusz esetén a hátsó félgyűrű megrajzolása a gömb mögé
    if (planet.hasRings) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.25); // 15 fokos dőlés
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.46, w * 0.16, 0, Math.PI, 2 * Math.PI); // felső/hátsó fél
      ctx.strokeStyle = 'rgba(226, 204, 168, 0.85)';
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.restore();
    }

    // Kirajzoljuk a bolygó textúráját egy gömbszerű árnyékolt körbe
    const texCanvas = this.engine.textureGen.getTextureForPlanet(planet.id);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
    ctx.clip();

    // Textúra leképezése
    ctx.drawImage(texCanvas, 0, 0, texCanvas.width, texCanvas.height, cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

    // Kozmikus gömb 3D árnyék (világos bal-felül, sötét jobb-alul)
    if (planet.id !== 'sun') {
      const shadowGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.35, cy - globeRadius * 0.35, globeRadius * 0.1,
        cx, cy, globeRadius
      );
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      shadowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.0)');
      shadowGrad.addColorStop(0.82, 'rgba(0, 0, 0, 0.7)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');

      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // Szaturnusz elülső félgyűrűje a gömb elé
    if (planet.hasRings) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.25);
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.46, w * 0.16, 0, 0, Math.PI); // alsó/elülső fél
      ctx.strokeStyle = 'rgba(226, 204, 168, 0.95)';
      ctx.lineWidth = 14;
      ctx.stroke();
      // Cassini-rés vékony sötét vonala
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.47, w * 0.165, 0, 0, Math.PI);
      ctx.strokeStyle = 'rgba(10, 16, 32, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Külső atmoszféra ragyogás gyűrű
    ctx.beginPath();
    ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = planet.glowColor || 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Atmoszférikus sci-fi térhangzás Web Audio API-val
  setupAudio() {
    // Felhasználói kattintásra inicializáljuk a Web Audio API-t
    const initAudio = () => {
      if (this.audioContext) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    };

    window.addEventListener('click', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
  }

  toggleSound() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.isMuted = !this.isMuted;
    this.btnSound.classList.toggle('active', !this.isMuted);
    this.btnSound.innerHTML = this.isMuted ? '🔇' : '🔊';
    this.btnSound.setAttribute('title', this.isMuted ? 'Kozmikus háttérzene bekapcsolása' : 'Némítás');

    if (!this.isMuted) {
      this.startSpaceAmbient();
    } else {
      this.stopSpaceAmbient();
    }
  }

  startSpaceAmbient() {
    if (this.ambientNodes) return;
    const ctx = this.audioContext;
    if (!ctx) return;

    // 1. Mély kozmikus morajlás (Sub drone)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 hang

    // 2. Éteri felhang (Harmonic fifth)
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(82.4, ctx.currentTime); // E2 hang

    // 3. Finom lebegés (LFO)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(4, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    // Aluláteresztő szűrő a selymes, űrbéli meleg tónusért
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.08, ctx.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    lfo.start();

    this.ambientNodes = { osc1, osc2, lfo, masterGain };
  }

  stopSpaceAmbient() {
    if (!this.ambientNodes) return;
    const { osc1, osc2, lfo, masterGain } = this.ambientNodes;
    masterGain.gain.exponentialRampToValueAtTime(0.0001, this.audioContext.currentTime + 0.6);
    setTimeout(() => {
      try {
        osc1.stop();
        osc2.stop();
        lfo.stop();
        osc1.disconnect();
        osc2.disconnect();
        lfo.disconnect();
      } catch (e) {}
      this.ambientNodes = null;
    }, 600);
  }
}
