(() => {
  const cfg = window.APP_CONFIG;
  const $ = (id) => document.getElementById(id);

  // ---------- Login ----------
  const loginScreen = $("login-screen");
  const sunScreen = $("sun-screen");
  const pinDisplay = $("pin-display");
  const pinError = $("pin-error");
  const total = cfg.password.length;
  let entered = "";

  $("message").textContent = cfg.message;

  for (let i = 0; i < total; i++) pinDisplay.appendChild(document.createElement("span"));
  const dots = [...pinDisplay.children];

  function render() {
    dots.forEach((d, i) => d.classList.toggle("filled", i < entered.length));
  }

  function press(key) {
    pinError.textContent = "";
    if (key === "clear") entered = "";
    else if (key === "back") entered = entered.slice(0, -1);
    else if (/^\d$/.test(key) && entered.length < total) entered += key;
    render();
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
    }
  }

  $("keypad").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-key]");
    if (btn) press(btn.dataset.key);
  });

  document.addEventListener("keydown", (e) => {
    if (!loginScreen.classList.contains("active")) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === "Backspace") press("back");
    else if (e.key === "Escape") press("clear");
  });

  function unlock() {
    loginScreen.classList.remove("active");
    sunScreen.classList.add("active");
    startAudio();
  }

  // ---------- Audio ----------
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
