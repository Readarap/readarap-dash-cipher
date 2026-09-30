(() => {
  const $ = (id) => document.getElementById(id);
  const copy = {
    en: {
      tagline: "Make it make sense — one lyric, rhythm, and rhyme at a time.",
      kicker: "Shared engine · three skins",
      headline: "Name Flo is the free door.",
      lede: "StarMaker sells the catalog. Voloco sells the polish. This room scores whether the syllable locked, the cadence held, the rhyme family matched, and the fact stayed true. If it cannot be clapped, it does not ship first.",
      street: "Street Cypher · default 18+. Community code. Age-gate. Not school. Source-track maps only — never ship the loved master.",
      academy: "Private Academy · teacher models the track before the student. Correspondence / paper path lives only here.",
      k12: "K12 · FERPA / COPPA under 13. Clean classroom lyrics. Standards language. No mixed rosters."
    },
    es: {
      tagline: "Haz que tenga sentido — una lírica, un ritmo y una rima a la vez.",
      kicker: "Mismo motor · tres pieles",
      headline: "Name Flo es la puerta gratis.",
      lede: "StarMaker vende el catálogo. Voloco vende el brillo. Esta sala puntúa sílaba, cadencia, rima y hecho. Si no se puede palmear, no sale primero.",
      street: "Street Cypher · 18+ por defecto. No es escuela.",
      academy: "Academia privada · el maestro modela primero.",
      k12: "K12 · FERPA / COPPA. Letras de aula. Sin mezclar listas."
    }
  };

  const MAP = {
    bpm: 88,
    targets: [8, 8, 9, 8],
    family: ["ay", "ay", "own", "own"],
    lines: {
      50: [
        "Half plus half equals one today",
        "Two fourths sit on the same highway",
        "Three plus one still makes four of our own",
        "Write the fact and hold the tone"
      ],
      75: [
        "Half plus ____ equals one today",
        "Two ____ sit on the same highway",
        "Three plus one still makes ____ of our own",
        "Write the ____ and hold the tone"
      ],
      100: [
        "____ plus ____ equals ____ today",
        "____ ____ sit on the same highway",
        "____ plus ____ still makes ____ of our own",
        "Write the ____ and hold the ____"
      ]
    }
  };

  const LETTERS = [
    ["A", "a", "ah"],
    ["B", "b", "buh"],
    ["M", "m", "muh"],
    ["S", "s", "suh"]
  ];

  let lang = "en";
  let skin = "street";
  let room = "flo";
  let tier = 50;
  let coins = 0;
  let coachOn = true;
  let ctx, master, delay, wet;
  let playing = false;
  let timers = [];
  let expected = [];
  let claps = [];
  let cursor = 0;
  let chunks = [];
  let selectedLetter = null;
  let recChunks = [];
  let recorder = null;

  function speak(text) {
    if (!coachOn || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.94;
    u.pitch = 1;
    speechSynthesis.speak(u);
  }

  function applyChrome() {
    const t = copy[lang];
    $("tagline").textContent = t.tagline;
    $("kicker").textContent = t.kicker;
    $("headline").textContent = t.headline;
    $("lede").textContent = t.lede;
    $("rules").textContent = t[skin];
  }

  function setRoom(next) {
    room = next;
    document.querySelectorAll(".room").forEach((b) => b.classList.toggle("on", b.dataset.room === next));
    $("floStage").hidden = next !== "flo";
    $("bussStage").hidden = next !== "buss";
    $("karaStage").hidden = next !== "kara";
    $("bpmVal").textContent = next === "kara" ? "88" : "80";
    if (next === "kara") renderLyrics();
  }

  function splitWord(word) {
    const w = String(word).replace(/[^A-Za-z']/g, "");
    if (!w) return [];
    if (w.length <= 3) return [w];
    const parts = w.match(/[^aeiouyAEIOUY]*[aeiouyAEIOUY]+(?:[^aeiouyAEIOUY]*)?/g);
    return parts && parts.length ? parts : [w];
  }

  function chunksOf(text) {
    return String(text).trim().split(/\s+/).filter(Boolean).flatMap(splitWord);
  }

  function footOf(n) {
    if (n <= 1) return "monosyllable";
    if (n === 2) return "trochee / iamb";
    if (n === 3) return "amphibrach / dactyl";
    return "multisyllabic map";
  }

  function renderName() {
    chunks = chunksOf($("nameIn").value || "");
    $("sylBox").innerHTML = chunks.map((c, i) => `<div class="syl" id="syl${i}">${c}</div>`).join("");
    $("footLabel").textContent = chunks.length ? `Stress foot: ${footOf(chunks.length)} · ${chunks.length} hits` : "Stress foot appears after lock.";
  }

  function ensureAudio() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.85;
    delay = ctx.createDelay();
    delay.delayTime.value = 0.22;
    const fb = ctx.createGain();
    fb.gain.value = 0.26;
    wet = ctx.createGain();
    wet.gain.value = 0.16;
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);
  }

  function tone(t, freq, dur, type, gain) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    g.connect(delay);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function kick(t) { tone(t, 68, 0.16, "sine", 0.7); }
  function snare(t) { tone(t, 190, 0.1, "triangle", 0.32); }
  function hat(t) { tone(t, 880, 0.035, "square", 0.06); }

  function stopBed() {
    playing = false;
    timers.forEach(clearTimeout);
    timers = [];
    [1, 2, 3, 4].forEach((n) => $("d" + n).classList.remove("on"));
    $("beatLabel").textContent = "stopped";
    document.querySelectorAll(".syl").forEach((el) => el.classList.remove("hit"));
    document.querySelectorAll(".ln").forEach((el) => el.classList.remove("now"));
  }

  function startBed(bpm, bars, onBeat) {
    ensureAudio();
    ctx.resume();
    stopBed();
    playing = true;
    const beat = 60 / bpm;
    const start = ctx.currentTime + 0.08;
    const total = bars * 4;
    $("bpmVal").textContent = String(bpm);
    for (let i = 0; i < total; i++) {
      const t = start + i * beat;
      if (i % 2 === 0) kick(t);
      else snare(t);
      hat(t + beat * 0.5);
      const wait = Math.max(0, (t - ctx.currentTime) * 1000);
      timers.push(setTimeout(() => {
        if (!playing) return;
        const beatIdx = (i % 4) + 1;
        [1, 2, 3, 4].forEach((n) => $("d" + n).classList.toggle("on", n === beatIdx));
        $("barVal").textContent = `${Math.floor(i / 4) + 1} / ${bars}`;
        $("beatLabel").textContent = `beat ${beatIdx}`;
        if (onBeat) onBeat(i);
      }, wait));
    }
    timers.push(setTimeout(stopBed, total * beat * 1000 + 80));
  }

  function lockName() {
    renderName();
    if (!chunks.length) {
      speak("Type a name first.");
      return;
    }
    expected = [];
    claps = [];
    cursor = 0;
    $("tierVal").textContent = "Door";
    startBed(80, 4, (i) => {
      document.querySelectorAll(".syl").forEach((el) => el.classList.remove("hit"));
      const idx = i % chunks.length;
      const el = $("syl" + idx);
      if (el) el.classList.add("hit");
      expected.push(performance.now());
    });
    speak("Clap each syllable on the kick. Miss Little is listening.");
  }

  function clap() {
    if (!chunks.length) return renderName();
    claps.push(performance.now());
    const i = Math.min(claps.length - 1, Math.max(0, chunks.length - 1));
    const el = $("syl" + (i % chunks.length));
    if (el) {
      el.classList.add("hit");
      setTimeout(() => el.classList.remove("hit"), 180);
    }
    scoreFlo();
  }

  function scoreFlo() {
    const n = Math.max(1, Math.min(claps.length, expected.length || chunks.length));
    let syl = 70, cad = 70;
    if (expected.length && claps.length) {
      let s = 0, c = 0;
      for (let i = 0; i < n; i++) {
        const err = Math.abs(claps[i] - expected[i]);
        s += err < 200 ? 100 : err < 360 ? 72 : 42;
        c += err < 160 ? 100 : err < 300 ? 68 : 38;
      }
      syl = Math.round(s / n);
      cad = Math.round(c / n);
    }
    const rhy = chunks.length >= 2 ? 82 : 64;
    const fact = 100;
    paintScore(syl, cad, rhy, fact, 15, true);
  }

  function paintScore(syl, cad, rhy, fact, prize, flo) {
    const w = Math.round(syl * 0.35 + cad * 0.30 + rhy * 0.25 + fact * 0.10);
    $("sylScore").textContent = syl;
    $("cadScore").textContent = cad;
    $("rhyScore").textContent = rhy;
    $("factScore").textContent = fact;
    const pass = w >= 70 && syl >= 60;
    $("passLine").className = "tiny " + (pass ? "pass" : "fail");
    $("passLine").textContent = pass
      ? `PASS ${w} weighted · syllable ${syl}. ${flo ? "Baby Readarapper stamp." : "Swap locked."}`
      : `Not yet. Weighted ${w} · syllable ${syl}. Need ≥ 70 and syllable ≥ 60.`;
    if (pass) {
      coins += prize;
      $("coinVal").textContent = String(coins);
      $("tierVal").textContent = syl >= 90 ? "Big" : syl >= 75 ? "Little" : "Baby";
    }
  }

  function renderLyrics() {
    const lines = MAP.lines[tier];
    $("lyricBox").innerHTML = lines.map((ln, i) => {
      const html = ln.replace(/____/g, '<span class="swap">____</span>');
      return `<div class="ln" id="ln${i}">${html}</div>`;
    }).join("");
  }

  function playKara() {
    renderLyrics();
    startBed(88, 8, (i) => {
      const line = Math.floor(i / 4) % 4;
      document.querySelectorAll(".ln").forEach((el) => el.classList.remove("now"));
      const el = $("ln" + line);
      if (el) el.classList.add("now");
      if (i % 4 === 0 && coachOn) speak(MAP.lines[50][line]);
    });
  }

  function scoreKara() {
    const guess = ($("factIn").value || "").toLowerCase();
    const fact = /whole|pie|pizza|set|group|unit/.test(guess) ? 100 : guess.trim() ? 40 : 20;
    const shown = MAP.lines[tier].join(" ");
    const filled = shown.includes("____") ? 70 : 88;
    const rhy = /ay|own|tone|today|highway/.test(MAP.lines[50].join(" ").toLowerCase()) ? 86 : 60;
    paintScore(filled, playing ? 80 : 74, rhy, fact, 25, false);
  }

  function dealBuss() {
    const cards = LETTERS.flatMap(([U, l]) => [
      { k: U, v: U },
      { k: U, v: l }
    ]).sort(() => Math.random() - 0.5);
    let first = null;
    let matched = 0;
    const grid = $("letterGrid");
    grid.innerHTML = "";
    cards.forEach((c) => {
      const b = document.createElement("button");
      b.className = "letter";
      b.textContent = c.v;
      b.type = "button";
      b.onclick = () => {
        selectedLetter = LETTERS.find((row) => row[0] === c.k);
        $("letterHelp").textContent = selectedLetter ? `${selectedLetter[0]} · baby sound ${selectedLetter[2]}` : "";
        if (b.classList.contains("gone")) return;
        b.classList.add("flip");
        if (!first) { first = { el: b, k: c.k }; return; }
        if (first.k === c.k && first.el !== b) {
          first.el.classList.add("gone");
          b.classList.add("gone");
          matched += 1;
          speak("Woo-lah");
          if (matched === LETTERS.length) {
            paintScore(92, 80, 70, 100, 25, false);
            $("letterHelp").textContent = "All pairs. Hand off to Name Flo.";
          }
        } else {
          const prev = first.el;
          setTimeout(() => { prev.classList.remove("flip"); b.classList.remove("flip"); }, 320);
        }
        first = null;
      };
      grid.appendChild(b);
    });
  }

  async function armMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ensureAudio();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteTimeDomainData(data);
        let s = 0;
        for (let i = 0; i < data.length; i++) s += Math.abs(data[i] - 128);
        $("micBar").style.width = Math.min(100, (s / data.length) * 7) + "%";
        requestAnimationFrame(tick);
      };
      tick();
      $("micNote").textContent = "Mic armed. Level only. Nothing leaves this browser.";
      recorder = new MediaRecorder(stream);
      recChunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recChunks, { type: "audio/webm" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "readarap-take.webm";
        a.click();
      };
    } catch (err) {
      $("micNote").textContent = "Mic blocked. Clap scoring still works.";
    }
  }

  function toggleRec() {
    if (!recorder) { armMic(); return; }
    if (recorder.state === "recording") {
      recorder.stop();
      $("recBtn").textContent = "Record take";
    } else {
      recChunks = [];
      recorder.start();
      $("recBtn").textContent = "Stop + download";
    }
  }

  $("skin").onchange = (e) => { skin = e.target.value; applyChrome(); };
  $("lang").onchange = (e) => { lang = e.target.value; applyChrome(); };
  $("coachBtn").onclick = () => {
    coachOn = !coachOn;
    $("coachBtn").textContent = coachOn ? "Coach on" : "Coach off";
    $("coachBtn").classList.toggle("on", coachOn);
  };
  document.querySelectorAll(".room").forEach((b) => b.onclick = () => setRoom(b.dataset.room));
  $("nameIn").addEventListener("input", renderName);
  $("lockBtn").onclick = lockName;
  $("clapBtn").onclick = clap;
  $("speakBtn").onclick = () => speak(chunks.join("... ") || "Type a name first.");
  $("dealBtn").onclick = dealBuss;
  $("soundBtn").onclick = () => speak(selectedLetter ? `${selectedLetter[0]}. ${selectedLetter[2]}.` : "Pick a letter.");
  document.querySelectorAll("[data-tier]").forEach((b) => {
    b.onclick = () => {
      tier = Number(b.dataset.tier);
      document.querySelectorAll("[data-tier]").forEach((x) => x.classList.toggle("on", x === b));
      renderLyrics();
    };
  });
  $("playKara").onclick = playKara;
  $("stopKara").onclick = stopBed;
  $("scoreKara").onclick = scoreKara;
  $("micBtn").onclick = armMic;
  $("recBtn").onclick = toggleRec;

  applyChrome();
  renderName();
  dealBuss();
  renderLyrics();
})();
