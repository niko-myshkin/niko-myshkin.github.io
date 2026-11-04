// Screens lie on the inward-facing side of a cylinder. Only the ring rotates.
document.querySelectorAll('[data-screen-gallery]').forEach((root) => {
  const viewport = root.querySelector('.ds-screen-gallery-viewport');
  const track = root.querySelector('.ds-screen-gallery-track');
  const originals = [...track.children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (originals.length < 2) return;

  // Three repeated sets close the circle without a visible seam or extra image downloads.
  for (let set = 1; set < 3; set += 1) originals.forEach((card) => {
    const clone = card.cloneNode(true);
    clone.dataset.galleryClone = '';
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);
  });
  const cards = [...track.children];
  const angle = 360 / cards.length;
  let rotation = 0, radius = 0, push = 0, step = 0, speed = 0, opacityPower = 1;
  let maxBoost = 0, coast = 1, response = 1, boost = 0, targetBoost = 0;
  let hoverSpeed = 1, speedFactor = 1, direction = 1, hovering = false;
  let frame = 0, last = 0, visible = false, drag = null;
  const animated = () => !reduced.matches;
  const number = (style, name) => parseFloat(style.getPropertyValue(name)) || 0;

  const draw = () => {
    if (!animated()) return;
    track.style.transform = `translateZ(${push}px) rotateY(${rotation}deg)`;
    cards.forEach((card, index) => {
      const facing = Math.cos((rotation - index * angle) * Math.PI / 180);
      card.style.opacity = String(Math.pow(Math.max(0, facing), opacityPower));
    });
  };
  const canRun = () => animated() && visible && !document.hidden;
  const updateLoop = () => {
    if (!canRun()) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      boost = targetBoost = 0;
    } else if (!frame) frame = requestAnimationFrame(tick);
  };
  function tick(now) {
    frame = 0;
    if (!canRun()) { last = 0; return; }
    if (last) {
      const delta = Math.min(now - last, 50);
      boost += (targetBoost - boost) * (1 - Math.exp(-delta / response));
      targetBoost *= Math.exp(-delta / coast);
      speedFactor += ((hovering ? hoverSpeed : 1) - speedFactor) * (1 - Math.exp(-delta / response));
      if (!drag) rotation = (rotation + (speed * speedFactor * direction + boost) * delta / 1000) % 360;
    }
    last = now;
    draw();
    updateLoop();
  }

  const layout = () => {
    root.classList.toggle('is-animated', animated());
    if (animated()) viewport.removeAttribute('tabindex');
    else viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', animated() ? 'Atlas app screenshots' : 'Atlas app screenshots. Use the arrow keys to browse.');
    const style = getComputedStyle(root);
    const width = originals[0].offsetWidth;
    step = width + number(style, '--layout-gallery-gap');
    radius = width / 2 / Math.tan(Math.PI / cards.length) * number(style, '--layout-gallery-spread');
    push = Math.min(radius, number(style, '--layout-gallery-perspective') * number(style, '--layout-gallery-camera-push'));
    opacityPower = number(style, '--layout-gallery-opacity-power');
    speed = number(style, '--scroll-gallery-speed');
    hoverSpeed = number(style, '--scroll-gallery-hover-factor');
    maxBoost = number(style, '--scroll-gallery-max-boost');
    coast = number(style, '--duration-gallery-coast');
    response = number(style, '--duration-gallery-response');
    if (animated()) {
      viewport.scrollLeft = 0;
      cards.forEach((card, index) => {
        card.style.transform = `rotateY(${-index * angle}deg) translateZ(${-radius}px) translate(-50%, -50%)`;
      });
      draw();
    } else {
      track.style.removeProperty('transform');
      cards.forEach((card) => {
        card.style.removeProperty('transform');
        card.style.removeProperty('opacity');
      });
    }
    updateLoop();
  };

  // Hover slows autoplay. Dragging steers the ring in either direction, then coasts.
  viewport.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch') hovering = true;
  });
  viewport.addEventListener('pointerleave', () => { hovering = false; });
  viewport.addEventListener('pointerdown', (event) => {
    if (!animated()) return;
    drag = { x: event.clientX, time: event.timeStamp, id: event.pointerId, velocity: 0 };
    boost = targetBoost = 0;
    viewport.setPointerCapture(event.pointerId);
    root.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const elapsed = Math.max(1, event.timeStamp - drag.time);
    // Inward-facing cards travel opposite to ring rotation, so invert pointer travel.
    const degrees = (drag.x - event.clientX) / radius * 180 / Math.PI;
    if (degrees) direction = Math.sign(degrees);
    rotation = (rotation + degrees + 360) % 360;
    drag.velocity = Math.max(-maxBoost, Math.min(maxBoost, degrees * 1000 / elapsed));
    drag.x = event.clientX;
    drag.time = event.timeStamp;
    draw();
  });
  viewport.addEventListener('pointerup', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    boost = targetBoost = event.timeStamp - drag.time < 100 ? drag.velocity : 0;
    drag = null;
    root.classList.remove('is-dragging');
  });
  viewport.addEventListener('pointercancel', () => {
    drag = null;
    root.classList.remove('is-dragging');
  });
  viewport.addEventListener('keydown', (event) => {
    if (animated() || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    viewport.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * step, behavior: 'auto' });
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      updateLoop();
    }).observe(root);
  } else visible = true;
  new ResizeObserver(layout).observe(viewport);
  reduced.addEventListener('change', layout);
  document.addEventListener('visibilitychange', updateLoop);
  layout();
});
