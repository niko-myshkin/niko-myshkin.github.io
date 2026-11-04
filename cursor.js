(() => {
  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cursor = document.createElement("div");
  cursor.className = "site-cursor";
  cursor.setAttribute("aria-hidden", "true");

  const style = document.createElement("style");
  style.textContent = `
    .site-cursor { position: fixed; top: 0; left: 0; z-index: 2147483647; display: none; width: var(--cursor-size, 42px); height: var(--cursor-size, 42px); border: var(--border-width, 1px) solid var(--color-cursor-ink, #fff); border-radius: 50%; box-sizing: border-box; mix-blend-mode: difference; opacity: 0; pointer-events: none; transform: translate3d(var(--site-cursor-x, -100px), var(--site-cursor-y, -100px), 0) translate(-50%, -50%); transition: opacity var(--duration-fast, 160ms) var(--ease-standard, ease); }
    .site-cursor.is-visible { opacity: 1; }
    dialog .site-cursor { mix-blend-mode: normal; }
    @media (hover: hover) and (pointer: fine) {
      .site-cursor { display: block; }
      html.site-cursor-ready, html.site-cursor-ready body, html.site-cursor-ready body * { cursor: none !important; }
    }
    @media (prefers-reduced-motion: reduce) { .site-cursor { transition: none; } }
  `;
  document.head.append(style);
  document.body.append(cursor);

  let x = -100;
  let y = -100;
  let targetX = -100;
  let targetY = -100;

  const syncMode = () => {
    document.documentElement.classList.toggle("site-cursor-ready", precisePointer.matches);
    if (!precisePointer.matches) cursor.classList.remove("is-visible");
  };

  document.addEventListener("pointermove", (event) => {
    if (!precisePointer.matches) return;
    targetX = event.clientX;
    targetY = event.clientY;
    if (!cursor.classList.contains("is-visible")) {
      x = targetX;
      y = targetY;
    }
    cursor.classList.add("is-visible");
  });
  document.documentElement.addEventListener("pointerleave", () => cursor.classList.remove("is-visible"));

  const render = () => {
    const smoothing = reducedMotion.matches ? 1 : 0.42;
    x += (targetX - x) * smoothing;
    y += (targetY - y) * smoothing;
    cursor.style.setProperty("--site-cursor-x", `${x}px`);
    cursor.style.setProperty("--site-cursor-y", `${y}px`);
    requestAnimationFrame(render);
  };

  syncMode();
  precisePointer.addEventListener("change", syncMode);
  requestAnimationFrame(render);
})();
