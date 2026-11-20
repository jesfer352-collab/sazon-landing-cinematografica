/* Sazón: la app en acción (búsqueda → receta → ingredientes) y los ingredientes que caen a la lista.
   Todo depende solo del progreso del scroll, así que funciona igual hacia abajo y hacia arriba. */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const tramo = (p, a, b) => clamp((p - a) / (b - a));
  const suave = (t) => t * t * (3 - 2 * t);
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const INGREDIENTES = [
    { n: "Lomo fino de res", c: "400 g", px: 18.0, lugar: "mercado", img: "carne" },
    { n: "Cebolla roja", c: "2 unid.", px: 2.0, lugar: "mercado", img: "cebolla" },
    { n: "Tomate", c: "3 unid.", px: 2.5, lugar: "mercado", img: "tomate" },
    { n: "Ají amarillo", c: "2 unid.", px: 1.0, lugar: "mercado", img: "aji" },
    { n: "Papa amarilla", c: "1 kg", px: 4.0, lugar: "mercado", img: "papa" },
    { n: "Culantro", c: "1 atado", px: 0.5, lugar: "mercado", img: "culantro" },
    { n: "Ajo", c: "4 dientes", px: 1.0, lugar: "mercado", img: "ajo" },
    { n: "Sillao y vinagre", c: "3 cdas c/u", px: 2.0, lugar: "bodega", img: "sillao" },
    { n: "Arroz", c: "2 tazas", px: 2.0, lugar: "bodega", img: "arroz" },
    { n: "Aceite vegetal", c: "½ taza", px: 1.0, lugar: "bodega", img: "aceite" },
  ];
  const RECETAS = [
    { n: "Lomo Saltado", d: "El clásico salteado de carne, cebolla, tomate y papas fritas, a fuego alto.", m: "⏱ 30 min · 🔥 Fácil · 👥 4", img: "plato_lomo", clave: "lomo saltado" },
    { n: "Ají de Gallina", d: "Pollo deshilachado en una cremosa salsa de ají amarillo, pan y nueces.", m: "⏱ 50 min · 🔥 Media · 👥 4", img: "plato_aji" },
    { n: "Arroz Chaufa", d: "Arroz salteado al wok con huevo, cebolla china y sillao.", m: "⏱ 25 min · 🔥 Fácil · 👥 4", img: "plato_chaufa" },
    { n: "Causa Limeña", d: "Puré de papa amarilla y ají, relleno de pollo, frío y refrescante.", m: "⏱ 45 min · 🔥 Media · 👥 4", img: "plato_causa" },
    { n: "Arroz con Pollo", d: "Arroz verde al culantro con pollo jugoso y salsa criolla.", m: "⏱ 50 min · 🔥 Media · 👥 4", img: "plato_pollo" },
  ];
  const BUSQUEDA = "lomo saltado";
  const imgIng = (k) => `img/ingredientes/${k}.webp`;
  const sol = (v) => v.toFixed(2);

  /* ---------- Construir el DOM ---------- */
  const lista = $("#app-lista");
  lista.innerHTML = RECETAS.map((r, i) => `
    <div class="app-item" data-i="${i}">
      <img src="img/${r.img}.webp" alt="" onerror="this.style.visibility='hidden'">
      <div><b>${r.n}</b><small>${r.d}</small><div class="meta">${r.m}</div></div>
    </div>`).join("");
  const items = [...lista.children];

  $("#receta-ingredientes").innerHTML = INGREDIENTES.map((g, i) => `
    <li data-i="${i}"><img class="ing-foto" src="${imgIng(g.img)}" alt=""><span>${g.n}</span><span class="ing-cant">${g.c}</span></li>`).join("");
  const filasReceta = [...$("#receta-ingredientes").children];

  const filaLista = (g, i) => `
    <li data-i="${i}"><span class="slot"><img src="${imgIng(g.img)}" alt=""></span>
      <span class="nombre">${g.n}<small>${g.c}</small></span><span class="px">S/ ${sol(g.px)}</span></li>`;
  $("#lista-mercado").innerHTML = INGREDIENTES.map((g, i) => g.lugar === "mercado" ? filaLista(g, i) : "").join("");
  $("#lista-bodega").innerHTML = INGREDIENTES.map((g, i) => g.lugar === "bodega" ? filaLista(g, i) : "").join("");
  const filasLista = INGREDIENTES.map((_, i) => $(`#lista-card li[data-i="${i}"]`));
  const total = INGREDIENTES.reduce((s, g) => s + g.px, 0);
  $("#lista-total").textContent = sol(total);
  $(".lista-pie b").textContent = `S/ ${sol(total)}`;

  const mercado = INGREDIENTES.filter((g) => g.lugar === "mercado").map((g) => `• ${g.n} — ${g.c}`).join("\n");
  const bodega = INGREDIENTES.filter((g) => g.lugar === "bodega").map((g) => `• ${g.n} — ${g.c}`).join("\n");
  $("#wsp-burbuja").textContent = `🛒 Lista Sazón · Lomo saltado (4 pers.)\n\n🧺 MERCADO\n${mercado}\n\n🏪 BODEGA\n${bodega}\n\n💰 Total aprox: S/ ${sol(total)}`;

  const volando = $("#volando");
  const fichas = INGREDIENTES.map((g) => {
    const im = new Image();
    im.src = imgIng(g.img);
    im.alt = "";
    volando.appendChild(im);
    return im;
  });

  /* ---------- Escena de la app ---------- */
  const telefono = $("#telefono");
  const busqueda = $("#busqueda");
  const receta = $("#pantalla-receta");
  const recetaScroll = $("#receta-scroll");
  const toque = $("#toque");
  const pasos = [...document.querySelectorAll(".paso")];
  const pasosCaja = $(".app-pasos");
  let pasoActual = -1;

  function escenaApp(p) {
    // 0 - 0.12: el teléfono llega desde "pantalla completa" (enlaza con el final del video)
    const entrada = suave(tramo(p, 0, 0.12));
    const escalaInicial = Math.max(innerWidth / telefono.offsetWidth, innerHeight / telefono.offsetHeight) * 1.05;
    // centro del teléfono sin transformar (offsetLeft/Top no cambian con transform)
    const cx = telefono.offsetLeft + telefono.offsetWidth / 2, cy = telefono.offsetTop + telefono.offsetHeight / 2;
    const dx = (innerWidth / 2 - cx) * (1 - entrada), dy = (innerHeight / 2 - cy) * (1 - entrada);
    telefono.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${(escalaInicial + (1 - escalaInicial) * entrada).toFixed(4)})`;
    pasosCaja.style.opacity = entrada.toFixed(3);

    // 0.12 - 0.32: se escribe "lomo saltado" y la lista se filtra
    const letras = Math.round(tramo(p, 0.12, 0.3) * BUSQUEDA.length);
    const texto = BUSQUEDA.slice(0, letras);
    if (busqueda.textContent !== texto) busqueda.textContent = texto;
    items.forEach((el, i) => {
      const r = RECETAS[i];
      const coincide = !texto || r.n.toLowerCase().startsWith(texto) || (texto.length < 2 && r.n.toLowerCase().includes(texto));
      el.classList.toggle("oculto", !coincide);
    });

    // 0.32 - 0.4: toque en la tarjeta del lomo
    const tToque = tramo(p, 0.32, 0.4);
    items[0].classList.toggle("elegido", p > 0.33);
    const rT = items[0].getBoundingClientRect(), rP = telefono.querySelector(".telefono-pantalla").getBoundingClientRect();
    const k = telefono.offsetWidth ? rP.width / telefono.querySelector(".telefono-pantalla").offsetWidth : 1;
    toque.style.left = `${(rT.left - rP.left + rT.width * 0.45) / k}px`;
    toque.style.top = `${(rT.top - rP.top + rT.height / 2) / k}px`;
    toque.style.opacity = tToque > 0 && tToque < 1 ? (1 - tToque).toFixed(2) : 0;
    toque.style.transform = `translate(-50%, -50%) scale(${(0.4 + tToque * 1.4).toFixed(2)})`;

    // 0.38 - 0.46: se abre la receta
    const abrir = suave(tramo(p, 0.38, 0.46));
    receta.style.transform = `translateX(${((1 - abrir) * 100).toFixed(2)}%)`;

    // 0.48 - 0.56: baja hasta los ingredientes
    const bajar = suave(tramo(p, 0.48, 0.56));
    const destino = Math.max(0, $("#receta-ingredientes").offsetTop - $(".receta-h").offsetHeight * 3.2);
    recetaScroll.style.transform = `translateY(${(-destino * bajar).toFixed(1)}px)`;

    // 0.56 - 0.94: se leen los ingredientes uno por uno
    const leidos = tramo(p, 0.56, 0.94) * INGREDIENTES.length;
    filasReceta.forEach((li, i) => {
      li.classList.toggle("leido", leidos >= i + 1);
      li.classList.toggle("leyendo", leidos > i && leidos < i + 1);
    });

    // textos laterales
    const paso = p < 0.36 ? 0 : p < 0.55 ? 1 : 2;
    if (paso !== pasoActual) {
      pasoActual = paso;
      pasos.forEach((el, i) => el.classList.toggle("activo", i === paso));
    }
  }

  /* ---------- Sonido de caída (solo si el visitante activó el sonido) ---------- */
  const botonSonido = $("#sonido");
  const sonidoActivo = () => botonSonido && !botonSonido.hidden && botonSonido.getAttribute("aria-pressed") === "true";
  let plops = null, plopN = 0;
  const cargarPlops = () => { plops = plops || Array.from({ length: 4 }, () => { const a = new Audio("audio/caida.mp3"); a.preload = "auto"; a.volume = 0.5; return a; }); };
  if (botonSonido) botonSonido.addEventListener("click", cargarPlops); // se carga solo cuando activan el sonido
  const plop = () => {
    if (!sonidoActivo()) return;
    cargarPlops();
    const a = plops[plopN++ % plops.length];
    try { a.currentTime = 0; a.playbackRate = 0.9 + Math.random() * 0.25; a.play().catch(() => {}); } catch (e) {}
  };
  const yaLleno = INGREDIENTES.map(() => false);

  /* ---------- Los ingredientes caen a la lista ---------- */
  const lanzar = 0.055; // separación entre un ingrediente y el siguiente
  function caida(p) {
    const n = INGREDIENTES.length;
    const dur = 1 - lanzar * (n - 1);
    INGREDIENTES.forEach((_, i) => {
      const t = clamp((p - i * lanzar) / dur);
      const ficha = fichas[i], origen = filasReceta[i].querySelector(".ing-foto"), fila = filasLista[i];
      const slot = fila.querySelector(".slot");
      const enFoto = t <= 0, llego = t >= 1;
      origen.style.visibility = enFoto ? "visible" : "hidden";
      fila.classList.toggle("lleno", llego);
      if (llego && !yaLleno[i]) plop();
      yaLleno[i] = llego;
      if (enFoto || llego) { ficha.style.opacity = 0; return; }
      const a = origen.getBoundingClientRect(), b = slot.getBoundingClientRect();
      const tx = suave(t), ty = t * t; // x suave, y como gravedad
      const size = a.width + (b.width - a.width) * suave(t);
      const arco = innerWidth > 860 ? -70 : (i % 2 ? 30 : -30); // en escritorio siempre hacia dentro
      const x = a.left + (b.left - a.left) * tx + Math.sin(Math.PI * t) * arco;
      const y = a.top + (b.top - a.top) * ty - Math.sin(Math.PI * t) * 40;
      ficha.style.width = ficha.style.height = `${size}px`;
      ficha.style.opacity = 1;
      ficha.style.transform = `translate(${x}px, ${y}px) rotate(${(t * 360 * (i % 2 ? 1 : -1)).toFixed(1)}deg)`;
    });
    $("#wsp").classList.toggle("visible", p >= 1);
  }

  /* ---------- Scroll ---------- */
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    escenaApp(0.99); caida(1);
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  const estado = { p: 0 };
  ScrollTrigger.create({
    trigger: "#app", start: "top top", end: "bottom bottom",
    onUpdate: (st) => gsap.to(estado, { p: st.progress, duration: reducido ? 0 : 0.35, ease: "power2.out", overwrite: true, onUpdate: () => escenaApp(estado.p) }),
  });
  escenaApp(0);

  // Final de la escena de cine: fundido a oscuro para pasar al teléfono "real"
  const fundido = $("#cine-fundido");
  ScrollTrigger.create({
    trigger: "#cine", start: "top top", end: "bottom bottom",
    onUpdate: (st) => { fundido.style.opacity = suave(tramo(st.progress, 0.76, 0.98)).toFixed(3); },
  });

  if (reducido) {
    caida(1);
  } else {
    ScrollTrigger.create({
      trigger: "#lista-card", start: "top bottom", end: () => (document.querySelector("#lista-card").offsetHeight < innerHeight * 0.95 ? "bottom 97%" : "center 55%"),
      onUpdate: (st) => caida(st.progress),
      onLeave: () => caida(1), onLeaveBack: () => caida(0),
    });
    caida(0);
  }

  // CTA flotante en móvil: aparece pasada la escena de cine y se esconde en la sección de precio
  const cta = $("#cta-flotante");
  ScrollTrigger.create({ trigger: "#lista", start: "bottom bottom", endTrigger: "#precio", end: "top bottom",
    onToggle: (st) => cta.classList.toggle("visible", st.isActive) });

  addEventListener("resize", () => { escenaApp(estado.p); });

  // Botón de sonido compacto (en celular) cuando ya pasó la película
  const cineSec = $("#cine");
  if (botonSonido && cineSec) {
    const compactar = () => botonSonido.classList.toggle("compacto", cineSec.getBoundingClientRect().bottom < innerHeight * 0.5);
    addEventListener("scroll", compactar, { passive: true });
    compactar();
  }
})();
