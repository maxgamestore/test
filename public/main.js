/* =====================================================================
   SETARI - aici schimbi ce vrei (instrumente, fisiere audio, membri)
   Toate fisierele audio trebuie sa aiba ACEEASI durata si sa porneasca
   din acelasi punct (exportate din aceeasi sesiune), ca sa ramana sincron.
   Pune-le in public/audio/ ; pozele in public/img/
   ===================================================================== */
const CONFIG = {
    originala: 'audio/teeth-original.mp3',

    // Instrumentele (butoanele de jos). Le inlocuiesti cand ai lista finala.
    // culoare = "r,g,b" (culoarea undelor cand instrumentul e activ)
    instrumente: [
        { id: 'voce',    nume: 'Voce',    icon: '🎤', fisier: 'audio/stems/voce.mp3',    culoare: '255,110,180' },
        { id: 'chitara', nume: 'Chitară', icon: '🎸', fisier: 'audio/stems/chitara.mp3', culoare: '255,235,120' },
        { id: 'bas',     nume: 'Bas',     icon: '🎸', fisier: 'audio/stems/bas.mp3',     culoare: '120,220,255' },
        { id: 'tobe',    nume: 'Tobe',    icon: '🥁', fisier: 'audio/stems/tobe.mp3',    culoare: '190,255,140' }
    ],

    // Volumul piesei originale cat timp ruleaza partea cu instrumentele (0..1)
    volumOriginalInstrumente: 0.18,
    // Volumul piesei originale in scena cu "Sfarsit"
    volumOriginalSfarsit: 0.6,
    volumGeneral: 0.9,

    // Cei 4 membri = cele 4 faders (stanga-exterior, stanga-interior, dreapta-interior, dreapta-exterior)
    // culoare = "r,g,b"; zona = coltul din care vine lumina (ss=stanga-sus, sj=stanga-jos, dj=dreapta-jos, ds=dreapta-sus)
    // poza = fisierul din public/img/ ; detalii = textul care apare langa poza (numele NU se afiseaza)
    membri: [
        { nume: 'Luke', poza: 'img/luke.jpg', detalii: 'Luke Hemmings, este vocea principala a piesei "Teeth". Vocea se expresiva contribuie la atmosfera intunecata si seducatoare a melodiei', culoare: '255,70,170', zona: 'ss' },
        { nume: 'Michael', poza: 'img/michael.jpg', detalii: 'Michael Clifford, contribuie la sunetul rock al piesei prin chitara si prin vocile secundare, care completeaza vocea lui Luke', culoare: '60,200,255', zona: 'sj' },
        { nume: 'Calum', poza: 'img/calum.jpg', detalii: 'Calum Hood, are un rol important in ritmul piesei.Linia de bas contribuie la sunetul profund si pulsant care se aude pe parcursul melodiei ', culoare: '255,195,60', zona: 'dj' },
        { nume: 'Ashton', poza: 'img/ashton.jpg', detalii: 'Ashton Irwin,ofera fundatia ritmica a piesei.Tobe si percutia contribuie la energia puternica si la tensiunea melodiei', culoare: '160,110,255', zona: 'ds' }
    ],

    // true = se vad si textele de ajutor ("Apasa!", "Pornește luminile", indicii la faders etc.)
    indicii: false,

    prag: 0.7   // cat trebuie sa fie fiecare fader ca sa treaca mai departe
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("Proiect Muzică încărcat!");

    const body = document.body;
    if (!CONFIG.indicii) body.classList.add('fara-indicii');
    const aparatFum = document.getElementById('aparatFum');
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const rand = (a, b) => a + Math.random() * (b - a);

    /* =====================================================================
       SUNET - muzica (Web Audio, piesa + stem-uri SINCRON) + efecte sonore
       sintetizate (fara fisiere): click, intrerupator, fum, cortine etc.
       ===================================================================== */
    const Sunet = (() => {
        let ctx = null, master = null, musicBus = null, sfxBus = null, analyser = null;
        let origGain = null, zgomot = null;
        let timeData = null, freqData = null;
        let pornita = false, mut = false, incarcare = 'asteapta';
        const stems = {};      // id -> GainNode
        const dorit = {};      // id -> volum cerut inainte sa se incarce fisierul
        const ascultatori = [];

        const spune = () => ascultatori.forEach(f => f(incarcare));

        async function incarca(url) {
            const r = await fetch(url);
            if (!r.ok) throw new Error(url + ' (' + r.status + ')');
            return ctx.decodeAudioData(await r.arrayBuffer());
        }

        async function porneste() {
            incarcare = 'se-incarca'; spune();
            const lista = [{ id: '__orig', url: CONFIG.originala }]
                .concat(CONFIG.instrumente.map(i => ({ id: i.id, url: i.fisier })));

            const rez = await Promise.all(lista.map(async (it) => {
                try { return { id: it.id, buf: await incarca(it.url) }; }
                catch (e) { console.warn('Audio lipsă:', e.message); return null; }
            }));

            const bune = rez.filter(Boolean);
            if (!bune.length) { incarcare = 'gol'; spune(); return; }

            // toate pornesc la ACELASI moment => raman sincronizate
            const t = ctx.currentTime + 0.2;
            for (const it of bune) {
                const src = ctx.createBufferSource();
                src.buffer = it.buf;
                src.loop = true;
                if (it.id === '__orig') {
                    src.connect(origGain);
                } else {
                    const g = ctx.createGain();
                    g.gain.value = dorit[it.id] || 0;
                    src.connect(g);
                    g.connect(musicBus);
                    stems[it.id] = g;
                }
                src.start(t);
            }
            pornita = true;
            incarcare = 'gata'; spune();
        }

        function init() {
            if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = mut ? 0 : CONFIG.volumGeneral;
            musicBus = ctx.createGain();
            sfxBus = ctx.createGain();
            sfxBus.gain.value = 0.8;
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.8;
            origGain = ctx.createGain();
            origGain.gain.value = 1;
            origGain.connect(musicBus);
            musicBus.connect(analyser);
            analyser.connect(master);
            sfxBus.connect(master);
            master.connect(ctx.destination);
            timeData = new Uint8Array(analyser.fftSize);
            freqData = new Uint8Array(analyser.frequencyBinCount);

            // buffer de zgomot alb pentru efecte (fum, cortine, whoosh)
            zgomot = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = zgomot.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

            ctx.resume();
            porneste();
        }

        function seteaza(g, v, durata) {
            if (!g || !ctx) return;
            const t = ctx.currentTime;
            g.gain.cancelScheduledValues(t);
            g.gain.setTargetAtTime(v, t, (durata || 0.4) / 3);
        }

        /* ---------- efecte sonore sintetizate ---------- */
        function osc(tip, f0, f1, dur, vol, intarziere) {
            if (!ctx) return;
            const t = ctx.currentTime + (intarziere || 0);
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = tip;
            o.frequency.setValueAtTime(f0, t);
            if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(sfxBus);
            o.start(t); o.stop(t + dur + 0.05);
        }

        function zg(dur, filtru, f0, f1, vol, atac, intarziere) {
            if (!ctx) return;
            const t = ctx.currentTime + (intarziere || 0);
            const s = ctx.createBufferSource();
            s.buffer = zgomot; s.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = filtru;
            f.frequency.setValueAtTime(f0, t);
            f.frequency.exponentialRampToValueAtTime(f1, t + dur);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(vol, t + (atac || 0.01));
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            s.connect(f); f.connect(g); g.connect(sfxBus);
            s.start(t, Math.random()); s.stop(t + dur + 0.05);
        }

        const NOTE = [523.25, 659.25, 783.99, 1046.5];
        const sfx = {
            tick() { osc('square', 1800, 1200, 0.03, 0.02); },
            nota(i) {
                const f = NOTE[Math.min(NOTE.length - 1, Math.max(0, i))];
                osc('triangle', f, 0, 0.4, 0.12);
                osc('sine', f * 2, 0, 0.28, 0.04);
            },
            ding() { [0, 1, 2, 3].forEach(i => osc('triangle', NOTE[i], 0, 0.9, 0.09, i * 0.07)); },
            clunk() { osc('sine', 120, 45, 0.2, 0.5); zg(0.07, 'highpass', 2000, 4000, 0.25, 0.002); },
            neon() { for (let k = 0; k < 6; k++) osc('sawtooth', 90 + k * 17, 0, 0.05, 0.05, k * 0.12); },
            whoosh() { zg(1.2, 'bandpass', 300, 3500, 0.35, 0.4); },
            pop(i) { osc('sine', 380 + i * 90, 0, 0.14, 0.18); },
            rope() { zg(0.2, 'lowpass', 900, 300, 0.4, 0.01); osc('triangle', 220, 120, 0.25, 0.12); },
            cortina() { zg(2.4, 'bandpass', 400, 900, 0.22, 1.0); },
            fum() { zg(3.6, 'highpass', 1800, 3600, 0.22, 0.25); zg(3.6, 'lowpass', 700, 300, 0.12, 0.3); },
            fanfara() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc('triangle', f, 0, 1.8, 0.08, i * 0.09)); },
            confeti() { zg(0.25, 'bandpass', 1500, 800, 0.3, 0.005); osc('sine', 700, 200, 0.12, 0.2); }
        };

        return {
            init, sfx,
            onStare(f) { ascultatori.push(f); },
            stare() { return incarcare; },
            seMut() { return mut; },
            comutaMut() {
                mut = !mut;
                if (master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(mut ? 0 : CONFIG.volumGeneral, ctx.currentTime, 0.05); }
                return mut;
            },
            instrument(id, v) { dorit[id] = v; seteaza(stems[id], v, 0.25); },
            fundal() { seteaza(origGain, CONFIG.volumOriginalInstrumente, 1.2); },
            sfarsit() { seteaza(origGain, CONFIG.volumOriginalSfarsit, 2); },
            // la final: originala revine, stem-urile se opresc, muzica continua de unde era
            revenire() {
                seteaza(origGain, 1, 2);
                for (const id in stems) { dorit[id] = 0; seteaza(stems[id], 0, 1.5); }
                for (const id in dorit) dorit[id] = 0;
            },
            nivel() {
                if (!analyser || !pornita) return 0;
                analyser.getByteTimeDomainData(timeData);
                let s = 0;
                for (let i = 0; i < timeData.length; i++) { const v = (timeData[i] - 128) / 128; s += v * v; }
                return clamp01(Math.sqrt(s / timeData.length) * 3);
            },
            forma() { return pornita ? timeData : null; },
            spectru() {
                if (!analyser || !pornita) return null;
                analyser.getByteFrequencyData(freqData);
                return freqData;
            },
            bass() {
                if (!analyser || !pornita || !freqData) return 0;
                let s = 0;
                for (let i = 1; i <= 6; i++) s += freqData[i];
                return clamp01((s / 6 / 255 - 0.35) * 2.2);
            }
        };
    })();

    /* ---------- buton sunet ---------- */
    const sunetBtn = document.getElementById('sunetBtn');
    sunetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = Sunet.comutaMut();
        sunetBtn.classList.toggle('mut', m);
        sunetBtn.setAttribute('aria-label', m ? 'Pornește sunetul' : 'Oprește sunetul');
    });
    Sunet.onStare((s) => sunetBtn.classList.toggle('incarca', s === 'se-incarca'));

    /* =====================================================================
       DECOR - note muzicale, stele, parallax
       ===================================================================== */
    (function decor() {
        const NOTE = ['♪', '♫', '♩', '♬'];
        document.querySelectorAll('.note-plutitoare').forEach((c) => {
            const n = parseInt(c.dataset.note, 10) || 10;
            for (let i = 0; i < n; i++) {
                const s = document.createElement('span');
                s.className = 'nota';
                s.textContent = NOTE[i % NOTE.length];
                s.style.setProperty('--x', rand(2, 96).toFixed(1) + '%');
                s.style.setProperty('--s', rand(1.4, 3.2).toFixed(2) + 'rem');
                s.style.setProperty('--dur', rand(9, 17).toFixed(1) + 's');
                s.style.setProperty('--delay', (-rand(0, 17)).toFixed(1) + 's');
                s.style.setProperty('--drift', Math.round(rand(20, 90)));
                c.appendChild(s);
            }
        });

        const stele = document.getElementById('stele');
        for (let i = 0; i < 70; i++) {
            const s = document.createElement('i');
            s.className = 'stea';
            s.style.setProperty('--x', rand(0, 100).toFixed(1) + '%');
            s.style.setProperty('--y', rand(0, 100).toFixed(1) + '%');
            s.style.setProperty('--s', rand(1.5, 3.5).toFixed(1) + 'px');
            s.style.setProperty('--dur', rand(2.5, 6).toFixed(1) + 's');
            s.style.setProperty('--delay', (-rand(0, 6)).toFixed(1) + 's');
            stele.appendChild(s);
        }

        // parallax usor la miscarea mouse-ului (ecranul 1)
        const intro = document.getElementById('intro');
        let rq = false, mx = 0, my = 0;
        window.addEventListener('pointermove', (e) => {
            mx = (e.clientX / window.innerWidth - 0.5) * 2;
            my = (e.clientY / window.innerHeight - 0.5) * 2;
            if (rq) return;
            rq = true;
            requestAnimationFrame(() => {
                intro.style.setProperty('--mx', mx.toFixed(3));
                intro.style.setProperty('--my', my.toFixed(3));
                rq = false;
            });
        });
    })();

    /* =====================================================================
       FUM REALIST - canvas 2D
       - particule cu sprite-uri generate procedural (zgomot fractal + warp)
         => pete de densitate variabila, margini neregulate, fuioare lungi
       - forta de turbulenta (value noise in timp) + balans lateral + drag
       - rotatie neuniforma, expansiune laterala, diluare in timp
       - "voal" de ceata cu zgomot care garanteaza acoperirea completa
       - "perdea" care se ridica (cu margine zimtata) si dezvaluie ecranul 3
       - inainte de click: mici fuioare de fum din duza (invita la click)
       ===================================================================== */
    const Fum = (() => {
        const canvas = document.getElementById('fumCanvas');
        const ctx = canvas.getContext('2d');

        // Timeline (secunde de la click)
        const EMIT_END = 3.1;       // pana cand iese fum din duza
        const VEIL_START = 0.9;     // voalul incepe sa acopere tot ecranul
        const VEIL_FULL = 2.4;      // acoperire aproape totala (camera dispare la 2.2-3.7s)
        const CURTAIN_START = 3.4;  // fumul incepe sa se ridice
        const CURTAIN_END = 6.4;    // ecranul 3 complet dezvaluit

        const SCALE = 0.5;          // randare la jumatate de rezolutie (fum oricum moale)
        const MAX_PARTICLES = 190;

        let W = 0, H = 0, DIAG = 0;
        let mod = 'oprit';          // 'oprit' | 'idle' | 'show'
        let bucla = false;
        let t0 = 0, tIdle = 0, last = 0, emitAcc = 0, idleAcc = 0;
        let particles = [];
        const sprites = [], veils = [];
        const nozzle = { x: 0, y: 0 };
        let lucrari = [];

        /* ---------- utilitare ---------- */
        const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
        const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

        function hash(x, y, s) {
            let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            h ^= h >>> 16;
            return (h >>> 0) / 4294967296;
        }

        function vnoise(x, y, s) {
            const xi = Math.floor(x), yi = Math.floor(y);
            const xf = x - xi, yf = y - yi;
            const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
            const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
            const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        }

        function fbm(x, y, s, oct) {
            let v = 0, amp = 0.5, f = 1, sum = 0;
            for (let i = 0; i < oct; i++) {
                v += amp * vnoise(x * f, y * f, s + i * 17);
                sum += amp; amp *= 0.5; f *= 2.03;
            }
            return v / sum;
        }

        /* ---------- generare sprite-uri ---------- */
        function* makeSprite(size, seed, wisp, iesire) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const img = g.createImageData(size, size);
            const d = img.data;
            const sc = 2.6 + (seed % 3) * 0.7;

            for (let y = 0; y < size; y++) {
                if (y % 16 === 15) yield;          // cedam thread-ul: nu blocam animatiile
                for (let x = 0; x < size; x++) {
                    const nx = (x / size) * 2 - 1;
                    const ny = (y / size) * 2 - 1;
                    // fuioarele sunt benzi subtiri; restul sunt "norisori"
                    const r = wisp ? Math.hypot(nx, ny * 2.4) : Math.hypot(nx, ny);

                    // domain warp => forme de vartej / ondulate
                    const wx = fbm(nx * 1.6 + 5, ny * 1.6 + 9, seed, 3) - 0.5;
                    const wy = fbm(nx * 1.6 - 7, ny * 1.6 + 3, seed + 5, 3) - 0.5;

                    // raza neregulata (margini nu perfect circulare)
                    const edge = fbm(nx * 2 + wx * 1.4 + seed * 3.1, ny * 2 + wy * 1.4, seed + 3, 4);
                    const R = 0.5 + 0.5 * edge;
                    const fall = 1 - smooth(R * 0.15, R, r);

                    // densitate interna: pete dense si zone rare
                    const dens = wisp
                        ? fbm(nx * sc * 0.6 + wx * 2.8, ny * sc * 2.6 + wy * 2.8, seed + 11, 5)
                        : fbm(nx * sc + wx * 2.8, ny * sc + wy * 2.8, seed + 11, 5);
                    const corp = clamp((dens - 0.3) * 2.4, 0, 1);

                    const a = fall * (0.18 + 0.82 * corp);
                    // zonele dense sunt mai luminoase, lumina vine din stanga-sus
                    const lum = 186 + 66 * dens + 14 * (-(nx + ny) * 0.5);
                    const i = (y * size + x) * 4;
                    d[i] = clamp(lum - 6, 0, 255);
                    d[i + 1] = clamp(lum - 2, 0, 255);
                    d[i + 2] = clamp(lum + 8, 0, 255);
                    d[i + 3] = a * 255;
                }
            }
            g.putImageData(img, 0, 0);
            c.wisp = !!wisp;
            iesire.push(c);
        }

        function* makeVeil(size, seed, iesire) {
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const img = g.createImageData(size, size);
            const d = img.data;
            for (let y = 0; y < size; y++) {
                if (y % 16 === 15) yield;
                for (let x = 0; x < size; x++) {
                    const nx = x / size, ny = y / size;
                    const wx = fbm(nx * 3 + 2, ny * 3 + 8, seed, 3) - 0.5;
                    const wy = fbm(nx * 3 - 4, ny * 3 + 1, seed + 5, 3) - 0.5;
                    const n = fbm(nx * 3.2 + wx * 2.2, ny * 3.2 + wy * 2.2, seed + 9, 5);
                    const dens = smooth(0.28, 0.72, n);
                    const lum = 196 + 58 * n;
                    const i = (y * size + x) * 4;
                    d[i] = lum - 6; d[i + 1] = lum - 2; d[i + 2] = lum + 8;
                    d[i + 3] = (0.72 + 0.28 * dens) * 255;   // pete mai rare, dar nu goluri
                }
            }
            g.putImageData(img, 0, 0);
            iesire.push(c);
        }

        // sprite-urile se genereaza pe felii mici, in timpul in care utilizatorul citeste (fara blocaje)
        function pregateste() {
            for (let i = 0; i < 8; i++) lucrari.push(makeSprite(192, 3 + i * 7, i % 4 === 3, sprites));
            lucrari.push(makeVeil(256, 101, veils));
            lucrari.push(makeVeil(256, 233, veils));
            (function pas() {
                const gen = lucrari[0];
                if (!gen) return;
                if (gen.next().done) lucrari.shift();
                setTimeout(pas, 16);
            })();
        }

        function terminaAsseturi() {
            while (lucrari.length) {
                if (lucrari[0].next().done) lucrari.shift();
            }
        }

        /* ---------- dimensiuni ---------- */
        function resize() {
            W = window.innerWidth;
            H = window.innerHeight;
            DIAG = Math.hypot(W, H);
            canvas.width = Math.ceil(W * SCALE);
            canvas.height = Math.ceil(H * SCALE);
        }
        window.addEventListener('resize', () => { if (mod !== 'oprit') resize(); });

        function actualizeazaDuza() {
            const r = document.querySelector('.duza').getBoundingClientRect();
            nozzle.x = r.left + r.width / 2;
            nozzle.y = r.top + r.height / 2;
        }

        /* ---------- particule ---------- */
        function alegeSprite(fuioara) {
            const lista = sprites.filter(s => s.wisp === fuioara);
            return lista.length ? lista[(Math.random() * lista.length) | 0] : null;
        }

        function spawn(t) {
            const burst = t < 0.8;
            const speed = rand(380, 780) * (burst ? 1.15 : 0.9);
            // directie: stanga-sus (duza e in dreapta jos)
            const ang = Math.PI + rand(-0.15, 0.85);
            const fuioara = Math.random() < 0.22;
            const sprite = alegeSprite(fuioara);
            if (!sprite) return;
            particles.push({
                x: nozzle.x + rand(-14, 14),
                y: nozzle.y + rand(-14, 14),
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                s0: rand(70, 140),
                s1: DIAG * rand(0.7, 1.25),
                rot: rand(0, Math.PI * 2),
                rotSpeed: rand(0.25, 0.9) * (Math.random() < 0.5 ? -1 : 1),
                phase: rand(0, 100),
                sway: rand(60, 200),
                turb: 1100,
                stretch: fuioara ? rand(1.4, 2.2) : 1,
                age: 0,
                life: rand(2.8, 4.6),
                base: rand(0.55, 0.92),
                sprite
            });
        }

        // fuioare mici si rare, inainte de click
        function spawnIdle() {
            const sprite = alegeSprite(false);
            if (!sprite) return;
            const ang = Math.PI + rand(0.1, 0.7);
            const sp = rand(110, 200);
            particles.push({
                x: nozzle.x + rand(-6, 6),
                y: nozzle.y + rand(-6, 6),
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp,
                s0: rand(30, 60),
                s1: rand(160, 280),
                rot: rand(0, Math.PI * 2),
                rotSpeed: rand(0.2, 0.6) * (Math.random() < 0.5 ? -1 : 1),
                phase: rand(0, 100),
                sway: rand(20, 60),
                turb: 450,
                stretch: 1,
                age: 0,
                life: rand(2.2, 3.2),
                base: rand(0.28, 0.45),
                sprite
            });
        }

        function update(t, dt) {
            const lift = mod === 'show' ? smooth(CURTAIN_START - 0.3, CURTAIN_END, t) : 0;
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.age += dt;
                if (p.age >= p.life) { particles.splice(i, 1); continue; }

                // drag puternic la inceput (jet), apoi plutire
                const drag = Math.exp(-(1.5 + p.age * 0.15) * dt);
                p.vx *= drag; p.vy *= drag;

                // turbulenta: camp de zgomot care variaza in timp
                const nx = p.x * 0.0035, ny = p.y * 0.0035;
                const n1 = vnoise(nx + t * 0.35, ny, 5) - 0.5;
                const n2 = vnoise(nx + 30, ny - t * 0.3, 9) - 0.5;
                p.vx += n1 * p.turb * dt;
                p.vy += n2 * p.turb * dt;

                // balans lateral (nu urca drept) + flotabilitate
                p.vx += Math.sin(p.age * 1.7 + p.phase) * p.sway * dt;
                p.vy -= (30 + p.age * 55 + lift * 220) * dt;

                p.x += p.vx * dt;
                p.y += p.vy * dt;

                // rotatie neuniforma: viteza modulata de zgomot, incetineste in timp
                const modul = 0.35 + 1.4 * vnoise(p.age * 1.3 + p.phase, 0.5, 3);
                p.rot += p.rotSpeed * modul * dt * (1 - 0.45 * (p.age / p.life));
            }
        }

        /* ---------- desen ---------- */
        function drawVeil(t) {
            const k = clamp((t - VEIL_START) / (VEIL_FULL - VEIL_START), 0, 1);
            if (k <= 0 || veils.length < 2) return;
            const a = Math.pow(k, 1.8) * 0.97;
            const m = Math.max(W, H);

            let size = m * 1.7;
            ctx.globalAlpha = a;
            ctx.drawImage(veils[0], -(size - W) / 2 - t * 38, -(size - H) / 2 - t * 52, size, size);

            // strat B: alta scara si alta directie => densitate neuniforma
            size = m * 1.35;
            ctx.globalAlpha = a * 0.65;
            ctx.drawImage(veils[1], -(size - W) / 2 + t * 30, -(size - H) / 2 - t * 40, size, size);
        }

        function drawParticles() {
            for (const p of particles) {
                const prog = p.age / p.life;
                const grow = 1 - Math.pow(1 - prog, 2.2);          // se extinde repede, apoi incet
                const s = p.s0 + (p.s1 - p.s0) * grow;

                const fadeIn = Math.min(1, p.age / 0.15);
                const fadeOut = prog > 0.6 ? 1 - (prog - 0.6) / 0.4 : 1;
                const dilute = 1 - 0.45 * prog;                    // dens la duza, rarefiat sus
                const a = p.base * dilute * fadeIn * fadeOut;
                if (a <= 0.003) continue;

                ctx.globalAlpha = a;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.drawImage(p.sprite, -s * p.stretch / 2, -s / 2, s * p.stretch, s);
                ctx.restore();
            }
        }

        function drawCurtain(t) {
            if (t < CURTAIN_START - 0.05) return;
            const p = clamp((t - CURTAIN_START) / (CURTAIN_END - CURTAIN_START), 0, 1);
            const e = p * p * (3 - 2 * p);

            const soft = H * 0.35;
            const jag = H * 0.14;
            const startY = H + soft + jag;
            const endY = -soft - jag;
            const edge = startY + (endY - startY) * e;

            const grad = ctx.createLinearGradient(0, -soft, 0, 0);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,1)');

            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.fillStyle = grad;
            const strip = 24;
            for (let x = 0, i = 0; x < W; x += strip, i++) {
                // margine zimtata, in miscare
                const off = (vnoise(i * 0.22, t * 0.5, 21) - 0.5) * 2 * jag;
                ctx.save();
                ctx.translate(0, edge + off);
                ctx.fillRect(x, -soft, strip + 1, H * 2 + soft);
                ctx.restore();
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        function frame(now) {
            if (mod === 'oprit') { bucla = false; return; }
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;

            ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'source-over';

            if (mod === 'idle') {
                idleAcc += dt;
                if (idleAcc > 0.5 && particles.length < 40) {
                    idleAcc = 0;
                    actualizeazaDuza();
                    spawnIdle();
                }
                update((now - tIdle) / 1000, dt);
                drawParticles();
                ctx.globalAlpha = 1;
                requestAnimationFrame(frame);
                return;
            }

            const t = (now - t0) / 1000;

            // emisie: dens la inceput, mai rar spre final
            if (t < EMIT_END && particles.length < MAX_PARTICLES) {
                const rate = 62 * (1 - 0.5 * (t / EMIT_END)) + (t < 0.8 ? 25 : 0);
                emitAcc += rate * dt;
                while (emitAcc >= 1) { spawn(t); emitAcc -= 1; }
            }

            update(t, dt);
            drawVeil(t);
            drawParticles();
            drawCurtain(t);
            ctx.globalAlpha = 1;

            if (t > CURTAIN_END + 0.2) {
                stop();
                return;
            }
            requestAnimationFrame(frame);
        }

        function stop() {
            mod = 'oprit';
            bucla = false;
            particles = [];
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
        }

        function porneste() {
            if (!bucla) {
                bucla = true;
                last = performance.now();
                requestAnimationFrame(frame);
            }
        }

        // mici fuioare din duza, dupa ce aparatul a intrat pe ecran
        function idle() {
            if (mod !== 'oprit' || body.classList.contains('fum')) return;
            resize();
            actualizeazaDuza();
            canvas.style.display = 'block';
            mod = 'idle';
            tIdle = performance.now();
            porneste();
        }

        function start() {
            if (mod === 'show') return;
            terminaAsseturi();
            resize();
            actualizeazaDuza();
            canvas.style.display = 'block';
            mod = 'show';
            emitAcc = 0;
            t0 = performance.now();
            Sunet.sfx.fum();
            porneste();
        }

        pregateste();
        return { start, idle };
    })();

    /* =====================================================================
       ECRANUL 3 - intrerupator, faders, lumini, unde, instrumente, final
       ===================================================================== */
    const Final = (() => {
        const $ = (id) => document.getElementById(id);
        const el = $('final');
        const stratNegru = $('stratNegru');
        const zoneEl = $('zoneLumini');
        const stratPortocaliu = $('stratPortocaliu');
        const scenaA = $('scenaA');
        const scenaD = $('scenaD');
        const scenaE = $('scenaE');
        const grupStanga = $('faderiStanga');
        const grupDreapta = $('faderiDreapta');
        const wrapFinal = $('faderFinalWrap');
        const locFinal = $('faderFinalLoc');
        const swWrap = $('intrerupatorWrap');
        const sw = $('intrerupator');
        const swEticheta = $('intrerupatorEticheta');
        const progres = $('progres');
        const progresPuncte = $('progresPuncte');
        const progresText = $('progresText');
        const contorInstr = $('contorInstr');
        const sfoara = $('sfoara');
        const cortine = $('cortine');
        const panouSfarsit = $('panouSfarsit');
        const luminaScena = document.querySelector('.lumina-scena');
        const btnReia = $('btnReia');
        const canvasPraf = $('praf');
        const canvasUnde = $('unde');
        const canvasConfeti = $('confeti');

        let stage = 'a';
        let pregatit = false;       // controalele sunt vizibile si folosibile
        let pornit = false;         // intrerupatorul (ireversibil)
        let declansat = false;      // toate faders >= prag
        let terminatFinal = false;
        let whooshFacut = false;
        let pasFinal = 0;
        const faders = [];
        const zone = [];
        const valoriZona = [0, 0, 0, 0];
        const puncte = [];
        let faderFinal = null;
        const imagini = [];

        /* ---------- poze: gaseste singur fisierul (alta extensie / alt folder) ---------- */
        function candidatePoze(m) {
            const lista = [];
            const adauga = (u) => { if (u && lista.indexOf(u) < 0) lista.push(u); };
            const date = Array.isArray(m.poza) ? m.poza : [m.poza];
            date.forEach(adauga);                                  // intai exact ce ai scris in CONFIG
            const nume = (m.nume || '').toLowerCase();
            const Nume = nume.charAt(0).toUpperCase() + nume.slice(1);
            const baze = [];
            date.forEach(u => { if (u) baze.push(u.replace(/\.[a-z0-9]+$/i, '')); });
            ['img/', 'poze/', 'images/', ''].forEach(d => { baze.push(d + nume); baze.push(d + Nume); });
            const ext = ['jpg', 'jpeg', 'png', 'webp', 'jfif', 'avif'];
            baze.forEach(b => ext.forEach(e => adauga(b + '.' + e)));
            // Windows ascunde extensiile: "luke.jpg" poate fi de fapt "luke.jpg.jpg"
            if (baze[0]) ['jpg.jpg', 'jpeg.jpg', 'png.png', 'jpg.png', 'jpeg.jpeg'].forEach(e => adauga(baze[0] + '.' + e));
            return lista;
        }

        function incarcaPoza(img, m) {
            const lista = candidatePoze(m);
            let i = 0;
            (function incearca() {
                if (i >= lista.length) {
                    console.warn('Nu am gasit poza pentru "' + m.nume + '". Pune un fisier in public/img/ (ex: ' + lista[0] + ') si apasa Ctrl+F5.');
                    img.remove();                                  // ramane placeholder-ul
                    return;
                }
                const url = lista[i++];
                const t = new Image();
                t.onload = () => { img.src = url; console.log('Poza pentru ' + m.nume + ': ' + url); };
                t.onerror = incearca;
                t.src = url;
            })();
        }

        function setStage(s) { stage = s; el.dataset.stage = s; }
        const progresFinal = () => (faderFinal ? Math.min(1, faderFinal.valoare / 0.9) : 0);

        /* ---------- fader ---------- */
        function creeazaFader(parinte, opt) {
            const root = document.createElement('div');
            root.className = 'fader blocat' + (opt.mare ? ' fader-mare' : '');
            root.style.setProperty('--c', opt.culoare);
            root.setAttribute('role', 'slider');
            root.setAttribute('tabindex', '0');
            root.setAttribute('aria-label', opt.nume);
            root.setAttribute('aria-valuemin', '0');
            root.setAttribute('aria-valuemax', '100');
            root.setAttribute('aria-valuenow', '0');
            root.innerHTML =
                '<span class="fader-led"></span>' +
                '<div class="fader-pista">' +
                '<span class="fader-prag"></span>' +
                '<div class="fader-umplere"></div>' +
                '<div class="fader-buton"><i></i></div>' +
                '</div>';
            parinte.appendChild(root);

            const pista = root.querySelector('.fader-pista');
            let v = 0, trage = false;

            function set(x) {
                v = clamp01(x);
                root.style.setProperty('--v', v);
                root.setAttribute('aria-valuenow', Math.round(v * 100));
                if (opt.onChange) opt.onChange(v);
            }
            function dinPointer(e) {
                const r = pista.getBoundingClientRect();
                set(1 - (e.clientY - r.top) / r.height);
            }

            pista.addEventListener('pointerdown', (e) => {
                if (root.classList.contains('blocat')) return;
                trage = true;
                pista.setPointerCapture(e.pointerId);
                dinPointer(e);
                e.preventDefault();
            });
            pista.addEventListener('pointermove', (e) => { if (trage) dinPointer(e); });
            const stop = () => { trage = false; };
            pista.addEventListener('pointerup', stop);
            pista.addEventListener('pointercancel', stop);

            root.addEventListener('keydown', (e) => {
                if (root.classList.contains('blocat')) return;
                const pas = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.2, PageDown: -0.2 }[e.key];
                if (pas !== undefined) { set(v + pas); e.preventDefault(); }
                else if (e.key === 'Home') { set(0); e.preventDefault(); }
                else if (e.key === 'End') { set(1); e.preventDefault(); }
            });

            return { el: root, get valoare() { return v; }, set };
        }

        /* ---------- lumini / progres ---------- */
        function actualizeazaLumini() {
            const p = progresFinal();
            zone.forEach((z, i) => z.style.setProperty('--v', (valoriZona[i] * (1 - p)).toFixed(3)));
        }

        function actualizeazaProgres() {
            const n = faders.filter(f => f.sus).length;
            puncte.forEach((d, i) => d.classList.toggle('aprins', !!faders[i].sus));
            const total = faders.length;
            progresText.textContent =
                n === 0 ? 'Dă în sus fiecare fader, până trece de marcaj.' :
                n < total ? n + ' din ' + total + ' aprinse – mai ai ' + (total - n) + '.' :
                'Perfect! Se schimbă scena…';
        }

        function verificaPrag() {
            if (declansat) return;
            if (faders.every(f => f.valoare >= CONFIG.prag)) {
                declansat = true;
                Sunet.sfx.ding();
                setTimeout(treciLaC, 900);
            }
        }

        /* ---------- constructie ---------- */
        function construieste() {
            CONFIG.membri.forEach((m, i) => {
                const z = document.createElement('div');
                z.className = 'zona zona-' + m.zona;
                z.style.setProperty('--c', m.culoare);
                z.innerHTML =
                    '<div class="fascicul"></div>' +
                    '<div class="fisa"><div class="poza">📷<img alt=""></div><p class="detalii"></p></div>';
                z.querySelector('.detalii').textContent = m.detalii || '';
                imagini.push({ img: z.querySelector('.poza img'), membru: m });
                zoneEl.appendChild(z);
                zone.push(z);

                const f = creeazaFader(i < 2 ? grupStanga : grupDreapta, {
                    nume: m.nume,
                    culoare: m.culoare,
                    onChange: (v) => {
                        valoriZona[i] = v;
                        actualizeazaLumini();
                        const pas = Math.floor(v * 10);
                        if (pas !== f.pas) { f.pas = pas; Sunet.sfx.tick(); }
                        const sus = v >= CONFIG.prag;
                        if (sus !== f.sus) {
                            f.sus = sus;
                            f.el.classList.toggle('atins', sus);
                            if (sus) Sunet.sfx.nota(faders.filter(x => x.sus).length - 1);
                            actualizeazaProgres();
                        }
                        verificaPrag();
                    }
                });
                f.pas = 0; f.sus = false;
                faders.push(f);

                const d = document.createElement('i');
                d.style.setProperty('--c', m.culoare);
                progresPuncte.appendChild(d);
                puncte.push(d);
            });

            faderFinal = creeazaFader(locFinal, {
                nume: 'Mai departe',
                culoare: '255,170,70',
                mare: true,
                onChange: (v) => {
                    const pp = progresFinal();
                    stratPortocaliu.style.setProperty('--p', pp.toFixed(3));
                    actualizeazaLumini();
                    const pas = Math.floor(v * 10);
                    if (pas !== pasFinal) { pasFinal = pas; Sunet.sfx.tick(); }
                    if (v > 0.12 && !whooshFacut) { whooshFacut = true; Sunet.sfx.whoosh(); }
                    if (v >= 0.97 && !terminatFinal) {
                        terminatFinal = true;
                        faderFinal.set(1);
                        treciLaD();
                    }
                }
            });

            // butoane instrumente: UNUL singur activ, cel nou il inlocuieste pe cel vechi
            const rand0 = $('butoaneInstr');
            const maiDeparte = $('maiDeparte');
            const vazute = new Set();
            const butoane = {};
            const total = CONFIG.instrumente.length;
            let activ = null;
            contorInstr.textContent = 'Instrumente descoperite: 0 / ' + total;

            CONFIG.instrumente.forEach((ins, idx) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'btn-instr';
                b.style.setProperty('--c', ins.culoare || '255,255,255');
                b.innerHTML =
                    '<span class="ic"></span><span class="nm"></span>' +
                    '<span class="eq-mic"><i></i><i></i><i></i></span><span class="semn"></span>';
                b.querySelector('.ic').textContent = ins.icon || '';
                b.querySelector('.nm').textContent = ins.nume;
                butoane[ins.id] = b;
                b.addEventListener('click', () => {
                    if (activ === ins.id) {
                        activ = null;
                        b.classList.remove('activ');
                        Sunet.instrument(ins.id, 0);
                        setCuloareUnde('255,255,255');
                    } else {
                        if (activ) {
                            butoane[activ].classList.remove('activ');
                            Sunet.instrument(activ, 0);
                        }
                        activ = ins.id;
                        b.classList.add('activ');
                        Sunet.instrument(ins.id, 1);
                        setCuloareUnde(ins.culoare || '255,255,255');
                        Sunet.sfx.pop(idx);
                    }
                    b.classList.add('vazut');
                    vazute.add(ins.id);
                    contorInstr.textContent = 'Instrumente descoperite: ' + vazute.size + ' / ' + total;
                    if (vazute.size === total) maiDeparte.classList.add('vizibil');
                });
                rand0.insertBefore(b, maiDeparte);
            });
            maiDeparte.addEventListener('click', treciLaE);
        }

        /* ---------- etape ---------- */
        function arataControale() {
            imagini.forEach(o => incarcaPoza(o.img, o.membru));    // pozele se incarca inainte sa fie nevoie de ele
            grupStanga.classList.add('vizibil');
            grupDreapta.classList.add('vizibil');
            swWrap.classList.add('vizibil');
            setTimeout(() => { pregatit = true; }, 1200);
        }

        function apasaIntrerupator() {
            if (!pregatit || pornit) return;
            pornit = true;                                  // ireversibil
            Sunet.sfx.clunk();
            Sunet.sfx.neon();
            sw.classList.add('pornit');
            sw.setAttribute('aria-pressed', 'true');
            sw.disabled = true;
            swEticheta.textContent = 'Pornit';
            swWrap.classList.add('blocat');
            stratNegru.classList.add('vizibil', 'flicker');   // tot ecranul devine negru (cu palpaire de neon)
            scenaA.classList.remove('vizibila');              // textul dispare
            faders.forEach(f => f.el.classList.remove('blocat'));
            progres.classList.add('vizibil');
            canvasPraf.classList.add('vizibil');
            pornestePraf();
            setStage('b');
        }

        function treciLaC() {
            setStage('c');
            progres.classList.remove('vizibil');
            grupStanga.classList.remove('vizibil');
            grupDreapta.classList.remove('vizibil');
            swWrap.classList.remove('blocat');
            swWrap.classList.add('ascuns');
            setTimeout(() => {
                faderFinal.el.classList.remove('blocat');
                wrapFinal.classList.add('vizibil');         // fade in, in dreapta
            }, 1300);
        }

        function treciLaD() {
            setStage('d');
            stratPortocaliu.style.setProperty('--p', 1);
            zone.forEach(z => z.style.setProperty('--v', 0));
            wrapFinal.classList.add('dispare');
            canvasPraf.classList.remove('vizibil');
            setTimeout(oprestePraf, 1700);
            canvasUnde.classList.add('vizibil');
            setTimeout(() => scenaD.classList.add('vizibila'), 700);
            Sunet.sfx.fanfara();
            Sunet.fundal();
            pornesteUnde();
        }

        function treciLaE() {
            setStage('e');
            scenaD.classList.remove('vizibila');
            setTimeout(() => scenaE.classList.add('vizibila'), 600);
            setTimeout(() => sfoara.classList.add('vizibil'), 1800);
            setCuloareUnde('255,255,255');
            Sunet.revenire();
        }

        function trageSfoara() {
            if (sfoara.classList.contains('trasa')) return;
            sfoara.classList.add('trasa');                                  // animatia de tragere
            Sunet.sfx.rope();
            setTimeout(() => { cortine.classList.add('inchise'); Sunet.sfx.cortina(); }, 650);   // apar cortinele
            setTimeout(() => {                                              // panoul "Sfarsit"
                panouSfarsit.classList.add('vizibil');
                luminaScena.classList.add('vizibil');
                Sunet.sfx.fanfara();
                Sunet.sfarsit();
                setTimeout(lanseazaConfeti, 350);
            }, 3300);
            setTimeout(() => btnReia.classList.add('vizibil'), 7000);
        }

        /* ---------- praf de lumina in fascicule ---------- */
        const gPraf = canvasPraf.getContext('2d');
        const mote = [];
        for (let i = 0; i < 90; i++) {
            mote.push({ x: Math.random(), y: Math.random(), r: rand(0.8, 2.4), vx: rand(-0.01, 0.01), vy: rand(-0.022, -0.004), ph: rand(0, 6.28) });
        }
        let rulezPraf = false, ultimPraf = 0;

        function pornestePraf() {
            if (rulezPraf) return;
            rulezPraf = true;
            ultimPraf = performance.now();
            requestAnimationFrame(buclaPraf);
        }

        function oprestePraf() {
            rulezPraf = false;
            gPraf.clearRect(0, 0, canvasPraf.width, canvasPraf.height);
        }

        function buclaPraf(now) {
            if (!rulezPraf) return;
            const dt = Math.min(0.05, (now - ultimPraf) / 1000);
            ultimPraf = now;
            const W = window.innerWidth, H = window.innerHeight;
            if (canvasPraf.width !== W || canvasPraf.height !== H) { canvasPraf.width = W; canvasPraf.height = H; }
            gPraf.clearRect(0, 0, W, H);
            gPraf.globalCompositeOperation = 'lighter';

            const t = now / 1000;
            const p = progresFinal();
            const colturi = { ss: [0, 0, 1, 1], ds: [W, 0, -1, 1], sj: [0, H, 1, -1], dj: [W, H, -1, -1] };
            const zs = CONFIG.membri.map((m, i) => {
                const c = colturi[m.zona];
                return { x: c[0], y: c[1], ang: Math.atan2(c[3], c[2]), v: valoriZona[i] * (1 - p), col: m.culoare };
            });

            // palpaire fina a fasciculelor
            zone.forEach((z, i) => z.style.setProperty('--f', (0.94 + 0.06 * Math.sin(t * 7 + i * 2) * Math.sin(t * 3.1 + i)).toFixed(3)));

            const sprijin = Math.max(W, H) * 0.95;
            for (const m of mote) {
                m.x += m.vx * dt; m.y += m.vy * dt;
                if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
                if (m.x < -0.02) m.x = 1.02;
                if (m.x > 1.02) m.x = -0.02;
                const px = m.x * W, py = m.y * H + Math.sin(t * 0.6 + m.ph) * 6;

                let a = 0, best = 0, col = null;
                for (const z of zs) {
                    if (z.v < 0.02) continue;
                    const dx = px - z.x, dy = py - z.y;
                    const d = Math.hypot(dx, dy);
                    let df = Math.atan2(dy, dx) - z.ang;
                    df = Math.abs(Math.atan2(Math.sin(df), Math.cos(df)));
                    const inb = clamp01(1 - df / 0.56);
                    const c = z.v * inb * inb * clamp01(1 - d / sprijin);
                    a += c;
                    if (c > best) { best = c; col = z.col; }
                }
                if (a < 0.015 || !col) continue;
                const tw = 0.6 + 0.4 * Math.sin(t * 2 + m.ph);
                gPraf.fillStyle = 'rgba(' + col + ',' + Math.min(1, a * 0.95 * tw).toFixed(3) + ')';
                gPraf.beginPath();
                gPraf.arc(px, py, m.r * (1 + a), 0, 6.283);
                gPraf.fill();
            }
            gPraf.globalCompositeOperation = 'source-over';
            requestAnimationFrame(buclaPraf);
        }

        /* ---------- unde de sunet + egalizator + cercuri de ritm ---------- */
        const gUnde = canvasUnde.getContext('2d');
        let rulezUnde = false, nivelN = 0, bassN = 0, midY = null, ringA = 0;
        let culC = [255, 255, 255], culT = [255, 255, 255];
        const cardE = scenaE.querySelector('.card');

        function setCuloareUnde(s) { culT = s.split(',').map(Number); }

        function pornesteUnde() {
            if (rulezUnde) return;
            rulezUnde = true;
            requestAnimationFrame(deseneazaUnde);
        }

        function deseneazaUnde(now) {
            if (!rulezUnde) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const W = window.innerWidth, H = window.innerHeight;
            if (canvasUnde.width !== Math.round(W * dpr) || canvasUnde.height !== Math.round(H * dpr)) {
                canvasUnde.width = Math.round(W * dpr);
                canvasUnde.height = Math.round(H * dpr);
            }
            const g = gUnde;
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.clearRect(0, 0, W, H);

            const t = now / 1000;
            const spec = Sunet.spectru();
            const audioActiv = !!Sunet.forma();
            if (audioActiv) {
                nivelN += (Sunet.nivel() - nivelN) * 0.15;
                bassN += (Sunet.bass() - bassN) * 0.3;
            } else {   // fara audio: miscare "de repaus", ca sa nu ramana moarta
                nivelN += (0.12 + 0.08 * Math.sin(t * 1.9) * Math.sin(t * 0.7) - nivelN) * 0.1;
                bassN += (Math.max(0, Math.sin(t * 4)) * 0.4 - bassN) * 0.2;
            }

            for (let k = 0; k < 3; k++) culC[k] += (culT[k] - culC[k]) * 0.06;
            const cul = Math.round(culC[0]) + ',' + Math.round(culC[1]) + ',' + Math.round(culC[2]);

            const tintaMid = stage === 'e' ? H * 0.8 : H * 0.5;
            midY = midY === null ? tintaMid : midY + (tintaMid - midY) * 0.04;
            const mid = midY;

            // egalizator pe margine de jos
            const n = 48, bw = W / n;
            for (let i = 0; i < n; i++) {
                let v;
                if (spec) v = spec[1 + Math.floor(Math.pow(i / n, 1.6) * spec.length * 0.65)] / 255;
                else v = 0.2 + 0.15 * Math.sin(i * 0.6 + t * 2) * Math.sin(t * 1.3 + i * 0.2);
                const h = Math.max(2, v * H * 0.2);
                g.fillStyle = 'rgba(' + cul + ',' + (0.1 + v * 0.22).toFixed(3) + ')';
                g.fillRect(i * bw + bw * 0.15, H - h, bw * 0.7, h);
            }

            // unde pline (translucide) + linii
            for (let l = 0; l < 6; l++) {
                const amp = H * (0.025 + 0.012 * l) + nivelN * H * (0.15 - l * 0.018);
                g.beginPath();
                const puncteL = [];
                for (let x = 0; x <= W; x += 6) {
                    const u = x / W;
                    const env = Math.pow(Math.sin(Math.PI * u), 1.3);
                    const y = mid + env * amp * (
                        Math.sin(u * (6 + l * 2.3) + t * (0.9 + l * 0.35) + l) +
                        0.5 * Math.sin(u * (13 + l * 3) - t * (1.3 + l * 0.2))
                    );
                    puncteL.push(x, y);
                    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.strokeStyle = 'rgba(' + cul + ',' + (0.8 - l * 0.11).toFixed(2) + ')';
                g.lineWidth = 3.4 - l * 0.42;
                g.stroke();
                if (l < 3) {
                    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
                    const gr = g.createLinearGradient(0, mid - amp * 1.5, 0, H);
                    gr.addColorStop(0, 'rgba(' + cul + ',' + (0.15 - l * 0.04).toFixed(3) + ')');
                    gr.addColorStop(1, 'rgba(' + cul + ',0)');
                    g.fillStyle = gr;
                    g.fill();
                }
            }

            // forma de unda reala a piesei (daca audio e incarcat)
            const data = Sunet.forma();
            if (data) {
                g.beginPath();
                const len = data.length;
                for (let x = 0; x <= W; x += 4) {
                    const u = x / W;
                    const s = (data[Math.floor(u * (len - 1))] - 128) / 128;
                    const env = Math.pow(Math.sin(Math.PI * u), 1.1);
                    const y = mid + s * H * 0.3 * env;
                    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
                }
                g.strokeStyle = 'rgba(255,240,210,0.9)';
                g.lineWidth = 2;
                g.stroke();
            }

            // scena "ritmul piesei": cercuri care pulseaza cu bass-ul
            ringA += ((stage === 'e' ? 1 : 0) - ringA) * 0.03;
            if (ringA > 0.01) {
                for (let k = 0; k < 5; k++) {
                    const r = H * 0.16 + k * H * 0.1 + bassN * H * 0.06 * (1 - k * 0.15);
                    g.beginPath();
                    g.arc(W / 2, H * 0.52, r, 0, 6.283);
                    g.strokeStyle = 'rgba(255,255,255,' + ((0.16 - k * 0.025) * ringA).toFixed(3) + ')';
                    g.lineWidth = 2 + bassN * 5;
                    g.stroke();
                }
                cardE.style.setProperty('--bit', bassN.toFixed(3));
            }

            requestAnimationFrame(deseneazaUnde);
        }

        /* ---------- confeti ---------- */
        const gConf = canvasConfeti.getContext('2d');
        let confeti = [], rulezConf = false, ultimConf = 0;

        function lanseazaConfeti() {
            const W = window.innerWidth, H = window.innerHeight;
            canvasConfeti.width = W; canvasConfeti.height = H;
            const culori = CONFIG.membri.map(m => 'rgb(' + m.culoare + ')').concat(['#f5d77a', '#ffffff', '#f5d77a']);
            for (let i = 0; i < 170; i++) {
                confeti.push({
                    x: W / 2 + rand(-60, 60), y: H * 0.95,
                    vx: rand(-520, 520), vy: rand(-1250, -650), g: rand(900, 1100),
                    rot: rand(0, 6.28), vr: rand(-9, 9),
                    w: rand(7, 13), h: rand(4, 8),
                    c: culori[(Math.random() * culori.length) | 0],
                    life: rand(2.8, 4.6), age: 0
                });
            }
            Sunet.sfx.confeti();
            if (!rulezConf) { rulezConf = true; ultimConf = performance.now(); requestAnimationFrame(buclaConfeti); }
        }

        function buclaConfeti(now) {
            const dt = Math.min(0.05, (now - ultimConf) / 1000);
            ultimConf = now;
            const W = canvasConfeti.width, H = canvasConfeti.height;
            gConf.clearRect(0, 0, W, H);
            for (let i = confeti.length - 1; i >= 0; i--) {
                const c = confeti[i];
                c.age += dt;
                if (c.age > c.life || c.y > H + 40) { confeti.splice(i, 1); continue; }
                c.vy += c.g * dt;
                c.vx *= Math.exp(-0.6 * dt);
                c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
                const a = c.age > c.life * 0.75 ? 1 - (c.age - c.life * 0.75) / (c.life * 0.25) : 1;
                gConf.save();
                gConf.globalAlpha = Math.max(0, a);
                gConf.translate(c.x, c.y);
                gConf.rotate(c.rot);
                gConf.scale(1, Math.cos(c.age * 8 + c.vr));   // efect de rasucire
                gConf.fillStyle = c.c;
                gConf.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                gConf.restore();
            }
            if (confeti.length) requestAnimationFrame(buclaConfeti);
            else { rulezConf = false; gConf.clearRect(0, 0, W, H); }
        }

        /* ---------- salt direct la o etapa (pentru teste): #etapa=b|c|d|e|sfarsit ---------- */
        function sari(etapa) {
            const ordine = ['b', 'c', 'd', 'e', 'sfarsit'];
            const k = ordine.indexOf(etapa);
            if (k < 0) return;
            arataControale();
            pregatit = true;
            apasaIntrerupator();
            if (k >= 1) setTimeout(() => faders.forEach(f => f.set(0.85)), 600);
            if (k >= 2) setTimeout(() => faderFinal.set(1), 4200);
            if (k >= 3) setTimeout(treciLaE, 5600);
            if (k >= 4) setTimeout(trageSfoara, 8500);
        }

        /* ---------- init ---------- */
        construieste();
        sw.addEventListener('click', apasaIntrerupator);
        sfoara.addEventListener('click', trageSfoara);
        sfoara.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trageSfoara(); }
        });
        btnReia.addEventListener('click', () => { window.location.href = window.location.pathname; });

        return {
            // apelat cand porneste fumul: controalele apar dupa ce textul e vizibil
            programeaza() { setTimeout(arataControale, 5600); },
            sari
        };
    })();

    /* =====================================================================
       FLUX GENERAL
       ===================================================================== */
    // 1. Click oriunde pe ecranul 1 → slide up (+ porneste muzica: browserul cere un click)
    document.addEventListener('click', () => {
        Sunet.init();
        sunetBtn.classList.add('vizibil');
        if (body.classList.contains('urca')) return;
        body.classList.add('urca');
        setTimeout(Fum.idle, 2600);         // fuioare mici din duza, inainte de click
        console.log("Camera coboara...");
    });

    // 2. Click pe aparat → fum care acopera + trecere la final
    function pornesteFum(e) {
        if (e) e.stopPropagation();
        if (body.classList.contains('fum')) return;
        body.classList.add('fum');
        console.log("Fum! Acopar ecranul...");
        Fum.start();
        Final.programeaza();
    }
    aparatFum.addEventListener('click', pornesteFum);
    aparatFum.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pornesteFum(); }
    });

    // Test rapid: adauga #etapa=b|c|d|e|sfarsit la adresa ca sa sari direct la acea etapa
    const salt = window.location.hash.match(/etapa=(\w+)/);
    if (salt) {
        body.classList.add('urca', 'fum', 'salt');
        Final.sari(salt[1]);
    }
});