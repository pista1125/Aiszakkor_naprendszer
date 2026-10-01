/**
 * textureGenerator.js
 * Nagyfelbontású, procedurális textúrákat generál a Naprendszer égitestjeihez HTML5 Canvas segítségével.
 * 100%-ban megbízható, CORS- és hálózati hibáktól mentes, azonnali Three.js CanvasTexture-öket állít elő.
 */

export class TextureGenerator {
  constructor() {
    this.cache = {};
  }

  // Segédfüggvény: simplex-szerű zajszimuláció
  static pseudoNoise(x, y, seed = 1) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453123;
    return n - Math.floor(n);
  }

  // Többrétegű simított zaj
  static smoothNoise(x, y, scale = 10, seed = 1) {
    const xi = Math.floor(x / scale);
    const yi = Math.floor(y / scale);
    const xf = (x / scale) - xi;
    const yf = (y / scale) - yi;

    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const n00 = TextureGenerator.pseudoNoise(xi, yi, seed);
    const n10 = TextureGenerator.pseudoNoise(xi + 1, yi, seed);
    const n01 = TextureGenerator.pseudoNoise(xi, yi + 1, seed);
    const n11 = TextureGenerator.pseudoNoise(xi + 1, yi + 1, seed);

    const nx0 = n00 * (1 - u) + n10 * u;
    const nx1 = n01 * (1 - u) + n11 * u;
    return nx0 * (1 - v) + nx1 * v;
  }

  static fbm(x, y, octaves = 4, seed = 1) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let totalAmp = 0;

    for (let i = 0; i < octaves; i++) {
      value += TextureGenerator.smoothNoise(x * frequency, y * frequency, 20, seed + i * 17) * amplitude;
      totalAmp += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value / totalAmp;
  }

  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext('2d') };
  }

  // --- NAP TEXTÚRA ---
  getSunTexture() {
    if (this.cache.sun) return this.cache.sun;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Alap tüzes gradiens
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff4500');
    grad.addColorStop(0.5, '#ffa500');
    grad.addColorStop(1, '#ff3300');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n = TextureGenerator.fbm(x, y, 5, 42);
        const flare = TextureGenerator.fbm(x * 1.5, y * 2, 3, 108);

        // Napfelszíni granuláció és forróság
        const r = Math.min(255, 230 + Math.floor(n * 50));
        const g = Math.min(255, 120 + Math.floor(n * 120 + flare * 40));
        const b = Math.floor(n * 30);

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Napfoltok hozzáadása
    for (let s = 0; s < 14; s++) {
      const sx = (Math.random() * 0.8 + 0.1) * w;
      const sy = (Math.random() * 0.4 + 0.3) * h;
      const sr = Math.random() * 12 + 6;

      const spotGrad = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr);
      spotGrad.addColorStop(0, 'rgba(40, 10, 0, 0.95)');
      spotGrad.addColorStop(0.5, 'rgba(120, 30, 0, 0.8)');
      spotGrad.addColorStop(1, 'rgba(255, 140, 0, 0)');

      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }

    this.cache.sun = canvas;
    return canvas;
  }

  // --- MERKÚR TEXTÚRA ---
  getMercuryTexture() {
    if (this.cache.mercury) return this.cache.mercury;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Szürkés-barna alap
    ctx.fillStyle = '#6e6a66';
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const n = TextureGenerator.fbm(x, y, 6, 88);
        const val = 80 + Math.floor(n * 80);
        data[i] = val + 5;     // enyhe meleg beütés
        data[i + 1] = val;
        data[i + 2] = val - 5;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Kráterek rajzolása
    for (let c = 0; c < 120; c++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const cr = Math.random() * 14 + 2;

      ctx.strokeStyle = 'rgba(200, 200, 200, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(30, 30, 30, 0.4)';
      ctx.beginPath();
      ctx.arc(cx + 0.5, cy + 0.5, cr * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    this.cache.mercury = canvas;
    return canvas;
  }

  // --- VÉNUSZ TEXTÚRA ---
  getVenusTexture() {
    if (this.cache.venus) return this.cache.venus;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Vastag sárgás-okker kénsav felhőrétegek
    for (let y = 0; y < h; y++) {
      const progress = y / h;
      const bandWave = Math.sin(progress * 18) * 15;
      const n = TextureGenerator.fbm(progress * 100, bandWave, 4, 33);
      
      const r = 215 + Math.floor(n * 35);
      const g = 170 + Math.floor(n * 45);
      const b = 110 + Math.floor(n * 30);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, w, 1);
    }

    // Örvények hozzáadása
    for (let s = 0; s < 30; s++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const rad = Math.random() * 60 + 20;

      const swirlGrad = ctx.createRadialGradient(sx, sy, 5, sx, sy, rad);
      swirlGrad.addColorStop(0, 'rgba(245, 220, 160, 0.35)');
      swirlGrad.addColorStop(1, 'rgba(180, 130, 80, 0)');

      ctx.fillStyle = swirlGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    this.cache.venus = canvas;
    return canvas;
  }

  // --- FÖLD TEXTÚRA ---
  getEarthTexture() {
    if (this.cache.earth) return this.cache.earth;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Kék mélyóceán alap
    ctx.fillStyle = '#0f2b5c';
    ctx.fillRect(0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const lat = Math.abs((y / h) - 0.5) * 2; // 0 az egyenlítő, 1 a pólusok
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        
        // Kontinensek zaj-alapú formálása
        const n = TextureGenerator.fbm(x * 1.2, y * 1.2, 6, 77);

        // Sarkvidéki jégmezők
        if (lat > 0.85) {
          data[i] = 235;
          data[i + 1] = 245;
          data[i + 2] = 255;
          continue;
        }

        if (n > 0.52) {
          // Szárazföld
          const isDesert = (lat < 0.4 && n < 0.6);
          const isMountain = n > 0.65;

          if (isMountain) {
            data[i] = 135;
            data[i + 1] = 115;
            data[i + 2] = 90;
          } else if (isDesert) {
            data[i] = 190;
            data[i + 1] = 160;
            data[i + 2] = 100;
          } else {
            // Zöldellő vegetáció
            data[i] = 34;
            data[i + 1] = 120 + Math.floor(n * 40);
            data[i + 2] = 45;
          }
        } else if (n > 0.49) {
          // Sekély part menti víz (türkiz)
          data[i] = 15;
          data[i + 1] = 90;
          data[i + 2] = 145;
        } else {
          // Mélyóceán
          data[i] = 8;
          data[i + 1] = 35;
          data[i + 2] = 85 + Math.floor(n * 20);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Légköri felhőörvények (féláttetsző fehér pamacsok)
    for (let c = 0; c < 45; c++) {
      const cx = Math.random() * w;
      const cy = Math.random() * (h * 0.7) + (h * 0.15);
      const rx = Math.random() * 80 + 30;
      const ry = Math.random() * 25 + 10;

      const cloudGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, rx);
      cloudGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      cloudGrad.addColorStop(0.6, 'rgba(255, 255, 255, 0.4)');
      cloudGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();
    }

    this.cache.earth = canvas;
    return canvas;
  }

  // --- MARS TEXTÚRA ---
  getMarsTexture() {
    if (this.cache.mars) return this.cache.mars;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;

    for (let y = 0; y < h; y++) {
      const lat = Math.abs((y / h) - 0.5) * 2;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;

        // Pólussapkák
        if (lat > 0.88) {
          data[i] = 240;
          data[i + 1] = 240;
          data[i + 2] = 250;
          data[i + 3] = 255;
          continue;
        }

        const n = TextureGenerator.fbm(x, y, 6, 55);
        const darkVolcano = TextureGenerator.fbm(x * 0.5, y * 0.5, 4, 12);

        // Vörösesbarna / rozsda árnyalatok
        if (darkVolcano > 0.6) {
          // Bazaltos sötét síkságok
          data[i] = 110 + Math.floor(n * 20);
          data[i + 1] = 50 + Math.floor(n * 15);
          data[i + 2] = 35 + Math.floor(n * 10);
        } else {
          // Rozsdás homoksivatag
          data[i] = 195 + Math.floor(n * 45);
          data[i + 1] = 75 + Math.floor(n * 35);
          data[i + 2] = 45 + Math.floor(n * 20);
        }
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Kanyonok / Kráterek
    ctx.strokeStyle = 'rgba(60, 20, 10, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.5);
    ctx.bezierCurveTo(w * 0.45, h * 0.48, w * 0.55, h * 0.54, w * 0.65, h * 0.52);
    ctx.stroke();

    this.cache.mars = canvas;
    return canvas;
  }

  // --- JUPITER TEXTÚRA ---
  getJupiterTexture() {
    if (this.cache.jupiter) return this.cache.jupiter;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Vízszintes gázsávok és zónák
    for (let y = 0; y < h; y++) {
      const progress = y / h;
      const wave = Math.sin(progress * 28 + Math.cos(progress * 12)) * 0.5 + 0.5;
      const n = TextureGenerator.fbm(progress * 80, y, 4, 91);

      // Krémszínű és vörösesbarna sávok váltakozása
      let r, g, b;
      if (wave > 0.5) {
        // Világos zóna
        r = 225 + Math.floor(n * 25);
        g = 190 + Math.floor(n * 25);
        b = 150 + Math.floor(n * 30);
      } else {
        // Sötétebb öv
        r = 165 + Math.floor(n * 40);
        g = 105 + Math.floor(n * 30);
        b = 70 + Math.floor(n * 20);
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, w, 1);
    }

    // Nagy Vörös Folt (Great Red Spot) a déli féltekén
    const grsX = w * 0.65;
    const grsY = h * 0.66;
    const grsRadiusX = 45;
    const grsRadiusY = 22;

    const grsGrad = ctx.createRadialGradient(grsX, grsY, 5, grsX, grsY, grsRadiusX);
    grsGrad.addColorStop(0, '#c0392b');
    grsGrad.addColorStop(0.6, '#d35400');
    grsGrad.addColorStop(1, 'rgba(180, 110, 70, 0)');

    ctx.fillStyle = grsGrad;
    ctx.beginPath();
    ctx.ellipse(grsX, grsY, grsRadiusX, grsRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Környező turbulens hullámok
    ctx.strokeStyle = 'rgba(192, 57, 43, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(grsX, grsY, grsRadiusX * 1.25, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    this.cache.jupiter = canvas;
    return canvas;
  }

  // --- SZATURNUSZ TEXTÚRA ---
  getSaturnTexture() {
    if (this.cache.saturn) return this.cache.saturn;
    const w = 1024, h = 512;
    const { canvas, ctx } = this.createCanvas(w, h);

    // Lágy aranybarna és vajszínű sávok
    for (let y = 0; y < h; y++) {
      const progress = y / h;
      const n = TextureGenerator.fbm(progress * 60, y * 0.5, 3, 44);
      const band = Math.sin(progress * 24) * 0.5 + 0.5;

      const r = 215 + Math.floor(band * 30 + n * 10);
      const g = 190 + Math.floor(band * 25 + n * 15);
      const b = 140 + Math.floor(band * 20);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(0, y, w, 1);
    }

    this.cache.saturn = canvas;
    return canvas;
  }

  // --- SZATURNUSZ GYŰRŰ TEXTÚRA ---
  getSaturnRingTexture() {
    if (this.cache.saturnRing) return this.cache.saturnRing;
    const size = 512;
    const { canvas, ctx } = this.createCanvas(size, size);
    const center = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Belső és külső sugár a canvas-on (a 7.0 és 13.0 arányában: 7/13 ~ 0.538)
    const maxR = size * 0.48;
    const minR = maxR * (7.0 / 13.0);

    for (let r = minR; r <= maxR; r += 0.5) {
      const pos = (r - minR) / (maxR - minR); // 0 (belső) -> 1 (külső)
      let alpha = 0;

      // C-gyűrű (belső, halványabb)
      if (pos >= 0.0 && pos < 0.22) {
        alpha = 0.2 + Math.sin(pos * 60) * 0.08;
      }
      // B-gyűrű (legfényesebb, sűrű jeges sávok)
      else if (pos >= 0.22 && pos < 0.65) {
        alpha = 0.85 + Math.sin(pos * 110) * 0.12;
      }
      // Cassini-rés (híres sötét sáv)
      else if (pos >= 0.65 && pos < 0.73) {
        alpha = 0.03;
      }
      // A-gyűrű (külső fő gyűrű)
      else if (pos >= 0.73 && pos < 0.96) {
        // Encke-rés a 0.88-nál
        if (Math.abs(pos - 0.88) < 0.015) {
          alpha = 0.08;
        } else {
          alpha = 0.65 + Math.sin(pos * 90) * 0.1;
        }
      }

      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(226, 204, 168, ${alpha * 0.9})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    this.cache.saturnRing = canvas;
    return canvas;
  }

  // --- URÁNUSZ TEXTÚRA ---
  getUranusTexture() {
    if (this.cache.uranus) return this.cache.uranus;
    const w = 512, h = 256;
    const { canvas, ctx } = this.createCanvas(w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5dd5d3');
    grad.addColorStop(0.3, '#7ae3e1');
    grad.addColorStop(0.7, '#63dcd9');
    grad.addColorStop(1, '#4cb8b6');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.cache.uranus = canvas;
    return canvas;
  }

  // --- NEPTUNUSZ TEXTÚRA ---
  getNeptuneTexture() {
    if (this.cache.neptune) return this.cache.neptune;
    const w = 512, h = 256;
    const { canvas, ctx } = this.createCanvas(w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#274bb8');
    grad.addColorStop(0.5, '#3b66e6');
    grad.addColorStop(1, '#1e3894');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fehér cirrus metánfelhő sávok
    for (let i = 0; i < 8; i++) {
      const cy = Math.random() * h;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(0, cy, w, Math.random() * 4 + 1);
    }

    this.cache.neptune = canvas;
    return canvas;
  }

  // --- PLÚTÓ TEXTÚRA ---
  getPlutoTexture() {
    if (this.cache.pluto) return this.cache.pluto;
    const w = 512, h = 256;
    const { canvas, ctx } = this.createCanvas(w, h);

    ctx.fillStyle = '#9b8778';
    ctx.fillRect(0, 0, w, h);

    // Szív alakú Tombaugh Regio
    const hx = w * 0.5;
    const hy = h * 0.55;
    const heartGrad = ctx.createRadialGradient(hx, hy, 10, hx, hy, 60);
    heartGrad.addColorStop(0, '#e8ded4');
    heartGrad.addColorStop(0.8, '#d4c5b6');
    heartGrad.addColorStop(1, 'rgba(155, 135, 120, 0)');

    ctx.fillStyle = heartGrad;
    ctx.beginPath();
    ctx.arc(hx - 20, hy - 10, 35, 0, Math.PI * 2);
    ctx.arc(hx + 20, hy - 10, 35, 0, Math.PI * 2);
    ctx.fill();

    this.cache.pluto = canvas;
    return canvas;
  }

  getTextureForPlanet(id) {
    switch (id) {
      case 'sun': return this.getSunTexture();
      case 'mercury': return this.getMercuryTexture();
      case 'venus': return this.getVenusTexture();
      case 'earth': return this.getEarthTexture();
      case 'mars': return this.getMarsTexture();
      case 'jupiter': return this.getJupiterTexture();
      case 'saturn': return this.getSaturnTexture();
      case 'uranus': return this.getUranusTexture();
      case 'neptune': return this.getNeptuneTexture();
      case 'pluto': return this.getPlutoTexture();
      default: return this.getMercuryTexture();
    }
  }
}
