/* Landing cinematográfica: secuencia de fotogramas en <canvas> controlada por el scroll.
   Lee frames/manifest.json (o frames-movil/manifest.json en pantallas verticales) que crea scripts/frames.py. */
(() => {
  "use strict";

  const AJUSTES = {
    precargaInicial: 25,     // fotogramas que se cargan antes de quitar la pantalla de carga
    suavizado: 0.6,          // scrub de ScrollTrigger (segundos de "inercia")
    fundido: 0.035,          // parte del scroll que dura la entrada/salida de cada bloque HUD
    volumen: 0.85,
    audio: "audio/musica_escena.mp3",
    audioHasta: 0.85,        // progreso del #cine (0-1) desde el que el ambiente se apaga; null = suena en toda la página
    audioFundido: 0.2,       // cuánto scroll (en progreso del #cine) tarda en apagarse
    audioDespues: "audio/musica_pagina.mp3",      // otra pista para el resto de la página (entra cuando sale la de la película), p. ej. "audio/musica_pagina.mp3"
  };

  // Prueba de opciones: index.html?sonido=opcion_1_criolla usa audio/opciones/opcion_1_criolla.mp3
  const probarSonido = new URLSearchParams(location.search).get("sonido");
  if (probarSonido && /^[\w-]+$/.test(probarSonido)) AJUSTES.audio = `audio/opciones/${probarSonido}.mp3`;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hayGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  const lienzo = $("#lienzo");
  const ctx = lienzo.getContext("2d", { alpha: false });
  const escena = $("#cine");
  const huds = $$(".hud");
  const indicador = $(".indicador");
  const barraCine = $("#progreso-cine");

  let fotos = [];          // Image por índice
  let listas = [];         // true si cargó
  let total = 0;
  let actual = -1;
  let pendiente = 0;

  /* ---------- Elegir secuencia (escritorio o móvil) ---------- */
  async function leerManifest(carpeta) {
    try {
      const r = await fetch(`${carpeta}/manifest.json`, { cache: "no-cache" });
      if (!r.ok) return null;
      const m = await r.json();
      return m && m.cantidad ? { ...m, carpeta } : null;
    } catch { return null; }
  }

  async function elegirSecuencia() {
    const vertical = innerHeight > innerWidth * 1.1;
    if (vertical) {
      const m = await leerManifest("frames-movil");
      if (m) return m;
    }
    return (await leerManifest("frames")) || { carpeta: "frames", cantidad: 110, digitos: 4 };
  }

  const ruta = (m, i) => `${m.carpeta}/frame_${String(i + 1).padStart(m.digitos || 4, "0")}.webp`;

  function cargar(m, i) {
    return new Promise((ok) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { listas[i] = true; ok(true); };
      img.onerror = () => ok(false);
      img.src = ruta(m, i);
      fotos[i] = img;
    });
  }

  /* ---------- Dibujo con object-fit: cover ---------- */
  function ajustarLienzo() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(lienzo.clientWidth * dpr);
    const h = Math.round(lienzo.clientHeight * dpr);
    if (lienzo.width !== w || lienzo.height !== h) {
      lienzo.width = w; lienzo.height = h;
      const i = actual; actual = -1; dibujar(i < 0 ? 0 : i);
    }
  }

  function masCercana(i) {
    if (listas[i]) return i;
    for (let d = 1; d < total; d++) {
      if (listas[i - d]) return i - d;
      if (listas[i + d]) return i + d;
    }
    return -1;
  }

  function dibujar(i) {
    const j = masCercana(i);
    if (j < 0 || j === actual) return;
    actual = j;
    const img = fotos[j];
    const cw = lienzo.width, ch = lienzo.height;
    const esc = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  /* ---------- HUD ---------- */
  function opacidadHud(p, desde, hasta) {
    const f = AJUSTES.fundido;
    if (p < desde || p > hasta) return 0;
    const entrada = desde <= 0 ? 1 : Math.min(1, (p - desde) / f);
    const salida = hasta >= 1 ? 1 : Math.min(1, (hasta - p) / f);
    return Math.max(0, Math.min(entrada, salida));
  }

  function actualizarHud(p) {
    for (const el of huds) {
      const o = opacidadHud(p, parseFloat(el.dataset.desde), parseFloat(el.dataset.hasta));
      el.style.opacity = o.toFixed(3);
      el.style.visibility = o > 0.01 ? "visible" : "hidden";
      el.style.setProperty("--y", `${((1 - o) * 24).toFixed(1)}px`);
      el.style.pointerEvents = o > 0.5 ? "auto" : "none";
    }
    if (indicador) indicador.style.opacity = p > 0.03 ? 0 : 0.8;
    if (barraCine) barraCine.style.width = `${(p * 100).toFixed(2)}%`;
  }

  function alAvanzar(p) {
    pendiente = Math.min(total - 1, Math.max(0, Math.round(p * (total - 1))));
    dibujar(pendiente);
    actualizarHud(p);
  }

  /* ---------- Scroll ---------- */
  function iniciarScroll() {
    if (!hayGsap) {
      // Sin GSAP (CDN caído): scroll nativo
      const calc = () => {
        const r = escena.getBoundingClientRect();
        const rango = escena.offsetHeight - innerHeight;
        alAvanzar(Math.min(1, Math.max(0, -r.top / rango)));
      };
      addEventListener("scroll", calc, { passive: true });
      calc();
      document.documentElement.classList.add("sin-anim");
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    if (!reducido && typeof Lenis !== "undefined") {
      const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        if (id.length > 1 && $(id)) { e.preventDefault(); lenis.scrollTo(id, { offset: 0 }); }
      }));
    }

    const estado = { p: 0 };
    ScrollTrigger.create({
      trigger: escena, start: "top top", end: "bottom bottom",
      onUpdate: (st) => gsap.to(estado, {
        p: st.progress, duration: reducido ? 0 : AJUSTES.suavizado, ease: "power2.out", overwrite: true,
        onUpdate: () => alAvanzar(estado.p),
      }),
    });

    if (reducido) { document.documentElement.classList.add("sin-anim"); return; }
    ScrollTrigger.batch(".revelar", {
      start: "top 88%",
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.08 }),
    });
  }

  /* ---------- Sonido (solo con clic) ---------- */
  // Con AJUSTES.audioHasta el ambiente acompaña solo a la película: se apaga al terminar y vuelve si el visitante sube.
  function factorEscena() {
    const desde = AJUSTES.audioHasta;
    if (desde == null || !escena) return 1;
    const rango = Math.max(1, escena.offsetHeight - innerHeight);
    const p = -escena.getBoundingClientRect().top / rango;
    return Math.max(0, Math.min(1, 1 - (p - desde) / AJUSTES.audioFundido));
  }

  function iniciarSonido() {
    const boton = $("#sonido");
    if (!boton) return;
    const pista = (src) => { const a = new Audio(); a.loop = true; a.preload = "none"; a.volume = 0; a.dataset.src = src; return a; };
    const pistas = [pista(AJUSTES.audio)];
    if (AJUSTES.audioDespues && AJUSTES.audioHasta != null) pistas.push(pista(AJUSTES.audioDespues));
    fetch(AJUSTES.audio, { method: "HEAD" }).then((r) => {
      if (r.ok) { pistas.forEach((a) => { a.src = a.dataset.src; }); boton.hidden = false; }
    }).catch(() => {});
    const texto = $(".sonido-texto", boton);
    let encendido = false, bucle = null;
    const mover = (a, meta) => {
      const v = a.volume + (meta - a.volume) * 0.12;
      a.volume = Math.max(0, Math.min(1, Math.abs(meta - v) < 0.005 ? meta : v));
      if (meta > 0 && a.paused) a.play().catch(() => {});
      if (meta === 0 && a.volume === 0 && !a.paused) a.pause();
    };
    const mezclar = () => {
      const f = factorEscena();
      // la de la película suena con f; la del resto de la página entra cuando aquella sale
      mover(pistas[0], encendido ? AJUSTES.volumen * f : 0);
      if (pistas[1]) mover(pistas[1], encendido ? AJUSTES.volumen * (1 - f) : 0);
      if (!encendido && pistas.every((a) => a.volume === 0)) { clearInterval(bucle); bucle = null; }
    };
    boton.addEventListener("click", () => {
      encendido = boton.getAttribute("aria-pressed") !== "true";
      boton.setAttribute("aria-pressed", String(encendido));
      texto.textContent = encendido ? "Silenciar" : "Activar sonido";
      if (encendido) {   // dentro del clic: el navegador lo exige
        const f = factorEscena();
        (pistas[1] && f < 0.5 ? pistas[1] : pistas[0]).play().catch(() => {});
      }
      if (!bucle) bucle = setInterval(mezclar, 40);
    });
  }

  /* ---------- Order bump ---------- */
  function iniciarBump() {
    const check = $("#bump-check"), totalEl = $("#precio-total"), cta = $("#cta-compra"), bump = $("#bump");
    if (!check || !totalEl || !cta || !bump) return;
    const base = parseFloat(totalEl.dataset.base), extra = parseFloat(bump.dataset.precio), mon = totalEl.dataset.moneda || "$";
    const fmt = (n) => mon + (Number.isInteger(n) ? n : n.toFixed(2));
    check.addEventListener("change", () => {
      totalEl.textContent = fmt(check.checked ? base + extra : base);
      cta.href = check.checked ? cta.dataset.linkBump : cta.dataset.link;
    });
  }

  /* ---------- Arranque ---------- */
  async function iniciar() {
    document.body.classList.add("cargando");
    const m = await elegirSecuencia();
    total = m.cantidad;
    fotos = new Array(total); listas = new Array(total).fill(false);
    ajustarLienzo();

    const primeros = Math.min(AJUSTES.precargaInicial, total);
    let hechos = 0;
    const barra = $("#cargador-progreso"), pct = $("#cargador-pct");
    // primeros fotogramas repartidos por toda la secuencia: así el scroll rápido nunca se queda en blanco
    const orden = [0];
    for (let k = 1; k < primeros; k++) orden.push(Math.round((k * (total - 1)) / (primeros - 1)));
    const unicos = [...new Set(orden)];
    await Promise.all(unicos.map((i) => cargar(m, i).then(() => {
      hechos++;
      const v = Math.round((hechos / unicos.length) * 100);
      barra.style.width = v + "%"; pct.textContent = v;
    })));

    dibujar(0);
    actualizarHud(0);
    $("#cargador").classList.add("fuera");
    document.body.classList.remove("cargando");
    iniciarScroll();

    // resto en segundo plano, de 6 en 6
    const resto = [];
    for (let i = 0; i < total; i++) if (!fotos[i]) resto.push(i);
    const tanda = async () => {
      const lote = resto.splice(0, 6);
      if (!lote.length) return;
      await Promise.all(lote.map((i) => cargar(m, i)));
      if (masCercana(pendiente) !== actual) { const p = pendiente; actual = -1; dibujar(p); }
      (window.requestIdleCallback || setTimeout)(tanda);
    };
    tanda();
  }

  addEventListener("resize", () => { ajustarLienzo(); hayGsap && ScrollTrigger.refresh(); });
  iniciarSonido();
  iniciarBump();
  iniciar();
})();
