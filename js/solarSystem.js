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

    // Méretarány / Felsorakoztatási pozíciók az X tengely mentén (Nap és 9 bolygó)
    this.lineupPositions = {
      sun: -120,
      mercury: -88,
      venus: -74,
      earth: -58,
      mars: -44,
      jupiter: -16,
      saturn: 20,
      uranus: 58,
      neptune: 84,
      pluto: 104
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
      // Kamera sima átmozgatása panoráma szemből nézetbe
      this.flyCameraTo(
        new THREE.Vector3(-10, 4, 195),
        new THREE.Vector3(-10, 0, 0)
      );
    } else {
      // Keringési pályák visszakapcsolása
      this.orbitLines.forEach(line => line.visible = true);
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
        const sunGeo = new THREE.SphereGeometry(data.size3D, 64, 64);
        const sunMat = new THREE.MeshBasicMaterial({
          map: texture,
          color: 0xffffff
        });
        const sunMesh = new THREE.Mesh(sunGeo, sunMat);
        sunMesh.userData = { data, isPlanet: true };
        this.scene.add(sunMesh);

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
        sunMesh.add(coronaMesh);

        this.planets.push({
          data,
          mesh: sunMesh,
          pivot: null,
          angle: 0
        });
        this.planetMeshes.push(sunMesh);

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

        // 2. Bolygó test
        const planetGeo = new THREE.SphereGeometry(data.size3D, 48, 48);
        const planetMat = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.8,
          metalness: 0.1
        });
        const planetMesh = new THREE.Mesh(planetGeo, planetMat);
        planetMesh.userData = { data, isPlanet: true };

        // Véletlenszerű kezdőpozíció a pályán, hogy ne egy vonalban álljanak
        const startAngle = Math.random() * Math.PI * 2;
        planetMesh.position.set(
          Math.cos(startAngle) * data.orbitRadius3D,
          0,
          Math.sin(startAngle) * data.orbitRadius3D
        );

        // Tengelyferdeség (döntés)
        if (data.id === 'uranus') {
          planetMesh.rotation.z = THREE.MathUtils.degToRad(97.8);
        } else if (data.id === 'earth') {
          planetMesh.rotation.z = THREE.MathUtils.degToRad(23.4);
        } else if (data.id === 'saturn') {
          planetMesh.rotation.z = THREE.MathUtils.degToRad(26.7);
        } else if (data.id === 'mars') {
          planetMesh.rotation.z = THREE.MathUtils.degToRad(25.2);
        }

        // Szaturnusz gyűrű hozzáadása
        if (data.hasRings) {
          const ringTextureCanvas = this.textureGen.getSaturnRingTexture();
          const ringTexture = new THREE.CanvasTexture(ringTextureCanvas);

          const ringGeo = new THREE.RingGeometry(data.ringInnerRadius, data.ringOuterRadius, 64);
          // RingGeometry normálisan XY síkon van, fordítsuk XZ síkra
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
          planetMesh.add(ringMesh);
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
          planetMesh.add(moonMesh);
          planetMesh.userData.moon = moonMesh;
        }

        this.scene.add(planetMesh);
        this.planetMeshes.push(planetMesh);

        this.planets.push({
          data,
          mesh: planetMesh,
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

    // Kiszámítjuk az ideális kameratávolságot a bolygó méretéből
    const distanceOffset = target.data.id === 'sun'
      ? target.data.size3D * 3.8
      : target.data.hasRings
        ? target.data.ringOuterRadius * 2.2
        : target.data.size3D * 4.2;

    const targetPos = target.mesh.position.clone();
    
    // Kamera pozíciója a mód függvényében
    let camOffset;
    if (this.mode === 'lineup') {
      camOffset = new THREE.Vector3(0, distanceOffset * 0.2, distanceOffset * 1.1);
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
        new THREE.Vector3(-10, 4, 195),
        new THREE.Vector3(-10, 0, 0)
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
        // --- MÉRETARÁNY SORBARENDEZÉS MÓD ---
        this.planets.forEach((p) => {
          // Tengely körüli forgás folytatódik
          p.mesh.rotation.y += p.data.rotationSpeed * this.simSpeed;

          // Sima átmozgatás az egyenes sorba
          const targetX = this.lineupPositions[p.data.id] ?? 0;
          p.mesh.position.lerp(new THREE.Vector3(targetX, 0, 0), 0.06);

          // Szaturnusz dőlése szemből látványos
          if (p.data.id === 'saturn') {
            p.mesh.rotation.x = THREE.MathUtils.lerp(p.mesh.rotation.x, 0.4, 0.05);
          }

          if (p.mesh.userData.moon) {
            p.mesh.userData.moon.position.set(0, 4.8, 0);
          }
        });

      } else {
        // --- 3D KERINGÉSI PÁLYA MÓD ---
        this.planets.forEach((p) => {
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
              const moonAngle = this.time * 3.5;
              moon.position.x = Math.cos(moonAngle) * 5.5;
              moon.position.z = Math.sin(moonAngle) * 5.5;
            }
          } else {
            // Nap visszatér a (0,0,0) pontra
            p.mesh.position.lerp(new THREE.Vector3(0, 0, 0), 0.08);
          }
        });
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
