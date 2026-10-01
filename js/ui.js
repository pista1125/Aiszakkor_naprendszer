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
    this.currentTab = 'surface';
    this.selectedLayerId = null;
    this.hoveredLayerId = null;
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

    // Belső felépítés (Földrajz) elemek
    this.drawerTabsWrapper = document.getElementById('drawerTabsWrapper');
    this.tabSurfaceView = document.getElementById('tabSurfaceView');
    this.tabStructureView = document.getElementById('tabStructureView');
    this.btnToggle3DSceneCutaway = document.getElementById('btnToggle3DSceneCutaway');
    this.btnSceneCutawayText = document.getElementById('btnSceneCutawayText');
    this.visualPreviewBox = document.querySelector('.visual-preview-box');
    this.previewCutawayHint = document.getElementById('previewCutawayHint');
    this.miniPlanetCanvas = document.getElementById('miniPlanetCanvas');

    this.surfaceViewContent = document.getElementById('surfaceViewContent');
    this.structureViewContent = document.getElementById('structureViewContent');
    this.structureTitle = document.getElementById('structureTitle');
    this.structureSummary = document.getElementById('structureSummary');
    this.layerSelectorList = document.getElementById('layerSelectorList');
    this.layerScaleBar = document.getElementById('layerScaleBar');
    this.layerScaleLegend = document.getElementById('layerScaleLegend');
    this.selectedLayerCard = document.getElementById('selectedLayerCard');
    this.layersSummaryTableBody = document.getElementById('layersSummaryTableBody');
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

    // Felszín vs Belső felépítés nézetváltó tabok
    if (this.tabSurfaceView && this.tabStructureView) {
      this.tabSurfaceView.addEventListener('click', () => this.switchTab('surface'));
      this.tabStructureView.addEventListener('click', () => this.switchTab('structure'));
    }

    // 3D Térbeli metszet gomb a miniatűr dobozban
    if (this.btnToggle3DSceneCutaway) {
      this.btnToggle3DSceneCutaway.addEventListener('click', () => {
        if (!this.currentPlanet) return;
        const isCut = this.engine.isPlanetCutaway(this.currentPlanet.id);
        const newState = this.engine.setPlanetCutaway(this.currentPlanet.id, !isCut);
        this.update3DCutawayButtonState(newState);
      });
    }

    // Miniatűr canvas egérinterakciók (metszet módban réteg kiválasztása)
    if (this.miniPlanetCanvas) {
      this.miniPlanetCanvas.addEventListener('pointermove', (e) => {
        if (this.currentTab !== 'structure' || !this.currentPlanet || !this.currentPlanet.internalStructure) return;
        this.handleCutawayCanvasPointer(e);
      });

      this.miniPlanetCanvas.addEventListener('pointerleave', () => {
        if (this.hoveredLayerId !== null) {
          this.hoveredLayerId = null;
          this.renderMiniPreview(this.currentPlanet);
        }
      });

      this.miniPlanetCanvas.addEventListener('click', (e) => {
        if (this.currentTab !== 'structure' || !this.currentPlanet || !this.currentPlanet.internalStructure) return;
        this.handleCutawayCanvasClick(e);
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

  switchTab(tabName) {
    if (!this.currentPlanet) return;
    if (tabName === 'structure' && !this.currentPlanet.internalStructure) return;

    this.currentTab = tabName;
    if (this.tabSurfaceView) this.tabSurfaceView.classList.toggle('active', tabName === 'surface');
    if (this.tabStructureView) this.tabStructureView.classList.toggle('active', tabName === 'structure');

    if (this.surfaceViewContent) this.surfaceViewContent.classList.toggle('active', tabName === 'surface');
    if (this.structureViewContent) this.structureViewContent.classList.toggle('active', tabName === 'structure');

    if (this.visualPreviewBox) {
      this.visualPreviewBox.classList.toggle('cutaway-mode', tabName === 'structure');
    }

    // Ha belső felépítésre váltunk, a 3D szimulációban is aktiváljuk a metszetet
    if (tabName === 'structure') {
      const isCut = this.engine.isPlanetCutaway(this.currentPlanet.id);
      if (!isCut) {
        this.engine.setPlanetCutaway(this.currentPlanet.id, true);
        this.update3DCutawayButtonState(true);
      }
    }

    this.renderMiniPreview(this.currentPlanet);
  }

  update3DCutawayButtonState(isActive) {
    if (!this.btnToggle3DSceneCutaway) return;
    this.btnToggle3DSceneCutaway.classList.toggle('active', isActive);
    if (this.btnSceneCutawayText) {
      this.btnSceneCutawayText.textContent = isActive ? 'Normál 3D gömb' : '3D metszet térben';
    }
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

    // Kezeljük a Belső felépítés tabot és a 3D metszet gombot
    if (planet.internalStructure) {
      if (this.drawerTabsWrapper) this.drawerTabsWrapper.style.display = 'flex';
      if (this.btnToggle3DSceneCutaway) this.btnToggle3DSceneCutaway.style.display = 'flex';
      this.setupStructureView(planet);
      this.update3DCutawayButtonState(this.engine.isPlanetCutaway(planet.id));
    } else {
      if (this.drawerTabsWrapper) this.drawerTabsWrapper.style.display = 'none';
      if (this.btnToggle3DSceneCutaway) this.btnToggle3DSceneCutaway.style.display = 'none';
      this.switchTab('surface');
      this.engine.setPlanetCutaway(planet.id, false);
    }

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

    // Mini előnézet / metszet kirajzolása
    this.renderMiniPreview(planet);

    this.infoDrawer.classList.add('open');
  }

  hidePlanetInfo() {
    if (this.currentPlanet) {
      this.engine.setPlanetCutaway(this.currentPlanet.id, false);
    }
    this.currentPlanet = null;
    this.currentTab = 'surface';
    if (this.tabSurfaceView) this.tabSurfaceView.classList.add('active');
    if (this.tabStructureView) this.tabStructureView.classList.remove('active');
    if (this.surfaceViewContent) this.surfaceViewContent.classList.add('active');
    if (this.structureViewContent) this.structureViewContent.classList.remove('active');
    if (this.visualPreviewBox) this.visualPreviewBox.classList.remove('cutaway-mode');
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
    if (!planet) return;
    if (this.currentTab === 'structure' && planet.internalStructure) {
      this.renderCutawayPreview(planet);
      return;
    }

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

  /**
   * Belső felépítés 2.5D/3D interaktív rétegmetszetének kirajzolása
   */
  renderCutawayPreview(planet) {
    const canvas = this.miniPlanetCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.44;
    const cy = h * 0.50;
    const maxR = w * 0.38;

    const isSun = (planet.id === 'sun');
    const layers = planet.internalStructure ? planet.internalStructure.layers : [];
    if (!layers || layers.length === 0) return;

    // 1. Kozmikus haló háttér
    const bgHalo = ctx.createRadialGradient(cx, cy, maxR * 0.2, cx, cy, maxR * 1.35);
    if (isSun) {
      bgHalo.addColorStop(0, 'rgba(255, 170, 0, 0.5)');
      bgHalo.addColorStop(0.6, 'rgba(255, 80, 0, 0.15)');
      bgHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    } else {
      bgHalo.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      bgHalo.addColorStop(0.7, 'rgba(30, 58, 138, 0.1)');
      bgHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = bgHalo;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 2. Külső gömb 3/4 része (bal oldal és alsó rész, a nyitás -PI/2 és 0 között van)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxR, 0, Math.PI * 1.5, false);
    ctx.closePath();
    ctx.clip();

    const texCanvas = this.engine.textureGen.getTextureForPlanet(planet.id);
    ctx.drawImage(texCanvas, 0, 0, texCanvas.width, texCanvas.height, cx - maxR, cy - maxR, maxR * 2, maxR * 2);

    if (!isSun) {
      const shadowGrad = ctx.createRadialGradient(
        cx - maxR * 0.35, cy - maxR * 0.35, maxR * 0.1,
        cx, cy, maxR
      );
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
      shadowGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.1)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(cx - maxR, cy - maxR, maxR * 2, maxR * 2);
    }
    ctx.restore();

    // 3. A kivágott 1/4 negyedmetszet (szög: -PI/2 -től 0-ig)
    let highlightedLayerInfo = null;

    layers.forEach((layer, idx) => {
      const rOuter = maxR * layer.radiusRatio;
      const nextLayer = layers[idx + 1];
      const rInner = nextLayer ? maxR * nextLayer.radiusRatio : 0;
      const isSelected = (layer.id === this.selectedLayerId);
      const isHovered = (layer.id === this.hoveredLayerId);

      if (isSelected || isHovered) {
        highlightedLayerInfo = { layer, rOuter, rInner, isSelected, isHovered };
      }

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOuter, -Math.PI / 2, 0, false);
      ctx.lineTo(cx, cy);
      ctx.closePath();

      if (idx === layers.length - 1) {
        // Legbelső mag - sugárzó gradiens
        const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
        if (isSun) {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.5, '#fff9c4');
          coreGrad.addColorStop(1, '#ffc107');
        } else {
          coreGrad.addColorStop(0, '#ffffff');
          coreGrad.addColorStop(0.6, '#fff9c4');
          coreGrad.addColorStop(1, '#ffe082');
        }
        ctx.fillStyle = coreGrad;
      } else {
        ctx.fillStyle = layer.crossColor || layer.color;
      }
      ctx.fill();

      // Finom réteghatár vonal
      ctx.strokeStyle = isSun ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.restore();
    });

    // 4. Kijelölt vagy hoverelt réteg kiemelése és mutató vonal
    if (highlightedLayerInfo) {
      const { layer, rOuter, rInner, isSelected } = highlightedLayerInfo;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, -Math.PI / 2, 0, false);
      if (rInner > 0) {
        ctx.arc(cx, cy, rInner, 0, -Math.PI / 2, true);
      } else {
        ctx.lineTo(cx, cy);
      }
      ctx.closePath();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.shadowColor = isSelected ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.8)';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Mutató vonal
      const midR = (rOuter + rInner) / 2;
      const angle = -Math.PI / 4;
      const pinStartX = cx + Math.cos(angle) * midR;
      const pinStartY = cy + Math.sin(angle) * midR;
      const pinCornerX = cx + maxR * 1.05;
      const pinCornerY = Math.max(20, pinStartY - 10);
      const pinEndX = Math.min(w - 12, pinCornerX + 45);

      ctx.beginPath();
      ctx.moveTo(pinStartX, pinStartY);
      ctx.lineTo(pinCornerX, pinCornerY);
      ctx.lineTo(pinEndX, pinCornerY);
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pinStartX, pinStartY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#38bdf8' : '#ffffff';
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.font = '600 11px Outfit, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(layer.name, pinEndX, pinCornerY - 4);

      ctx.font = '500 9px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(layer.depth, pinEndX, pinCornerY + 11);

      ctx.restore();
    }

    // 5. Geológiai határfelületek (Földnél)
    if (planet.id === 'earth') {
      this.drawEarthGeologicalDiscontinuities(ctx, cx, cy, maxR);
    }

    // Külső perem
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawEarthGeologicalDiscontinuities(ctx, cx, cy, maxR) {
    const boundaries = [
      { r: maxR * 0.98, label: 'Moho' },
      { r: maxR * 0.55, label: 'Gutenberg' },
      { r: maxR * 0.19, label: 'Lehmann' }
    ];

    boundaries.forEach(b => {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.arc(cx, cy, b.r, -Math.PI / 2, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    });
  }

  setupStructureView(planet) {
    if (!planet || !planet.internalStructure) return;
    const struct = planet.internalStructure;
    const layers = struct.layers;

    if (this.structureTitle) this.structureTitle.textContent = struct.title;
    if (this.structureSummary) this.structureSummary.textContent = struct.summary;

    // 1. Rétegválasztó gombok feltöltése
    if (this.layerSelectorList) {
      this.layerSelectorList.innerHTML = '';
      layers.forEach(layer => {
        const btn = document.createElement('button');
        btn.className = 'layer-selector-btn';
        btn.dataset.layerId = layer.id;
        btn.style.setProperty('--active-layer-color', layer.color);

        btn.innerHTML = `
          <div class="layer-btn-left">
            <span class="layer-color-dot" style="background-color: ${layer.color}; color: ${layer.color}"></span>
            <span class="layer-btn-name">${layer.name}</span>
          </div>
          <span class="layer-btn-depth">${layer.depth}</span>
        `;

        btn.addEventListener('click', () => {
          this.selectLayer(layer.id);
        });

        this.layerSelectorList.appendChild(btn);
      });
    }

    // 2. Skálasáv és jelmagyarázat feltöltése
    if (this.layerScaleBar) {
      this.layerScaleBar.innerHTML = '';
      for (let i = 0; i < layers.length; i++) {
        const currentR = layers[i].radiusRatio;
        const nextR = layers[i + 1] ? layers[i + 1].radiusRatio : 0;
        const widthPercent = (currentR - nextR) * 100;

        const seg = document.createElement('div');
        seg.className = 'layer-scale-segment';
        seg.dataset.layerId = layers[i].id;
        seg.style.width = `${Math.max(widthPercent, 5)}%`;
        seg.style.backgroundColor = layers[i].crossColor || layers[i].color;
        seg.title = `${layers[i].name} (${layers[i].depth})`;

        seg.addEventListener('click', () => {
          this.selectLayer(layers[i].id);
        });

        this.layerScaleBar.appendChild(seg);
      }
    }

    if (this.layerScaleLegend) {
      if (planet.id === 'earth') {
        this.layerScaleLegend.innerHTML = `
          <span>Felszín (0 km)</span>
          <span>Moho (70 km)</span>
          <span>Gutenberg (2900 km)</span>
          <span>Lehmann (5150 km)</span>
          <span>Centrum (6371 km)</span>
        `;
      } else {
        this.layerScaleLegend.innerHTML = `
          <span>Centrum (0 km)</span>
          <span>Sugárzási öv (~175 ezer km)</span>
          <span>Konvekciós öv (~490 ezer km)</span>
          <span>Fotoszféra (~696 ezer km)</span>
        `;
      }
    }

    // 3. Összefoglaló földrajzi táblázat feltöltése
    if (this.layersSummaryTableBody) {
      this.layersSummaryTableBody.innerHTML = '';
      layers.forEach(layer => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong style="color: ${layer.color}">${layer.name}</strong></td>
          <td>${layer.depth}</td>
          <td>${layer.state}</td>
          <td>${layer.temp}</td>
          <td>${layer.composition}</td>
        `;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => this.selectLayer(layer.id));
        this.layersSummaryTableBody.appendChild(row);
      });
    }

    // Alapértelmezett réteg kiválasztása (első réteg)
    if (layers.length > 0) {
      this.selectLayer(layers[0].id);
    }
  }

  selectLayer(layerId) {
    if (!this.currentPlanet || !this.currentPlanet.internalStructure) return;
    const layers = this.currentPlanet.internalStructure.layers;
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    this.selectedLayerId = layerId;

    document.querySelectorAll('.layer-selector-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layerId === layerId);
    });

    document.querySelectorAll('.layer-scale-segment').forEach(seg => {
      seg.classList.toggle('active', seg.dataset.layerId === layerId);
    });

    this.renderSelectedLayerCard(layer);
    this.renderMiniPreview(this.currentPlanet);
  }

  renderSelectedLayerCard(layer) {
    if (!this.selectedLayerCard) return;

    this.selectedLayerCard.style.borderColor = layer.color;
    this.selectedLayerCard.style.boxShadow = `0 0 25px ${layer.color}30`;

    this.selectedLayerCard.innerHTML = `
      <div class="layer-card-header">
        <div class="layer-card-title-group">
          <h4>
            <span class="layer-color-dot" style="background-color: ${layer.color}; color: ${layer.color}; box-shadow: 0 0 10px ${layer.color}"></span>
            ${layer.name}
          </h4>
          <div class="layer-card-latin">${layer.latinName || ''}</div>
        </div>
        <div class="layer-card-depth-badge">${layer.depth}</div>
      </div>

      <div class="layer-metrics-grid">
        <div class="layer-metric-item">
          <div class="layer-metric-lbl">📏 Vastagság / Kiterjedés</div>
          <div class="layer-metric-val">${layer.thicknessKm || layer.depth}</div>
        </div>
        <div class="layer-metric-item">
          <div class="layer-metric-lbl">🌡️ Hőmérséklet</div>
          <div class="layer-metric-val">${layer.temp}</div>
        </div>
        <div class="layer-metric-item">
          <div class="layer-metric-lbl">🪨 Halmazállapot</div>
          <div class="layer-metric-val">${layer.state}</div>
        </div>
        <div class="layer-metric-item">
          <div class="layer-metric-lbl">⚖️ Sűrűség / Jellemzők</div>
          <div class="layer-metric-val">${layer.density || '–'}</div>
        </div>
      </div>

      <div class="layer-desc-text">
        <strong>Anyagi összetétel:</strong> ${layer.composition}<br><br>
        ${layer.desc}
      </div>

      ${layer.geoKeyFact ? `
        <div class="geo-fact-box">
          <div class="geo-fact-badge">
            <span>💡</span>
            <span>Földrajzi összefüggés / Érettségi kulcsfogalom</span>
          </div>
          <div class="geo-fact-text">${layer.geoKeyFact}</div>
        </div>
      ` : ''}
    `;
  }

  handleCutawayCanvasPointer(e) {
    if (!this.miniPlanetCanvas || !this.currentPlanet || !this.currentPlanet.internalStructure) return;
    const rect = this.miniPlanetCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (this.miniPlanetCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (this.miniPlanetCanvas.height / rect.height);

    const cx = this.miniPlanetCanvas.width * 0.44;
    const cy = this.miniPlanetCanvas.height * 0.50;
    const maxR = this.miniPlanetCanvas.width * 0.38;

    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxR * 1.05) {
      if (this.hoveredLayerId !== null) {
        this.hoveredLayerId = null;
        this.renderMiniPreview(this.currentPlanet);
      }
      return;
    }

    const distRatio = dist / maxR;
    const layers = this.currentPlanet.internalStructure.layers;
    let foundLayer = null;

    for (let i = layers.length - 1; i >= 0; i--) {
      if (distRatio <= layers[i].radiusRatio) {
        foundLayer = layers[i];
        break;
      }
    }

    if (foundLayer && this.hoveredLayerId !== foundLayer.id) {
      this.hoveredLayerId = foundLayer.id;
      this.renderMiniPreview(this.currentPlanet);
    }
  }

  handleCutawayCanvasClick() {
    if (this.hoveredLayerId) {
      this.selectLayer(this.hoveredLayerId);
    }
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
