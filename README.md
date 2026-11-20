# Sazón 2.0 · Landing cinematográfica

Web estática (HTML + CSS + JS, sin compilación). Todo lo que se publica está en esta carpeta.

- `index.html` — la landing (píxel de Meta, checkout de Hotmart con `checkoutMode=10`, guía de Yape)
- `frames/` y `frames-movil/` — fotogramas de la película que se mueve con el scroll (escritorio / celular)
- `audio/musica_escena.mp3` (escena de la señora) y `audio/musica_pagina.mp3` (resto de la página): suenan solo al tocar «Activar sonido»

Para verla en el PC: `python -m http.server 8080` dentro de esta carpeta y abrir http://localhost:8080

Para publicarla: Vercel / Netlify / Cloudflare Pages / GitHub Pages, como sitio estático, sin comando de build y con esta carpeta como raíz.
