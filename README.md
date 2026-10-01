# 🪐 Naprendszer Felfedező (Interactive 3D Solar System)

Egy lenyűgöző, interaktív 3D csillagászati bemutató weboldal a Naprendszerről, sötét kozmikus háttérrel, fotórealisztikus textúrákkal, bolygópályákkal és glassmorphic sci-fi telemetriai panellel.

---

## ✨ Főbb Funkciók

- **🌌 Valódi 3D szimuláció (Three.js):**
  - Központi ragyogó **Nap** dinamikus koronával és fényszórással.
  - A 8 nagybolygó (**Merkúr, Vénusz, Föld, Mars, Jupiter, Szaturnusz, Uránusz, Neptunusz**) + a **Hold** és a **Plútó** törpebolygó.
  - Részletgazdag **Szaturnusz gyűrűrendszer** a Cassini-réssel.
  - Megjelenített finom orbitális keringési pályák.
  - Több ezer csillagból álló, mélységérzetet keltő, forgó csillagháttér.

- **📊 Részletes Telemetriai Infopanel (Kattintásra):**
  Bármely bolygóra vagy az alsó navigációs sávra kattintva a kamera odarepül, és megnyílik a glassmorphic adatlap:
  - 📸 **Kép / Mini 3D előnézet:** forgó kozmikus gömb 3D árnyékolással és atmoszféra-ragyogással.
  - 🏷️ **Név:** Magyar és latin elnevezés, típus és mottó.
  - 📏 **Átmérő:** Pontos km-ben és Földhöz viszonyított méretarány.
  - ☀️ **Távolság a Naptól:** Millió km-ben és Csillagászati Egységben (CsE).
  - ⏱️ **Keringési és forgási idő:** Év, nap és sziderikus tengelyforgás.
  - 🌡️ **Hőmérséklet & Holdak száma.**
  - 📖 **Részletes bemutatás:** Tudományos összefoglaló szöveg.
  - ✨ **Érdekességek (Tudtad-e?):** 4 darab lenyűgöző tény mindegyik égitesthez.

- **🔬 Belső Felépítés & Földrajzi Gömbhéj Modul (Föld és Nap):**
  - **3D Negyedmetszet (Cutaway) a térben:** Egy kattintással megnyitható az égitest belső felépítése 3D-ben, valós térbeli gömbhéjakkal és izzó maggal.
  - **Interaktív 2.5D Keresztmetszeti Ábra:** Az infopanelben a rétegek fölé vive a kurzort vagy rákattintva közvetlen fénylő kiemelés és mutatóvonal jelenik meg.
  - **🌍 Föld belső szerkezete:** Földkéreg (óceáni és kontinentális kéreg, litoszféra), Felső köpeny (asztenoszféra, köpenykonvekció, lemeztektonika), Alsó köpeny (mezoszféra), Külső mag (folyékony fém, Föld mágneses mezejét keltő geodinamó), Belső mag (szilárd kristályos vas-nikkel mag).
  - **📏 Geofizikai Határfelületek:** Mohorovičić (Moho), Gutenberg-Wiechert és Lehmann felületek vizuális jelölése és magyarázata.
  - **☀️ Nap belső szerkezete:** Mag (15 millió °C, hidrogénfúzió), Sugárzási öv (fotonok vándorlása), Tahoklin (mágneses dinamó), Konvekciós öv (plazmaáramlások, granuláció), Fotoszféra (napfoltok), Kromoszféra és Korona (napszél).
  - **📚 Földrajz érettségi / tananyag szempontok:** Részletes kőzettani, halmazállapoti, hőmérsékleti és mélységi adatok, valamint összefoglaló tanulási táblázat.

- **🎮 Interakciók és Vezérlés:**
  - **Forgatás:** Bal egérgomb nyomva tartása és mozgatása / érintés mobilon.
  - **Zoom:** Egérgörgő vagy 2 ujjas csippentés.
  - **Bal oldali kinyitható égitest-panel:** Egy kattintással összecsukható (◀ / ▶) lebegő lista az összes égitesttel.
  - **📏 Méretarány Összehasonlítás Mód:** A felső sávban átkapcsolható a keringési szimulációról a valós csillagászati méretarányos felsorakoztatásra (a Nap 109× méretével!).
  - **Hover Tooltip:** Az egér kurzor alatt megjelenő lebegő bolygócímke és távolság.
  - **Szimuláció vezérlés:** Lejátszás / Szünet (⏸️ / ▶️) és állítható sebesség (0.5×, 1×, 2×, 5×).
  - **Kozmikus térhangzás:** Bekapcsolható éteri sci-fi ambient zene Web Audio API-val (külső fájlok nélkül).
  - **Teljes nézet gomb (🌌) & ESC:** Visszaállítja a kamerát a Naprendszer teljes áttekintésére.

---

## 🌐 Telepítés GitHub Pages-re (GitHub Actions)

A repó tartalmaz egy előre konfigurált munkafolyamatot a `.github/workflows/deploy.yml` fájlban.

1. **GitHub Pages beállítása a repódban:**
   - Nyisd meg a repót a GitHubon: `https://github.com/pista1125/Aiszakkor_naprendszer`
   - Menj a **Settings** (Beállítások) ➔ **Pages** fülre.
   - A **Build and deployment** résznél a **Source** legördülő menüben válaszd a **GitHub Actions** lehetőséget.
2. **Kód feltöltése (Push):**
   ```bash
   git push -u origin main
   ```
3. A GitHub Action automatikusan lefut és közzéteszi a weboldalt a nyilvános GitHub Pages címen!

---

## 🚀 Indítás Helyi Gépen

A projekt tiszta HTML5, CSS3 és Vanilla JavaScript ES modulokat használ. A böngészők biztonsági szabályai (CORS) miatt helyi webszerver szükséges a futtatáshoz.

### 1. lehetőség: Node.js / NPM (Ajánlott)

1. Csomagok telepítése (csak az első alkalommal):
   ```bash
   npm install
   ```
2. Szerver indítása:
   ```bash
   npm run dev
   ```
3. Nyisd meg a böngésződben:
   ```
   http://localhost:3000
   ```

### 2. lehetőség: Python beépített szerver

1. Nyiss meg egy terminált a projekt mappájában:
   ```bash
   python -m http.server 8000
   ```
2. Nyisd meg a böngésződben:
   ```
   http://localhost:8000
   ```

