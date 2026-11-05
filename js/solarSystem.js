/**
 * solarSystem.js
 * Three.js alapú 3D Naprendszer motor.
 * Valós idejű renderelés, csillagmező, bolygópályák, kameramozgás és raycasting.
 */

import { solarSystemData } from './planetsData.js';
import { TextureGenerator } from './textureGenerator.js';

export class SolarSystemEngine {
  constructor(canvasContainer, onPlanetSelect, onHoverChange) {
    this.container = canvasContainer;
    this.onPlanetSelect = onPlanetSelect;
    this.onHoverChange = onHoverChange;

    this.textureGen = new TextureGenerator();
    this.planets = [];
    this.planetMeshes = [];
    this.orbitLines = [];
    this.focusedPlanet = null;
    this.isTracking = false;

    this.simSpeed = 1.0;
    this.isPaused = false;
    this.time = 0;
    this.mode = 'orbit'; // 'orbit' vagy 'lineup'

    // Valódi csillagászati méretarány skálázási szorzók (a Föld átmérője = 109× kisebb a Napnál!)
    // Föld cél-sugara = 1.30 egység
    this.lineupScales = {
      sun: 10.15,      // 14.0 * 10.15 = 142.1 sugár (~109.3× a Föld sugara!)
      mercury: 0.278,  // 1.8 * 0.278 = 0.50 sugár (0.38× Föld)
      venus: 0.386,    // 3.2 * 0.386 = 1.23 sugár (0.95× Föld)
      earth: 0.382,    // 3.4 * 0.382 = 1.30 sugár (1.00× Föld bázis)
      mars: 0.301,     // 2.3 * 0.301 = 0.69 sugár (0.53× Föld)
      jupiter: 2.098,  // 6.8 * 2.098 = 14.26 sugár (10.97× Föld)
      saturn: 2.122,   // 5.6 * 2.122 = 11.88 sugár (9.14× Föld)
      uranus: 1.232,   // 4.2 * 1.232 = 5.18 sugár (3.98× Föld)
      neptune: 1.256,  // 4.0 * 1.256 = 5.02 sugár (3.86× Föld)
      pluto: 0.202     // 1.2 * 0.202 = 0.24 sugár (0.19× Föld)
    };

    // Pontos pozíciók az X tengely mentén a hatalmas Nap mellett
    this.lineupPositions = {
      sun: -170,       // jobb széle: -170 + 142.1 = -27.9
      mercury: -21,    // picurka pont a Nap pereme mellett
      venus: -14,
      earth: -6,
      mars: 2,
      jupiter: 30,     // gázóriás (sugár: 14.3)
      saturn: 82,      // gyűrűkkel együtt (sugár: 11.9, gyűrű: 27.5)
      uranus: 128,     // jégóriás (sugár: 5.2)
      neptune: 147,    // jégóriás (sugár: 5.0)
      pluto: 160       // törpebolygó (sugár: 0.24)
    };

    // Kamera célpontok az animációhoz
    this.cameraTarget = {
      position: new THREE.Vector3(0, 160, 240),
      lookAt: new THREE.Vector3(0, 0, 0)
    };
    this.isTransitioning = false;
    this.transitionProgress = 1.0;
    this.startCamPos = new THREE.Vector3();
    this.startCamLookAt = new THREE.Vector3();

    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.hoveredPlanet = null;

    this.initScene();
    this.initLights();
    this.initStarfield();
    this.initCelestialBodies();
    this.setupInteractions();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setMode(newMode) {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.focusedPlanet = null;
    this.isTracking = false;

    if (newMode === 'lineup') {
      // Pályavonalak elrejtése méretarány módban
      this.orbitLines.forEach(line => line.visible = false);
      this.ambientLight.intensity = 1.3;
      // Kamera átmozgatása panoráma szemből nézetbe (úgy, hogy a hatalmas Nap és a bolygók is látszódjanak)
      this.flyCameraTo(
        new THREE.Vector3(25, 2, 280),
        new THREE.Vector3(25, 0, 0)
      );
    } else {
      // Keringési pályák visszakapcsolása
      this.orbitLines.forEach(line => line.visible = true);
      this.ambientLight.intensity = 0.7;
      // Kamera visszamozgatása 3D perspektíva nézetbe
      this.flyCameraTo(
        new THREE.Vector3(0, 160, 240),
        new THREE.Vector3(0, 0, 0)
      );
    }

    if (this.onPlanetSelect) {
      this.onPlanetSelect(null);
    }
  }

  initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.5,
      6000
    );
    this.camera.position.copy(this.cameraTarget.position);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 750;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.15; // enyhén alulról is nézhető

