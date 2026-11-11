// ============================================================
//  CONFIGURACIÓN — edita aquí lo que necesites
// ============================================================
window.APP_CONFIG = {
  // Mensaje que se muestra en el centro de la pantalla de acceso
  message: "when you can't go to your two-wheel therapy. Come here...",

  // Contraseña de acceso (solo números)
  password: "28082026",

  // Canciones (dentro de la carpeta "audio"), en orden de reproducción.
  // El botón "siguiente" avanza por la lista y, tras la última, vuelve a la primera.
  audioFiles: ["audio/musica.mp3", "audio/musica2.mp3", "audio/musica3.mp3"],

    // ----- Galería de fotos (carpeta "pictures") -----
  galleryTitle: "Nuestros momentos",
  gallerySubtitle: "Cada foto, un kilómetro de historia",
  slideshowSeconds: 5, // duración de cada foto en modo presentación

  // Puedes poner solo la ruta, o un objeto con descripción (caption) opcional.
  photos: Array.from({ length: 16 }, (_, i) => `Pictures/Imagen${i + 1}.jpg`),

  // Volumen inicial (0 a 1)
  initialVolume: 0.6,
};
