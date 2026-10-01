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

- **🎮 Interakciók és Vezérlés:**
  - **Forgatás:** Bal egérgomb nyomva tartása és mozgatása / érintés mobilon.
  - **Zoom:** Egérgörgő vagy 2 ujjas csippentés.
  - **Hover Tooltip:** Az egér kurzor alatt megjelenő lebegő bolygócímke és távolság.
  - **Szimuláció vezérlés:** Lejátszás / Szünet (⏸️ / ▶️) és állítható sebesség (0.5×, 1×, 2×, 5×).
  - **Kozmikus térhangzás:** Bekapcsolható éteri sci-fi ambient zene Web Audio API-val (külső fájlok nélkül).
  - **Teljes nézet gomb (🌌) & ESC:** Visszaállítja a kamerát a Naprendszer teljes áttekintésére.

---

## 🚀 Indítás Helyi Gépen

A projekt tiszta HTML5, CSS3 és Vanilla JavaScript modulokat használ, nincs szükség bonyolult build folyamatra.

1. Nyiss meg egy terminált a projekt mappájában:
   ```bash
   python -m http.server 8000
   ```
2. Nyisd meg a böngésződben:
   ```
   http://localhost:8000
   ```