    window.addEventListener('resize', () => this.onWindowResize());
  }

  initLights() {
    // Központi Nap fényforrás (minden bolygót ez világít meg)
    this.sunLight = new THREE.PointLight(0xfff3d6, 3.2, 800, 0.4);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);

    // Finom környezeti fény a sötét oldalak láthatóságáért
    this.ambientLight = new THREE.AmbientLight(0x242d45, 0.7);
    this.scene.add(this.ambientLight);

    // Gyenge lágy másodlagos kitöltőfény felülről
    const hemisphereLight = new THREE.HemisphereLight(0x3a4b6e, 0x050814, 0.4);
    this.scene.add(hemisphereLight);
  }

  initStarfield() {
    this.starGroup = new THREE.Group();
    this.starfield = this.starGroup;

    // 1. Procedurális csillag és köd textúrák generálása Canvas segítségével
    const starTexture = this.createStarTexture();
    const flareStarTexture = this.createFlareStarTexture();
    const nebulaCloudTexture = this.createNebulaCloudTexture();

    // 2. Sűrű, távoli csillagpor (10 000 csillag valós csillagászati színosztályokkal)
    this.buildDistantStars(starTexture);

    // 3. Valós idejű pislákoló csillagok (GPU shader animációval)
    this.buildTwinklingStars(starTexture);

    // 4. Kiemelkedő fényes főcsillagok kereszttüskés diffrakciós ragyogással (Hubble/JWST stílus)
    this.buildMajorStars(flareStarTexture);

    // 5. A Tejút galaktikus sávja (4 500 részecske a döntött galaktikus síkban)
    this.buildMilkyWay(starTexture);

    // 6. Eterikus, színes mélyűri gázködök (Orion és Cygnus köd komplexumok)
    this.buildNebulae(nebulaCloudTexture);

    // 7. Hullócsillag (meteor) rendszer előkészítése
    this.initMeteors();

    this.scene.add(this.starGroup);
  }

  createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.45, 'rgba(230, 240, 255, 0.4)');
    grad.addColorStop(0.75, 'rgba(200, 225, 255, 0.08)');
    grad.addColorStop(1, 'rgba(200, 220, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  createFlareStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cx = 64, cy = 64;

    // Központi ragyogó fényudvar
    const haloGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 56);
    haloGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    haloGrad.addColorStop(0.15, 'rgba(240, 248, 255, 0.9)');
    haloGrad.addColorStop(0.4, 'rgba(180, 215, 255, 0.3)');
    haloGrad.addColorStop(0.8, 'rgba(150, 190, 255, 0.06)');
    haloGrad.addColorStop(1, 'rgba(150, 190, 255, 0)');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(0, 0, 128, 128);

    // Fő vízszintes kereszttüske
    const spikeH = ctx.createLinearGradient(0, cy, 128, cy);
    spikeH.addColorStop(0, 'rgba(255, 255, 255, 0)');
    spikeH.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
    spikeH.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    spikeH.addColorStop(0.65, 'rgba(255, 255, 255, 0.25)');
    spikeH.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spikeH;
    ctx.fillRect(0, cy - 1.5, 128, 3);

    // Fő függőleges kereszttüske
    const spikeV = ctx.createLinearGradient(cx, 0, cx, 128);
    spikeV.addColorStop(0, 'rgba(255, 255, 255, 0)');
    spikeV.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
    spikeV.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    spikeV.addColorStop(0.65, 'rgba(255, 255, 255, 0.25)');
    spikeV.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spikeV;
    ctx.fillRect(cx - 1.5, 0, 3, 128);

    // Finom átlós diffrakciós sugarak
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const diag = ctx.createLinearGradient(-45, 0, 45, 0);
    diag.addColorStop(0, 'rgba(255, 255, 255, 0)');
    diag.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
    diag.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = diag;
    ctx.fillRect(-45, -0.75, 90, 1.5);
    ctx.restore();

    return new THREE.CanvasTexture(canvas);
  }

  createNebulaCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const cx = 64, cy = 64;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.14)');
    grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.03)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }

  buildDistantStars(texture) {
    const starCount = 10000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    // Valós csillagászati színpaletta (O, B, A, F, G, K, M színképosztályok)
    const palette = [
      new THREE.Color(0xaec9ff), // Kékesfehér O/B
      new THREE.Color(0xcad7ff),
      new THREE.Color(0xffffff), // Tiszta fehér A
      new THREE.Color(0xf6f8ff),
      new THREE.Color(0xfff3e0), // Meleg fehér Nap-szerű F/G
      new THREE.Color(0xffe8cc),
      new THREE.Color(0xffd1a4), // Aranyló narancs K
      new THREE.Color(0xff9d7a)  // Vörös óriás M
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 1200 + Math.random() * 1400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const color = palette[Math.floor(Math.random() * palette.length)];
      const lum = 0.55 + Math.random() * 0.45;
      colors[i * 3] = color.r * lum;
      colors[i * 3 + 1] = color.g * lum;
      colors[i * 3 + 2] = color.b * lum;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.4,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, material);
    this.starGroup.add(points);
  }

  buildTwinklingStars(texture) {
    const starCount = 1500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const speeds = new Float32Array(starCount);
    const phases = new Float32Array(starCount);

    const palette = [
      new THREE.Color(0xa8c5ff),
      new THREE.Color(0xdbe6ff),
      new THREE.Color(0xffffff),
      new THREE.Color(0xffeed6),
      new THREE.Color(0xffcca0),
      new THREE.Color(0x93c5fd)
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 1000 + Math.random() * 1300;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = 3.2 + Math.random() * 3.6;
      speeds[i] = 1.2 + Math.random() * 4.0;
      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aTwinklePhase', new THREE.BufferAttribute(phases, 1));

    this.twinkleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: texture }
      },
      vertexShader: `
        attribute float aSize;
        attribute float aTwinkleSpeed;
        attribute float aTwinklePhase;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vColor = color;
          float twinkle = 0.35 + 0.65 * sin(uTime * aTwinkleSpeed + aTwinklePhase);
          vAlpha = twinkle;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (480.0 / -mvPosition.z) * (0.75 + 0.35 * twinkle);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec4 tex = texture2D(uTexture, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, this.twinkleMaterial);
    this.starGroup.add(points);
  }

  buildMajorStars(texture) {
    const starCount = 420;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const brightPalette = [
      new THREE.Color(0x9bc2ff), // Rigel / Vega kékes ragyogás
      new THREE.Color(0xffffff), // Sirius ragyogó fehér
      new THREE.Color(0xffeedb), // Capella aranyfehér
      new THREE.Color(0xffba77), // Betelgeuse narancssárga óriás
      new THREE.Color(0x7dd3fc)  // Halvány ciánkék csillag
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 950 + Math.random() * 1150;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const c = brightPalette[Math.floor(Math.random() * brightPalette.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 9.5,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, material);
    this.starGroup.add(points);
  }

  buildMilkyWay(texture) {
    const count = 4500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Galaktikus sík orientációja (~58 fok döntés az ekliptikához képest)
    const tiltX = THREE.MathUtils.degToRad(58);
    const tiltZ = THREE.MathUtils.degToRad(25);
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);

    const mwPalette = [
      new THREE.Color(0x60a5fa), // Galaktikus kék
      new THREE.Color(0x818cf8), // Ibolyakék
      new THREE.Color(0xc084fc), // Finom lila
      new THREE.Color(0xe879f9), // Magenta csillagpor
      new THREE.Color(0xfde047), // Galaktikus magfény
      new THREE.Color(0xffffff)
    ];

    for (let i = 0; i < count; i++) {
      const radius = 1300 + Math.random() * 850;
      const theta = Math.random() * Math.PI * 2;

      // Normáleloszlás: a galaktikus sík mentén sűrűbb, távolodva ritkul
      const u1 = Math.random(), u2 = Math.random();
      const randNormal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      const lat = randNormal * 0.13; // Galaktikus szélesség

      // Alap galaktikus koordináták
      let x = radius * Math.cos(lat) * Math.cos(theta);
      let y = radius * Math.sin(lat);
      let z = radius * Math.cos(lat) * Math.sin(theta);

      // Galaktikus mag sűrűsödés
      const isCore = Math.abs(Math.sin(theta * 0.5)) < 0.28;

      // Elforgatás az ekliptikai koordinátarendszerbe
      const x1 = x * cosZ - y * sinZ;
      const y1 = x * sinZ + y * cosZ;
      const z1 = z;

      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      positions[i * 3] = x1;
      positions[i * 3 + 1] = y2;
      positions[i * 3 + 2] = z2;

      const baseCol = isCore
        ? mwPalette[4 + Math.floor(Math.random() * 2)]
        : mwPalette[Math.floor(Math.random() * (mwPalette.length - 2))];

      const brightness = (0.45 + Math.random() * 0.55) * (isCore ? 1.3 : 0.85);
      colors[i * 3] = Math.min(1.0, baseCol.r * brightness);
      colors[i * 3 + 1] = Math.min(1.0, baseCol.g * brightness);
      colors[i * 3 + 2] = Math.min(1.0, baseCol.b * brightness);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 4.2,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, material);
    this.starGroup.add(points);
  }

  buildNebulae(texture) {
    const count = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Három lélegzetelállító mélyűri gázköd klaszter
    const clusters = [
      {
        center: new THREE.Vector3(1000, 420, -800),
        color: new THREE.Color(0x9333ea), // Orion-típusú lila / magenta köd
        spread: 320,
        count: 70
      },
      {
        center: new THREE.Vector3(-900, -380, 750),
        color: new THREE.Color(0x06b6d4), // Cygnus / Fátyol-köd ciánkék
        spread: 350,
        count: 65
      },
      {
        center: new THREE.Vector3(-450, 720, -1000),
        color: new THREE.Color(0x3b82f6), // Kozmikus mélykék zafír köd
        spread: 280,
        count: 45
      }
    ];

    let idx = 0;
    clusters.forEach(cluster => {
      for (let i = 0; i < cluster.count; i++) {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * cluster.spread * 2,
          (Math.random() - 0.5) * cluster.spread * 1.5,
          (Math.random() - 0.5) * cluster.spread * 2
        );
        const pos = cluster.center.clone().add(offset);
        positions[idx * 3] = pos.x;
        positions[idx * 3 + 1] = pos.y;
        positions[idx * 3 + 2] = pos.z;

        const tint = cluster.color.clone();
        tint.offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.15);

        colors[idx * 3] = tint.r;
        colors[idx * 3 + 1] = tint.g;
        colors[idx * 3 + 2] = tint.b;
        idx++;
      }
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 155.0,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    const points = new THREE.Points(geometry, material);
    this.starGroup.add(points);
  }

  initMeteors() {
    this.meteors = [];
    this.meteorCooldown = 2.5 + Math.random() * 3.0; // Időzítő az első hullócsillaghoz
    this.meteorGroup = new THREE.Group();
    this.starGroup.add(this.meteorGroup);

    // Meteor pool: 2 újrahasznosítható vonal
    for (let i = 0; i < 2; i++) {
      const maxTrailPoints = 20;
      const positions = new Float32Array(maxTrailPoints * 3);
      const alphas = new Float32Array(maxTrailPoints);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xd4f1f9) },
          uOpacity: { value: 1.0 }
        },
        vertexShader: `
          attribute float aAlpha;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying float vAlpha;
          void main() {
            gl_FragColor = vec4(uColor, vAlpha * uOpacity);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        linewidth: 2
      });

      const line = new THREE.Line(geo, mat);
      line.visible = false;
      this.meteorGroup.add(line);

      this.meteors.push({
        line,
        active: false,
        pos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        trail: [],
        maxTrailPoints,
        life: 0,
        maxLife: 0.8
      });
    }
  }

  spawnMeteor() {
    const meteor = this.meteors.find(m => !m.active);
    if (!meteor) return;

    // Véletlenszerű kezdőpont a kozmikus gömbön
    const radius = 1100 + Math.random() * 300;
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.3 + Math.random() * 1.1;

    meteor.pos.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );

    // Érintőleges sebességvektor átlósan lefelé
    const tangent = new THREE.Vector3(
      -Math.sin(theta) + (Math.random() - 0.5) * 0.4,
      -0.6 - Math.random() * 0.4,
      Math.cos(theta) + (Math.random() - 0.5) * 0.4
    ).normalize();

    const speed = 1300 + Math.random() * 600;
    meteor.velocity.copy(tangent).multiplyScalar(speed);

    meteor.trail = [meteor.pos.clone()];
    meteor.life = 0;
    meteor.maxLife = 0.65 + Math.random() * 0.35;
    meteor.active = true;
    meteor.line.visible = true;

    // Jégkék vagy aranyló hullócsillag
    const isGold = Math.random() > 0.65;
    meteor.line.material.uniforms.uColor.value.set(isGold ? 0xfff0b8 : 0xccf2ff);
  }

  updateMeteors(delta) {
    if (!this.meteors) return;

    this.meteorCooldown -= delta;
    if (this.meteorCooldown <= 0) {
      this.spawnMeteor();
      this.meteorCooldown = 3.5 + Math.random() * 4.5; // 3.5 - 8.0 mp múlva a következő
    }

    this.meteors.forEach(m => {
      if (!m.active) return;

      m.life += delta;
      if (m.life >= m.maxLife) {
        m.active = false;
        m.line.visible = false;
        return;
      }

      // Mozgatás
      m.pos.addScaledVector(m.velocity, delta);

      // Csóva / Trail pontok
      m.trail.unshift(m.pos.clone());
      if (m.trail.length > m.maxTrailPoints) {
        m.trail.pop();
      }

      // Geometria frissítése
      const posAttr = m.line.geometry.getAttribute('position');
      const alphaAttr = m.line.geometry.getAttribute('aAlpha');

      const progress = m.life / m.maxLife;
      let globalOpacity = 1.0;
      if (progress < 0.2) {
        globalOpacity = progress / 0.2;
      } else {
        globalOpacity = 1.0 - (progress - 0.2) / 0.8;
      }
      m.line.material.uniforms.uOpacity.value = globalOpacity;

      for (let i = 0; i < m.maxTrailPoints; i++) {
        if (i < m.trail.length) {
          posAttr.setXYZ(i, m.trail[i].x, m.trail[i].y, m.trail[i].z);
          alphaAttr.setX(i, 1.0 - (i / m.maxTrailPoints));
        } else {
          posAttr.setXYZ(i, m.pos.x, m.pos.y, m.pos.z);
          alphaAttr.setX(i, 0);
        }
      }

      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    });
  }

  initCelestialBodies() {
    solarSystemData.forEach((data) => {
      const textureCanvas = this.textureGen.getTextureForPlanet(data.id);
      const texture = new THREE.CanvasTexture(textureCanvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;

      if (data.id === 'sun') {
        // --- NAP ---
        const sunRoot = new THREE.Group();
        sunRoot.userData = { data, isPlanet: true };

        const sunGeo = new THREE.SphereGeometry(data.size3D, 64, 64);
        const sunMat = new THREE.MeshBasicMaterial({
          map: texture,
          color: 0xffffff
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunRoot.add(sunMesh);

        // Nap korona / ragyogás (halo effekt)
        const coronaGeo = new THREE.SphereGeometry(data.size3D * 1.25, 32, 32);
        const coronaMat = new THREE.ShaderMaterial({
          uniforms: {
            glowColor: { value: new THREE.Color(0xff8811) }
          },
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vNormal;
            uniform vec3 glowColor;
            void main() {
              float intensity = pow(0.68 - dot(vNormal, vec3(0, 0, 1.0)), 2.2);
              gl_FragColor = vec4(glowColor, intensity * 0.7);
            }
          `,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true
        });
        const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
        sunRoot.add(coronaMesh);

        // 3D Belső metszet modell a Naphoz
        let cutawayGroup = null;
        if (data.internalStructure) {
          cutawayGroup = this.buildCutawayMesh(data, data.size3D, texture);
          sunRoot.add(cutawayGroup);
        }

        this.scene.add(sunRoot);

        this.planets.push({
          data,
          mesh: sunRoot,
          normalMesh: sunMesh,
          coronaMesh: coronaMesh,
          cutawayGroup: cutawayGroup,
          isCutaway: false,
          pivot: null,
          angle: 0
        });
        this.planetMeshes.push(sunRoot);

      } else {
        // --- BOLYGÓK ---
        // 1. Keringési pálya vonala (Orbit ring)
        const orbitCurve = new THREE.EllipseCurve(
          0, 0,
          data.orbitRadius3D, data.orbitRadius3D,
          0, 2 * Math.PI,
          false, 0
        );
        const points = orbitCurve.getPoints(120);
        const orbitGeo = new THREE.BufferGeometry().setFromPoints(
          points.map(p => new THREE.Vector3(p.x, 0, p.y))
        );
        const orbitMat = new THREE.LineBasicMaterial({
          color: 0x4a6fa5,
          transparent: true,
          opacity: 0.28,
          linewidth: 1
        });
        const orbitLine = new THREE.Line(orbitGeo, orbitMat);
        this.scene.add(orbitLine);
        this.orbitLines.push(orbitLine);

        // 2. Bolygó test (Gyökér csoport)
        const planetRoot = new THREE.Group();
        planetRoot.userData = { data, isPlanet: true };

        const planetGeo = new THREE.SphereGeometry(data.size3D, 48, 48);
        const planetMat = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.8,
          metalness: 0.1
        });
        const planetMesh = new THREE.Mesh(planetGeo, planetMat);
        planetRoot.add(planetMesh);

        // 3D Belső metszet modell (pl. Föld esetén)
        let cutawayGroup = null;
        if (data.internalStructure) {
          cutawayGroup = this.buildCutawayMesh(data, data.size3D, texture);
          planetRoot.add(cutawayGroup);
        }

        // Véletlenszerű kezdőpozíció a pályán, hogy ne egy vonalban álljanak
        const startAngle = Math.random() * Math.PI * 2;
        planetRoot.position.set(
          Math.cos(startAngle) * data.orbitRadius3D,
          0,
          Math.sin(startAngle) * data.orbitRadius3D
        );

        // Tengelyferdeség (döntés)
        if (data.id === 'uranus') {
          planetRoot.rotation.z = THREE.MathUtils.degToRad(97.8);
        } else if (data.id === 'earth') {
          planetRoot.rotation.z = THREE.MathUtils.degToRad(23.4);
        } else if (data.id === 'saturn') {
          planetRoot.rotation.z = THREE.MathUtils.degToRad(26.7);
        } else if (data.id === 'mars') {
          planetRoot.rotation.z = THREE.MathUtils.degToRad(25.2);
        }

        // Szaturnusz gyűrű hozzáadása
        if (data.hasRings) {
          const ringTextureCanvas = this.textureGen.getSaturnRingTexture();
          const ringTexture = new THREE.CanvasTexture(ringTextureCanvas);

          const ringGeo = new THREE.RingGeometry(data.ringInnerRadius, data.ringOuterRadius, 64);
          ringGeo.rotateX(Math.PI / 2);

          const ringMat = new THREE.MeshStandardMaterial({
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            roughness: 0.5,
            metalness: 0.1
          });
          const ringMesh = new THREE.Mesh(ringGeo, ringMat);
          planetRoot.add(ringMesh);
        }

        // Föld körül keringő Hold
        if (data.id === 'earth') {
          const moonGeo = new THREE.SphereGeometry(0.7, 24, 24);
          const moonMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.9
          });
          const moonMesh = new THREE.Mesh(moonGeo, moonMat);
          moonMesh.position.set(5.5, 0, 0);
          planetRoot.add(moonMesh);
          planetRoot.userData.moon = moonMesh;
        }

        this.scene.add(planetRoot);
        this.planetMeshes.push(planetRoot);

        this.planets.push({
          data,
          mesh: planetRoot,
          normalMesh: planetMesh,
          cutawayGroup: cutawayGroup,
          isCutaway: false,
          angle: startAngle
        });
      }
    });
  }

  setupInteractions() {
    const getPointerPos = (e) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    let pointerDownPos = { x: 0, y: 0 };
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    this.renderer.domElement.addEventListener('pointermove', (e) => {
      getPointerPos(e);
      this.checkHover();
    });

    this.renderer.domElement.addEventListener('pointerup', (e) => {
      // Csak akkor tekintjük kattintásnak, ha nem húzta el (drag) a kamerát
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist < 6) {
        getPointerPos(e);
        this.checkClick();
      }
    });
  }

  checkHover() {
    if (this.isTransitioning) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.planetMeshes, true);

    if (intersects.length > 0) {
      let topMesh = intersects[0].object;
      while (topMesh.parent && !topMesh.userData.isPlanet) {
        topMesh = topMesh.parent;
      }

      if (topMesh && topMesh.userData.isPlanet) {
        this.container.style.cursor = 'pointer';
        const planetData = topMesh.userData.data;
        if (this.hoveredPlanet !== planetData) {
          this.hoveredPlanet = planetData;
          if (this.onHoverChange) this.onHoverChange(planetData);
        }
        return;
      }
    }

    if (this.hoveredPlanet !== null) {
      this.hoveredPlanet = null;
      this.container.style.cursor = 'default';
      if (this.onHoverChange) this.onHoverChange(null);
    }
  }

  checkClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.planetMeshes, true);

    if (intersects.length > 0) {
      let topMesh = intersects[0].object;
      while (topMesh.parent && !topMesh.userData.isPlanet) {
        topMesh = topMesh.parent;
      }

      if (topMesh && topMesh.userData.isPlanet) {
        const planetData = topMesh.userData.data;
        this.selectPlanet(planetData.id);
      }
    }
  }

  selectPlanet(planetId) {
    const target = this.planets.find(p => p.data.id === planetId);
    if (!target) return;

    this.focusedPlanet = target;
    this.isTracking = (this.mode === 'orbit' && target.data.id !== 'sun');

    // Kiszámítjuk az ideális kameratávolságot a bolygó aktuális méretéből
    const currentScale = this.mode === 'lineup' ? (this.lineupScales[target.data.id] || 1.0) : 1.0;
    const effectiveSize = target.data.size3D * currentScale;

    const distanceOffset = target.data.id === 'sun'
      ? effectiveSize * (this.mode === 'lineup' ? 2.5 : 3.8)
      : target.data.hasRings
        ? (target.data.ringOuterRadius * currentScale) * 2.2
        : Math.max(effectiveSize * (this.mode === 'lineup' ? 4.5 : 4.2), 6.5);

    const targetPos = target.mesh.position.clone();
    
    // Kamera pozíciója a mód függvényében
    let camOffset;
    if (this.mode === 'lineup') {
      camOffset = new THREE.Vector3(0, distanceOffset * 0.15, distanceOffset * 1.05);
    } else {
      camOffset = new THREE.Vector3(
        distanceOffset * 0.7,
        distanceOffset * 0.45,
        distanceOffset * 0.85
      );
    }

    this.flyCameraTo(
      targetPos.clone().add(camOffset),
      targetPos
    );

    if (this.onPlanetSelect) {
      this.onPlanetSelect(target.data);
    }
  }

  resetView() {
    this.focusedPlanet = null;
    this.isTracking = false;

    if (this.mode === 'lineup') {
      this.flyCameraTo(
        new THREE.Vector3(25, 2, 280),
        new THREE.Vector3(25, 0, 0)
      );
    } else {
      this.flyCameraTo(
        new THREE.Vector3(0, 160, 240),
        new THREE.Vector3(0, 0, 0)
      );
    }

    if (this.onPlanetSelect) {
      this.onPlanetSelect(null);
    }
  }

  /**
   * 3D Belső rétegmetszet (Cutaway) modell felépítése a Földhöz és a Naphoz
   */
  buildCutawayMesh(data, size3D, texture) {
    const cutawayGroup = new THREE.Group();
    cutawayGroup.name = `cutaway_${data.id}`;
    cutawayGroup.visible = false;

    const isSun = (data.id === 'sun');
    const layers = data.internalStructure ? data.internalStructure.layers : [];

    // 1. Külső 3/4 gömbhéj (270 fokos ív, 90 fokos nyitással a belső rétegekhez)
    const outerGeo = new THREE.SphereGeometry(size3D, 48, 48, 0, Math.PI * 1.5, 0, Math.PI);
    let outerMat;
    if (isSun) {
      outerMat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });
    } else {
      outerMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
    }
    const outerShell = new THREE.Mesh(outerGeo, outerMat);
    cutawayGroup.add(outerShell);

    // 2. Két sík keresztmetszeti fal generálása
    const sliceCanvas = this.generateSliceCanvas(layers, isSun);
    const sliceTexture = new THREE.CanvasTexture(sliceCanvas);
    sliceTexture.wrapS = THREE.ClampToEdgeWrapping;
    sliceTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Félkör a nyitás két falának lefedéséhez (-PI/2 -től +PI/2 -ig, átmérő az Y tengelyen)
    const sliceGeo = new THREE.CircleGeometry(size3D, 64, -Math.PI / 2, Math.PI);
    const sliceMat = isSun
      ? new THREE.MeshBasicMaterial({ map: sliceTexture, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ map: sliceTexture, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });

    // 1. Félkör a Z = 0 síkban, X >= 0
    const slice1 = new THREE.Mesh(sliceGeo, sliceMat);
    cutawayGroup.add(slice1);

    // 2. Félkör elforgatva a Z <= 0 síkba (X = 0)
    const slice2 = new THREE.Mesh(sliceGeo, sliceMat);
    slice2.rotation.y = Math.PI * 1.5;
    cutawayGroup.add(slice2);

    // 3. Koncentrikus belső 3/4 gömbhéjak és központi mag
    layers.forEach((layer, idx) => {
      if (layer.radiusRatio >= 1.0) return;
      const r = size3D * layer.radiusRatio;
      if (r <= 0.05) return;

      if (idx === layers.length - 1) {
        // Legbelső mag - teljes 3D ragyogó gömb
        const coreGeo = new THREE.SphereGeometry(r, 32, 32);
        let coreMat;
        if (isSun) {
          coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff
          });
        } else {
          coreMat = new THREE.MeshStandardMaterial({
            color: 0xfffde7,
            emissive: 0xffecb3,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.7
          });
        }
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        cutawayGroup.add(coreMesh);
      } else {
        // Közbenső rétegek 3/4 gömbhéjai
        const shellGeo = new THREE.SphereGeometry(r, 32, 32, 0, Math.PI * 1.5, 0, Math.PI);
        const col = new THREE.Color(layer.color || 0xffffff);
        const shellMat = isSun
          ? new THREE.MeshBasicMaterial({ color: col, side: THREE.BackSide, transparent: true, opacity: 0.8 })
          : new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.15, side: THREE.BackSide, transparent: true, opacity: 0.85 });
        const shellMesh = new THREE.Mesh(shellGeo, shellMat);
        cutawayGroup.add(shellMesh);
      }
    });

    return cutawayGroup;
  }

  /**
   * Keresztmetszeti textúra rajzolása a metszet lapjaihoz
   */
  generateSliceCanvas(layers, isSun) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const cx = 256;
    const cy = 256;
    const maxR = 256;

    ctx.clearRect(0, 0, 512, 512);

    // Rétegek kirajzolása kívülről befelé haladva
    layers.forEach((layer, idx) => {
      const r = maxR * layer.radiusRatio;
      if (r <= 0) return;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);

      if (idx === layers.length - 1) {
        // Mag - sugárzó gradiens
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        if (isSun) {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.5, '#fff9c4');
          grad.addColorStop(1, '#ffc107');
        } else {
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.5, '#fff9c4');
          grad.addColorStop(1, '#ffe082');
        }
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = layer.crossColor || layer.color;
      }
      ctx.fill();

      // Határvonal
      ctx.strokeStyle = isSun ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.28)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });

    return canvas;
  }

  /**
   * Bolygó 3D metszetének ki- és bekapcsolása
   */
  setPlanetCutaway(planetId, enabled) {
    const planet = this.planets.find(p => p.data.id === planetId);
    if (!planet || !planet.cutawayGroup) return false;

    planet.isCutaway = !!enabled;
    if (planet.normalMesh) planet.normalMesh.visible = !enabled;
    if (planet.cutawayGroup) planet.cutawayGroup.visible = !!enabled;

    if (planet.data.id === 'sun' && planet.coronaMesh) {
      planet.coronaMesh.visible = !enabled;
    }

    if (enabled) {
      planet.mesh.rotation.y = Math.PI * 0.35;
    }

    return planet.isCutaway;
  }

  isPlanetCutaway(planetId) {
    const planet = this.planets.find(p => p.data.id === planetId);
    return planet ? !!planet.isCutaway : false;
  }

  flyCameraTo(targetCamPos, targetLookAt) {
    this.startCamPos.copy(this.camera.position);
    this.startCamLookAt.copy(this.controls.target);

    this.cameraTarget.position.copy(targetCamPos);
    this.cameraTarget.lookAt.copy(targetLookAt);

    this.transitionProgress = 0.0;
    this.isTransitioning = true;
  }

  setSpeed(speed) {
    this.simSpeed = speed;
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);

    const delta = 0.016;

    // Időszimuláció és mozgás
    if (!this.isPaused) {
      this.time += delta * this.simSpeed;

      if (this.mode === 'lineup') {
        // --- VALÓDI CSILLAGÁSZATI MÉRETARÁNY SORBARENDEZÉS MÓD ---
        this.planets.forEach((p) => {
          // Tengely körüli forgás folytatódik
          p.mesh.rotation.y += p.data.rotationSpeed * this.simSpeed;

          // Valódi méretarány szerinti dinamikus skálázás folyamatos lerp-pel
          const s = this.lineupScales[p.data.id] || 1.0;
          p.mesh.scale.lerp(new THREE.Vector3(s, s, s), 0.08);

          // Sima átmozgatás az egyenes sorba
          const targetX = this.lineupPositions[p.data.id] ?? 0;
          p.mesh.position.lerp(new THREE.Vector3(targetX, 0, 0), 0.06);

          // Szaturnusz dőlése szemből látványos
          if (p.data.id === 'saturn') {
            p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, 0.4, 0.05);
          }

          if (p.mesh.userData.moon) {
            p.mesh.userData.moon.scale.set(0.27, 0.27, 0.27);
            p.mesh.userData.moon.position.set(0, 3.2, 0);
          }
        });

        // Fényforrás követi a Napot
        const sun = this.planets.find(p => p.data.id === 'sun');
        if (sun) {
          this.sunLight.position.copy(sun.mesh.position);
        }

      } else {
        // --- 3D KERINGÉSI PÁLYA MÓD ---
        this.planets.forEach((p) => {
          // Visszaskálázás az alapértelmezett (1,1,1) látványos pályaméretre
          p.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.08);

          // Saját tengely körüli forgás
          p.mesh.rotation.y += p.data.rotationSpeed * this.simSpeed;

          // Pályán való keringés (Nap a helyén marad)
          if (p.data.orbitRadius3D > 0) {
            // Látványos, azonnal érzékelhető keringési sebesség
            p.angle += p.data.orbitSpeed * 18.0 * this.simSpeed * delta;
            const targetX = Math.cos(p.angle) * p.data.orbitRadius3D;
            const targetZ = Math.sin(p.angle) * p.data.orbitRadius3D;
            p.mesh.position.lerp(new THREE.Vector3(targetX, 0, targetZ), 0.08);

            // Hold forgatása a Föld körül
            if (p.mesh.userData.moon) {
              const moon = p.mesh.userData.moon;
              moon.scale.set(1, 1, 1);
              const moonAngle = this.time * 3.5;
              moon.position.x = Math.cos(moonAngle) * 5.5;
              moon.position.z = Math.sin(moonAngle) * 5.5;
            }
          } else {
            // Nap visszatér a (0,0,0) pontra
            p.mesh.position.lerp(new THREE.Vector3(0, 0, 0), 0.08);
          }
        });

        // Fényforrás vissza a centrumba
        this.sunLight.position.set(0, 0, 0);
      }
    }

    // Kamera interpoláció (Smooth fly-to)
    if (this.isTransitioning) {
      this.transitionProgress += delta * 1.5;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.isTransitioning = false;
      }

      // Sima ease-in-out görbe
      const t = this.transitionProgress;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(this.startCamPos, this.cameraTarget.position, ease);
      this.controls.target.lerpVectors(this.startCamLookAt, this.cameraTarget.lookAt, ease);
    } else if (this.isTracking && this.focusedPlanet && this.mode === 'orbit') {
      // Követjük a bolygót a pályáján
      const targetPos = this.focusedPlanet.mesh.position;
      const deltaPos = targetPos.clone().sub(this.controls.target);
      this.controls.target.copy(targetPos);
      this.camera.position.add(deltaPos);
    }

    // Kozmikus háttéridő frissítése (akkor is finoman pislákol, ha a szimuláció áll)
    this.bgTime = (this.bgTime || 0) + delta;

    // Csillagháttér fenséges, lassú forgatása
    if (this.starGroup) {
      this.starGroup.rotation.y += 0.00012;
      this.starGroup.rotation.x += 0.00003;
    }

    // Pislákoló csillagok GPU animációja
    if (this.twinkleMaterial) {
      this.twinkleMaterial.uniforms.uTime.value = this.bgTime;
    }

    // Hullócsillagok (Meteors) léptetése
    if (this.meteors) {
      this.updateMeteors(delta);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
