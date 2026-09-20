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
})();
