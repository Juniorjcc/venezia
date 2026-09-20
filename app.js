(() => {
  const cfg = window.APP_CONFIG;
  const $ = (id) => document.getElementById(id);

  // ---------- Velocidad de la escena ----------
  // Todas las animaciones de la escena (fondo, camino, ruedas, pedales...) comparten
  // el mismo playbackRate, así que las ruedas siguen sincronizadas con el camino
  // a cualquier velocidad.
  let animations = [];
  let rate = 0.18;
  let target = 0.18;
  let easing = 0.07;
  let raf = 0;

  function collectAnimations() {
    if (typeof CSSAnimation === "undefined") return;
    animations = document
      .getAnimations()
      .filter((a) => a instanceof CSSAnimation && a.effect?.target?.closest?.("[data-rate]"));
    applyRate();
  }

  function applyRate() {
    animations.forEach((a) => { a.playbackRate = rate; });
  }

  function tick() {
    rate += (target - rate) * easing;
    if (Math.abs(target - rate) < 0.002) rate = target;
    applyRate();
    raf = rate === target ? 0 : requestAnimationFrame(tick);
  }

  function setSpeed({ to, boostTo, ease = 0.07 }) {
    target = to;
    easing = ease;
    if (boostTo !== undefined) rate = boostTo;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const baseSpeed = (digits) => 0.18 + digits * 0.05;

  window.addEventListener("load", () => requestAnimationFrame(collectAnimations));

  // ---------- Login ----------
  const loginScreen = $("login-screen");
  const pinDisplay = $("pin-display");
  const pinError = $("pin-error");
  const total = cfg.password.length;
  let entered = "";
  let unlocked = false;

  $("message").textContent = cfg.message;

  for (let i = 0; i < total; i++) pinDisplay.appendChild(document.createElement("span"));
  const dots = [...pinDisplay.children];

  function render() {
    dots.forEach((d, i) => d.classList.toggle("filled", i < entered.length));
  }

  function press(key) {
    if (unlocked) return;
    pinError.textContent = "";
    const before = entered.length;
    if (key === "clear") entered = "";
    else if (key === "back") entered = entered.slice(0, -1);
    else if (/^\d$/.test(key) && entered.length < total) entered += key;
    render();

    if (entered.length > before) {
      // cada dígito es un "pedalazo": la escena se acelera y luego se asienta
      setSpeed({ to: baseSpeed(entered.length), boostTo: Math.min(rate + 0.35, 1.3), ease: 0.06 });
    } else if (entered.length < before) {
      setSpeed({ to: baseSpeed(entered.length) });
    }

    if (entered.length === total) setTimeout(check, 150);
  }

  function check() {
    if (entered === cfg.password) {
      unlock();
    } else {
      pinError.textContent = "Contraseña incorrecta";
      pinDisplay.classList.remove("shake");
      void pinDisplay.offsetWidth; // reinicia la animación
      pinDisplay.classList.add("shake");
      entered = "";
      render();
      setSpeed({ to: baseSpeed(0), boostTo: 0.04, ease: 0.05 }); // frenazo
    }
  }

  $("keypad").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) press(btn.dataset.key);
  });

  document.addEventListener("keydown", (e) => {
    if (unlocked) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("back");
    else if (e.key === "Escape") press("clear");
  });

  function unlock() {
    unlocked = true;
    document.body.classList.add("riding"); // amanece, sale la bici y aparece el reproductor
    loginScreen.setAttribute("aria-hidden", "true");
    setSpeed({ to: 1, ease: 0.025 });
    startAudio();
  }

  // ---------- Audio ----------
  // El <audio> vive fuera de las pantallas y nunca se recrea ni se le reasigna la
  // fuente: el cambio de pantalla solo añade una clase al <body>, así la canción
  // no se interrumpe ni se reinicia.
  const audio = $("audio");
  const playBtn = $("play-btn");
  const iconPlay = $("icon-play");
  const iconPause = $("icon-pause");
  const seek = $("seek");
  const volume = $("volume");
  const volumeValue = $("volume-value");
  const muteBtn = $("mute-btn");
  const audioError = $("audio-error");
  const timeCurrent = $("time-current");
  const timeTotal = $("time-total");
  let audioStarted = false;

  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  function setPlayingUI(playing) {
    // SVGElement no tiene la propiedad .hidden, se usa el atributo
    iconPlay.toggleAttribute("hidden", playing);
    iconPause.toggleAttribute("hidden", !playing);
    playBtn.setAttribute("aria-label", playing ? "Pausar" : "Continuar");
  }

  function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    audio.src = cfg.audioFile;
    audio.volume = cfg.initialVolume;
    volume.value = cfg.initialVolume;
    volumeValue.textContent = Math.round(cfg.initialVolume * 100) + "%";
    // Se llama tras el clic/tecla del login, por lo que el navegador permite reproducir.
    audio.play().catch(() => setPlayingUI(false));
  }

  playBtn.addEventListener("click", () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  audio.addEventListener("play", () => setPlayingUI(!audio.error));
  audio.addEventListener("pause", () => setPlayingUI(false));
  audio.addEventListener("ended", () => setPlayingUI(false));

  audio.addEventListener("loadedmetadata", () => {
    audioError.hidden = true;
    timeTotal.textContent = fmt(audio.duration);
  });
  audio.addEventListener("timeupdate", () => {
    timeCurrent.textContent = fmt(audio.currentTime);
    if (audio.duration) seek.value = (audio.currentTime / audio.duration) * 100;
  });
  seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  });

  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    audio.muted = false;
    volumeValue.textContent = Math.round(audio.volume * 100) + "%";
  });
  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    muteBtn.style.opacity = audio.muted ? 0.5 : 1;
  });

  audio.addEventListener("error", () => {
    audioError.textContent = `No se encontró el audio. Coloca tu archivo en "${cfg.audioFile}".`;
    audioError.hidden = false;
    setPlayingUI(false);
  });

  // ---------- Lluvia de girasoles ----------
  // Los pétalos caen con una inclinación hacia atrás proporcional a la velocidad
  // actual de la escena (`rate`), y los más cercanos (z alto) se mueven más rápido
  // que los lejanos para dar paralaje.
  const canvas = $("petals");
  const ctx = canvas.getContext("2d");
  const rootStyle = getComputedStyle(document.documentElement);
  const roadSpeed = 1600 / (parseFloat(rootStyle.getPropertyValue("--road-t")) || 5); // px/s a rate = 1
  const WIND = 0.62; // fracción de la velocidad del camino que empuja a un pétalo cercano
  let cw = 0;
  let ch = 0;
  let particles = [];
  let petalsOn = false;
  let intensity = 0;
  let petalRaf = 0;
  let lastT = 0;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", () => {
    resizeCanvas();
    particles.forEach((p) => respawn(p, true)); // reparte los pétalos según el nuevo tamaño
  });
  resizeCanvas();

  function sprite(draw) {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.translate(32, 32);
    draw(g);
    return c;
  }

  function petalPath(g, len, w) {
    g.beginPath();
    g.moveTo(0, len);
    g.bezierCurveTo(w, len * 0.5, w * 0.9, -len * 0.5, 0, -len);
    g.bezierCurveTo(-w * 0.9, -len * 0.5, -w, len * 0.5, 0, len);
  }

  const petalSprites = [["#ffd23a", "#f2a20c"], ["#ffc21a", "#e88a00"], ["#ffe066", "#f5b50a"]].map(([a, b]) =>
    sprite((g) => {
      const grad = g.createLinearGradient(0, -28, 0, 28);
      grad.addColorStop(0, a);
      grad.addColorStop(1, b);
      g.fillStyle = grad;
      petalPath(g, 28, 17);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, 22);
      g.lineTo(0, -18);
      g.stroke();
    })
  );

  const flowerSprite = sprite((g) => {
    for (let i = 0; i < 14; i++) {
      g.save();
      g.rotate((i * Math.PI * 2) / 14);
      g.fillStyle = i % 2 ? "#ffc81f" : "#f0a30a";
      g.beginPath();
      g.ellipse(0, -20, 5.2, 11.5, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.fillStyle = "#5a3510";
    g.beginPath();
    g.arc(0, 0, 11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#b98240";
    for (let i = 1; i < 26; i++) {
      const r = 1.9 * Math.sqrt(i);
      const a = i * 2.39996;
      g.beginPath();
      g.arc(r * Math.cos(a), r * Math.sin(a), 0.9, 0, Math.PI * 2);
      g.fill();
    }
  });

  function respawn(p, initial) {
    const drift = Math.max(0, -WIND * roadSpeed * rate) * (ch / 70); // lo que se desplaza hacia atrás mientras cae
    p.z = 0.35 + Math.random() * 0.65;
    p.flower = Math.random() < 0.4;
    p.sprite = p.flower ? flowerSprite : petalSprites[(Math.random() * petalSprites.length) | 0];
    p.size = (10 + 24 * p.z) * (p.flower ? 1.25 : 1);
    p.x = -30 + Math.random() * (cw + Math.min(drift, cw * 1.5) + 60);
    p.y = initial ? -ch * 0.4 + Math.random() * ch : -40 - Math.random() * 80;
    p.vx = 0;
    p.vy = 38 + 95 * p.z + Math.random() * 25;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = (Math.random() - 0.5) * 3;
    p.phase = Math.random() * Math.PI * 2;
    p.flip = 1.5 + Math.random() * 2.5;
    // la carretera ocupa los ~118px inferiores: los pétalos lejanos aterrizan arriba, los cercanos abajo
    p.ground = ch - (118 - ((p.z - 0.35) / 0.65) * 94) + (Math.random() - 0.5) * 10;
    p.landed = false;
    p.life = 0;
  }

  function petalFrame(now) {
    const dt = Math.min((now - lastT) / 1000 || 0.016, 0.05);
    lastT = now;
    intensity += ((petalsOn ? 1 : 0) - intensity) * Math.min(1, dt * 2.5);
    ctx.clearRect(0, 0, cw, ch);

    const wind = -WIND * roadSpeed * rate; // negativo: hacia atrás
    const t = now / 1000;

    for (const p of particles) {
      if (p.landed) {
        // sobre el asfalto: se va con el camino y se desvanece
        p.x -= roadSpeed * rate * (0.55 + 0.45 * p.z) * dt;
        p.life -= dt;
        if (p.life <= 0 || p.x < -60) respawn(p, false);
      } else {
        p.vx += (wind * p.z + Math.sin(t * 1.6 + p.phase) * 14 - p.vx) * Math.min(1, dt * 3);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y >= p.ground) {
          p.landed = true;
          p.life = 1.6;
          p.y = p.ground;
        } else if (p.x < -60) {
          respawn(p, false);
        }
      }

      const fade = p.landed ? Math.min(1, p.life / 0.9) : 1;
      const alpha = intensity * fade * (0.6 + 0.4 * p.z);
      if (alpha < 0.01) continue;
      // el giro en 3D del pétalo se simula aplastándolo en un eje
      const squash = p.landed ? 0.32 : 0.35 + 0.65 * Math.abs(Math.cos(t * p.flip + p.phase));
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      // el pétalo se alinea con su trayectoria (más inclinado cuanto más rápido se avanza)
      ctx.rotate(p.landed ? p.rot : Math.atan2(-p.vx, p.vy) + Math.sin(p.rot) * 0.6);
      ctx.scale(1, squash);
      ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (!petalsOn && intensity < 0.01) {
      particles = [];
      ctx.clearRect(0, 0, cw, ch);
      petalRaf = 0;
      return;
    }
    petalRaf = requestAnimationFrame(petalFrame);
  }

  function setPetals(on) {
    petalsOn = on;
    if (on && !particles.length) {
      resizeCanvas(); // por si el tamaño de la ventana cambió o aún no estaba disponible al cargar
      const n = Math.round(Math.min(90, Math.max(36, cw / 16)));
      particles = Array.from({ length: n }, () => {
        const p = {};
        respawn(p, true);
        return p;
      });
    }
    if (!petalRaf) {
      lastT = performance.now();
      petalRaf = requestAnimationFrame(petalFrame);
    }
  }

  // ---------- Cambio de tema: Modo Girasol ----------
  // Solo cambia una clase del <body> (y los pétalos); el <audio> no se toca.
  const skinBtn = $("skin-btn");
  const bikeEl = document.querySelector(".bike");

  skinBtn.addEventListener("click", () => {
    const on = document.body.classList.toggle("sunflower");
    skinBtn.setAttribute("aria-pressed", String(on));
    skinBtn.setAttribute("aria-label", on ? "Volver al modo normal" : "Activar modo girasol");
    bikeEl.classList.remove("morph");
    void bikeEl.offsetWidth;
    bikeEl.classList.add("morph");
    setPetals(on);
  });
  bikeEl.addEventListener("animationend", (e) => {
    if (e.animationName === "morph") bikeEl.classList.remove("morph");
  });
})();
