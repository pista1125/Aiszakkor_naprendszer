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
    this.scene.fog = new THREE.FogExp2(0x050711, 0.0012);

    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      2500
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
    const starCount = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colorPalette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xb5d4ff),
      new THREE.Color(0xfff4db),
      new THREE.Color(0xd6e5ff),
      new THREE.Color(0xffd5b3)
    ];

    for (let i = 0; i < starCount; i++) {
      const radius = 600 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const pickedColor = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = pickedColor.r;
      colors[i * 3 + 1] = pickedColor.g;
      colors[i * 3 + 2] = pickedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Csillag textúra pötty
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const starTexture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 2.8,
      vertexColors: true,
      map: starTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.starfield = new THREE.Points(geometry, material);
    this.scene.add(this.starfield);
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

    // Csillagháttér finom forgatása
    if (this.starfield) {
      this.starfield.rotation.y += 0.00015;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
