document.querySelectorAll('.profile-footer-link[aria-disabled="true"]').forEach((link) => {
  link.addEventListener("click", (event) => event.preventDefault());
});

const contactDialog = document.querySelector("[data-contact-dialog]");
if (contactDialog) {
  const emailButton = contactDialog.querySelector("[data-copy-email]");
  const copyStatus = contactDialog.querySelector("[data-copy-status]");
  let copyResetTimer;
  if (emailButton) {
    const originalLabel = emailButton.getAttribute("aria-label");
    const resetCopyState = () => {
      emailButton.classList.remove("is-copied");
      emailButton.setAttribute("aria-label", originalLabel);
      copyStatus.textContent = "";
    };
    emailButton.addEventListener("click", async () => {
      const email = emailButton.querySelector(".ds-contact-value").textContent.trim();
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(email);
        } else {
          const input = document.createElement("textarea");
          input.value = email;
          input.style.position = "fixed";
          input.style.opacity = "0";
          contactDialog.append(input);
          input.select();
          const copied = document.execCommand("copy");
          input.remove();
          emailButton.focus();
          if (!copied) throw new Error("Clipboard unavailable");
        }
        clearTimeout(copyResetTimer);
        emailButton.classList.add("is-copied");
        emailButton.setAttribute("aria-label", `Copied ${email}`);
        copyStatus.textContent = "Email copied to clipboard";
        const duration = parseFloat(getComputedStyle(contactDialog).getPropertyValue("--contact-copy-confirm-duration"));
        copyResetTimer = setTimeout(resetCopyState, duration);
      } catch {
        copyStatus.textContent = "Could not copy email address";
      }
    });
    contactDialog.addEventListener("close", () => {
      clearTimeout(copyResetTimer);
      resetCopyState();
    });
  }
  document.querySelectorAll("[data-contact-open]").forEach((button) => {
    button.addEventListener("click", () => {
      contactDialog.showModal();
      contactDialog.focus({ preventScroll: true });
    });
  });
  contactDialog.querySelector("[data-contact-close]").addEventListener("click", () => contactDialog.close());
  contactDialog.addEventListener("click", (event) => {
    const box = contactDialog.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (event.target === contactDialog && outside) contactDialog.close();
  });
}

const rootStyles = getComputedStyle(document.documentElement);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");const desktopProjects = window.matchMedia("(min-width: 781px)");
const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

const projects = [...document.querySelectorAll(".project")];

/* Entrance animations play once: mark finished ones so a focus change can't replay them (see styles.css). */
document.addEventListener("animationend", (event) => {
  if (event.animationName !== "case-enter" && event.animationName !== "feed-enter") return;
  if (event.target.closest(".case-pitch-gestures")) return; // those steps replay on purpose
  event.target.classList.add("is-entered");
});

const profileIdentity = document.querySelector(".profile-identity");
const profileName = profileIdentity?.querySelector(".profile-name");
if (profileIdentity && profileName) {
  const syncProfileLockup = () => {
    const width = Math.ceil(profileName.getBoundingClientRect().width);
    profileIdentity.style.setProperty("--avatar-width", `${width}px`);
    profileIdentity.style.setProperty("--avatar-height", `${width}px`);
  };
  syncProfileLockup();
  if ("ResizeObserver" in window) new ResizeObserver(syncProfileLockup).observe(profileName);
}

/* Smooth scroll.
   The page keeps its real scroll position — we only decide how fast it gets there,
   so position: sticky, the scrollbar and anchors all keep working.
   Desktop wheel only: touch already has good native momentum. */
const smoothLerp = parseFloat(rootStyles.getPropertyValue("--scroll-lerp")) || 0.085;
const smoothWheelSpeed = parseFloat(rootStyles.getPropertyValue("--scroll-wheel-speed")) || 1;

let smoothActive = false;
let smoothTarget = window.scrollY;
let smoothCurrent = window.scrollY;
let smoothWritten = -1;
let smoothLastTime = 0;

const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
const clampScroll = (value) => Math.min(maxScrollY(), Math.max(0, value));
const syncSmoothScroll = () => {
  smoothTarget = smoothCurrent = window.scrollY;
};

/* Without smooth scroll the projects block installs its own tween here. */
let scrollFallback = (value) => window.scrollTo(0, value);
const setScrollFallback = (fn) => { scrollFallback = fn; };

const scrollToPosition = (value) => {
  if (!smoothActive) {
    scrollFallback(value);
    return;
  }
  smoothTarget = clampScroll(value);
};

const onSmoothWheel = (event) => {
  if (!smoothActive || event.ctrlKey) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  smoothTarget = clampScroll(smoothTarget + event.deltaY * unit * smoothWheelSpeed);
};

const renderSmoothScroll = (now) => {
  if (!smoothActive) return;
  const delta = smoothLastTime ? Math.min(0.1, (now - smoothLastTime) / 1000) : 0.016;
  smoothLastTime = now;

  // Anything that moved the page without us — scrollbar, keyboard, find-in-page — wins.
  if (Math.abs(window.scrollY - smoothWritten) > 2) syncSmoothScroll();

  smoothTarget = clampScroll(smoothTarget);
  const step = 1 - Math.pow(1 - smoothLerp, delta * 60);
  smoothCurrent += (smoothTarget - smoothCurrent) * step;
  if (Math.abs(smoothTarget - smoothCurrent) < 0.15) smoothCurrent = smoothTarget;
  if (Math.round(smoothCurrent) === Math.round(smoothWritten)) return;

  smoothWritten = smoothCurrent;
  window.scrollTo(0, smoothCurrent);
};

const syncSmoothMode = () => {
  const enabled = desktopProjects.matches && precisePointer.matches && !reducedMotion.matches;
  if (enabled === smoothActive) return;
  smoothActive = enabled;
  document.documentElement.classList.toggle("smooth-scroll-ready", enabled);
  syncSmoothScroll();
  smoothWritten = window.scrollY;
  smoothLastTime = 0;
};

syncSmoothMode();
desktopProjects.addEventListener("change", syncSmoothMode);
precisePointer.addEventListener("change", syncSmoothMode);
reducedMotion.addEventListener("change", syncSmoothMode);
window.addEventListener("wheel", onSmoothWheel, { passive: false });
window.addEventListener("resize", () => { smoothTarget = clampScroll(smoothTarget); }, { passive: true });

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const id = anchor.getAttribute("href").slice(1);
    // "#top" is the page top (the HTML spec meaning), not an element further down.
    const destination = id && id !== "top" ? document.getElementById(id) : null;
    if (!smoothActive || (!destination && id !== "top")) return;
    event.preventDefault();
    scrollToPosition(destination ? destination.getBoundingClientRect().top + window.scrollY : 0);
  });
});

const smoothLoop = (now) => {
  renderSmoothScroll(now);
  requestAnimationFrame(smoothLoop);
};

if (!projects.length) requestAnimationFrame(smoothLoop);

if (projects.length) {
  const scrollSettleDelay = parseFloat(rootStyles.getPropertyValue("--scroll-settle-delay")) || 180;
  const scrollSnapDuration = parseFloat(rootStyles.getPropertyValue("--duration-scroll-snap")) || 900;
  const scrollSnapAttraction = parseFloat(rootStyles.getPropertyValue("--scroll-snap-attraction")) || 0.26;
  const projectTiltMaxAngle = parseFloat(rootStyles.getPropertyValue("--project-tilt-max-angle")) || 4;
  const openProject = (project) => {
    const caseUrl = project.dataset.caseUrl;
    if (!caseUrl) return;
    const destination = new URL(caseUrl, window.location.href);
    // Separate products (Refkit lives on this same domain) open in a new tab, like other external links.
    if (project.dataset.caseTarget === "_blank" || destination.origin !== window.location.origin) {
      window.open(destination.href, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(destination.href);
  };

  projects.forEach((project) => {
    const art = project.querySelector(".project-art");
    const hasCase = Boolean(project.dataset.caseUrl);
    if (hasCase) {
      art.removeAttribute("aria-hidden");
      art.tabIndex = 0;
      art.setAttribute("role", "link");
      art.setAttribute("aria-label", `Open ${project.querySelector("h2")?.textContent || "case study"}`);
      art.addEventListener("click", () => openProject(project));
      art.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject(project);
        }
      });
    }
    if (art?.classList.contains("project-art--image")) {
      art.addEventListener("pointermove", (event) => {
        if (!precisePointer.matches || reducedMotion.matches || event.pointerType === "touch") return;
        const rect = art.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        art.style.setProperty("--project-tilt-x", `${(-y * 2 * projectTiltMaxAngle).toFixed(2)}deg`);
        art.style.setProperty("--project-tilt-y", `${(x * 2 * projectTiltMaxAngle).toFixed(2)}deg`);
      });
      art.addEventListener("pointerleave", () => {
        art.style.removeProperty("--project-tilt-x");
        art.style.removeProperty("--project-tilt-y");
      });
    }
  });

  const supportsReveal = "IntersectionObserver" in window;

  if (supportsReveal && !reducedMotion.matches) {
    document.documentElement.classList.add("reveal-ready");

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: "0px", threshold: 0 }); // reveal as soon as any part is on screen: the second card peeks in on load

    projects.forEach((project) => revealObserver.observe(project));
  }

  const covers = [...document.querySelectorAll(".project-art--image .project-cover")];
  const parallaxRange = parseFloat(rootStyles.getPropertyValue("--parallax-cover-range")) || 12;

  const renderCoverParallax = () => {
    if (!covers.length || reducedMotion.matches) return;
    const viewportCenter = window.innerHeight / 2;

    covers.forEach((cover) => {
      const frame = cover.parentElement;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const distance = (rect.top + rect.height / 2 - viewportCenter) / viewportCenter;
      const clamped = Math.max(-1, Math.min(1, distance));
      cover.style.setProperty("--cover-shift", `${(clamped * parallaxRange).toFixed(2)}px`);
    });
  };

  let settleTimer;
  let snapFrame;
  let isSnapping = false;

  const stopProjectSnap = () => {
    clearTimeout(settleTimer);
    cancelAnimationFrame(snapFrame);
    isSnapping = false;
  };

  const animateProjectSnap = (target) => {
    const start = window.scrollY;
    const distance = target - start;
    const startTime = performance.now();
    isSnapping = true;

    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / scrollSnapDuration);
      const eased = progress ** 3 * (progress * (progress * 6 - 15) + 10);
      window.scrollTo(0, start + distance * eased);

      if (progress < 1) {
        snapFrame = requestAnimationFrame(step);
      } else {
        isSnapping = false;
      }
    };

    snapFrame = requestAnimationFrame(step);
  };

  setScrollFallback(animateProjectSnap);

  const settleNearestProject = () => {
    if (!desktopProjects.matches || reducedMotion.matches) return;

    const topOffset = parseFloat(rootStyles.getPropertyValue("--space-8")) || 32;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const targets = projects.map((project) => {
      const projectTop = project.getBoundingClientRect().top + window.scrollY;
      return Math.min(maxScroll, Math.max(0, projectTop - topOffset));
    });
    const nearestTarget = targets.reduce((nearest, target) => (
      Math.abs(target - window.scrollY) < Math.abs(nearest - window.scrollY) ? target : nearest
    ), targets[0]);
    const distance = Math.abs(nearestTarget - window.scrollY);

    if (distance < 2 || distance > window.innerHeight * scrollSnapAttraction) return;

    scrollToPosition(nearestTarget);
  };

  const scheduleProjectSnap = () => {
    if (isSnapping || !desktopProjects.matches) return;
    clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settleNearestProject, scrollSettleDelay);
  };

  window.addEventListener("scroll", scheduleProjectSnap, { passive: true });
  window.addEventListener("wheel", stopProjectSnap, { passive: true });
  window.addEventListener("touchstart", stopProjectSnap, { passive: true });
  window.addEventListener("pointerdown", stopProjectSnap, { passive: true });
  desktopProjects.addEventListener("change", stopProjectSnap);

  const animate = (now) => {
    renderSmoothScroll(now);
    renderCoverParallax();
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}


/* Live product embed.
   The prototype inside has its own minimum type and touch sizes, so it cannot be
   squeezed by CSS — it is rendered at its real 375px width and the whole frame is
   scaled instead. Same fix as the landing page that embeds it. */
(function () {
  const frames = document.querySelectorAll('[data-embed]');
  if (!frames.length) return;
  const fit = () => {
    frames.forEach((box) => {
      const frame = box.querySelector('iframe');
      if (!frame) return;
      const scale = box.clientWidth / 375;
      frame.style.transform = 'scale(' + scale + ')';
      box.style.height = 812 * scale + 'px';
      // Корпус вокруг экрана считает по нему же свои рамку, радиус и островок.
      const device = box.closest('.ds-device');
      if (device) device.style.setProperty('--k', scale);
    });
  };
  fit();
  window.addEventListener('resize', fit);
})();


/* Device status bar clock. Real time, not a mocked 9:41 — the frame around it is
   a drawing, but nothing in it should state something untrue. */
(function () {
  const clocks = document.querySelectorAll('[data-device-clock]');
  if (!clocks.length) return;
  const tick = () => {
    const now = new Date();
    const text = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    clocks.forEach((node) => { node.textContent = text; });
  };
  tick();
  setInterval(tick, 20000);
})();


/* Statement: the line lights up word by word as it scrolls through the viewport.
   Progress is measured the way the reference does it — the block is lit from the
   moment its top passes 72% of the viewport until it has travelled its own height
   plus a sixth of the screen. Words are wrapped here, not in the markup, so the
   copy stays readable and translatable in the HTML. */
(function () {
  const blocks = document.querySelectorAll('[data-statement]');
  if (!blocks.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = [];
  blocks.forEach((block) => {
    const words = [];
    // Keep line and accent spans while animating all their text nodes.
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((chunk) => {
        if (!chunk) return;
        if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(' ')); return; }
        const span = document.createElement('span');
        span.className = 'ds-statement-word';
        span.textContent = chunk;
        frag.appendChild(span);
        words.push(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
    items.push({ block, words });
  });

  if (reduced) {
    items.forEach(({ words }) => words.forEach((w) => w.classList.add('is-lit')));
    return;
  }

  const paint = () => {
    items.forEach(({ block, words }) => {
      const rect = block.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const t = Math.min(1, Math.max(0, (vh * 0.72 - rect.top) / (rect.height + vh * 0.16)));
      const lit = Math.ceil(t * words.length);
      words.forEach((w, i) => w.classList.toggle('is-lit', i < lit));
    });
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; paint(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', paint, { passive: true });
  paint();
})();


/* Case entrance: reveal each block once; the statement keeps its own motion. */
(() => {
  if (!document.querySelector('[data-case-reveal]') ||
      !('IntersectionObserver' in window) || reducedMotion.matches) return;

  const targets = [...document.querySelectorAll(
    '.case-detail-topbar, .case-hero-copy > *, .case-hero-media, ' +
    '.case-detail > .case-detail-copy > :not([data-statement]):not(.case-faq), ' +
    '.case-detail > .case-detail-media:not(.ds-media-grid), ' +
    '.case-detail > .ds-media-grid > *'
  )].filter(node => !node.closest('[data-statement]'));

  const reveal = node => {
    node.classList.add('is-revealed');
    observer.unobserve(node);
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) reveal(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

  targets.forEach(node => {
    const siblings = [...node.parentElement.children];
    const order = node.matches('.case-hero-media') ? 2 : Math.min(siblings.indexOf(node), 2);
    node.style.setProperty('--case-reveal-delay', `calc(var(--reveal-stagger) * ${order})`);
    node.classList.add('case-reveal');
    observer.observe(node);
  });

  // Keyboard navigation must never land on an invisible control.
  document.addEventListener('focusin', event => {
    const target = event.target.closest('.case-reveal');
    if (target) reveal(target);
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) targets.forEach(reveal);
  });
})();


/* The right screen column catches up with the left by the time their bottom
   edges enter the viewport. Relative positioning preserves document height. */
(() => {
  const gallery = document.querySelector('.case-screen-gallery');
  if (!gallery) return;
  let pending = false;
  const paint = () => {
    pending = false;
    const rect = gallery.getBoundingClientRect();
    const offset = parseFloat(getComputedStyle(gallery).getPropertyValue('--case-screen-offset')) || 0;
    const distance = Math.max(1, rect.height - offset + innerHeight * .15);
    const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / distance));
    gallery.style.setProperty('--screen-scroll-offset',
      (reducedMotion.matches ? 0 : offset * (1 - progress)) + 'px');
  };
  const schedule = () => {
    if (!pending) { pending = true; requestAnimationFrame(paint); }
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  reducedMotion.addEventListener('change', schedule);
  paint();
})();

/* Accordion: one item open at a time, media follows it.
   The open item stays open when clicked again — a list where every row can be
   shut leaves the media pane showing something nothing points at.
   data-accordion-empty lifts that: the list starts with nothing open, and a click
   on the open card folds it back. The media pane then shows the clip marked
   data-accordion-media="" — the resting picture nothing points at on purpose.
   data-accordion-multi (the FAQ list) has no media pane: every row toggles on its
   own and the list starts closed. */
(function () {
  document.querySelectorAll('[data-accordion]').forEach((root) => {
    const heads = [...root.querySelectorAll('[data-accordion-head]')];
    const clips = [...root.querySelectorAll('[data-accordion-media]')];
    if (!heads.length) return;

    if (root.hasAttribute('data-accordion-multi')) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)');
      heads.forEach((head) => {
        const panel = document.getElementById(head.getAttribute('aria-controls'));
        if (panel) panel.inert = head.getAttribute('aria-expanded') !== 'true';
        head.addEventListener('click', () => {
          const open = head.getAttribute('aria-expanded') !== 'true';
          head.setAttribute('aria-expanded', String(open));
          if (panel) panel.inert = !open;
          // Ролик в ответе крутится, только пока ответ открыт: свёрнутый список не греет машину.
          // При reduced motion сам не стартует — вместо этого человеку дают контролы.
          panel?.querySelectorAll('video').forEach((video) => {
            if (still.matches) video.controls = true;
            if (open && !still.matches) video.play?.()?.catch?.(() => {});
            else video.pause?.();
          });
        });
      });
      return;
    }

    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const explorer = root.hasAttribute('data-accordion-explorer');
    const cameraMs = () => (still.matches ? 0 : parseFloat(getComputedStyle(root).getPropertyValue('--duration-camera')) || 0);
    const ids = heads.map((head) => head.dataset.accordionHead);
    const steps = [...root.querySelectorAll('[data-accordion-step]')];
    const open = (id) => {
      clearTimeout(root._playTimer);
      // Explorer: the phone camera reads the open item from here (styles pick the shot).
      root.dataset.current = id;
      const at = ids.indexOf(id);
      // Mobile carousel slides to this card (design-system.css, .is-touring).
      root.style.setProperty('--explorer-index', at);
      steps.forEach((step) => {
        step.disabled = !ids[at + Number(step.dataset.accordionStep)];
      });
      heads.forEach((head) => {
        const selected = head.dataset.accordionHead === id;
        head.setAttribute('aria-expanded', String(selected));
        if (explorer) {
          const panel = document.getElementById(head.getAttribute('aria-controls'));
          if (panel) {
            panel.inert = !selected;
            panel.setAttribute('aria-hidden', String(!selected));
          }
        }
      });
      clips.forEach((clip) => {
        const current = clip.dataset.accordionMedia === id;
        clip.classList.toggle('is-current', current);
        clip.inert = !current;
        clip.setAttribute('aria-hidden', String(!current));
        if (clip.tagName === 'VIDEO') {
          clip.controls = current && still.matches;
        }
        // Скрытый ролик не крутим: три видео разом греют машину без причины.
        // Витрина показывает картинки, у них play/pause нет — отсюда опциональный вызов.
        // При reduced motion ролик сам не стартует — вместо этого человеку дают контролы.
        if (current && still.matches && clip.tagName === 'VIDEO') clip.pause();
        else if (current && explorer && clip.tagName === 'VIDEO') {
          // В explorer жест стартует с начала, когда камера доехала: движение внутри экрана
          // во время проезда камеры читается как тряска.
          clip.pause(); clip.currentTime = 0;
          root._playTimer = setTimeout(() => {
            const box = root.getBoundingClientRect();
            if (box.bottom > 0 && box.top < window.innerHeight) clip.play().catch(() => {});
          }, cameraMs());
        }
        else if (current) clip.play?.()?.catch?.(() => {});
        else clip.pause?.();
      });
    };

    const empty = root.hasAttribute('data-accordion-empty');
    const collapse = (head) => {
      open('');
      head.focus();
    };

    // Mobile explorer: a row of pills at rest; a tap turns it into a carousel of cards
    // (.is-touring) that the arrows, a swipe and the close button drive. Desktop never tours.
    const narrow = window.matchMedia('(max-width: 780px)');
    const nav = root.querySelector('.ds-explorer-nav');
    const list = root.querySelector('.ds-explorer-list');
    const closeButton = root.querySelector('[data-explorer-close]');
    const tour = (on) => {
      if (!explorer || !list || on === root.classList.contains('is-touring')) return;
      // The pill row may be scrolled; the carousel counts from its left edge. Start the
      // slide from where the row was, so entering doesn't jump by the scrolled distance.
      if (on && nav.scrollLeft) {
        list.style.transition = 'none';
        list.style.transform = `translateX(calc(var(--layout-mobile-gutter) - ${nav.scrollLeft}px))`;
        nav.scrollLeft = 0;
        void list.offsetWidth;
        list.style.transition = '';
        list.style.transform = '';
      }
      root.classList.toggle('is-touring', on);
    };
    closeButton?.addEventListener('click', () => {
      tour(false);
      heads.find((head) => head.dataset.accordionHead === root.dataset.current)?.focus();
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && root.classList.contains('is-touring')) closeButton?.click();
    });
    narrow.addEventListener('change', () => { if (!narrow.matches) tour(false); });

    // Swipe: the list follows the finger, and a flick past the threshold steps one card.
    // A drag that moved is not a tap — its click is swallowed so it doesn't open a card.
    if (explorer && list) {
      let startX = null, dx = 0, moved = false;
      const settle = () => {
        list.classList.remove('is-dragging');
        root.style.setProperty('--explorer-drag', '0px');
      };
      list.addEventListener('pointerdown', (event) => {
        if (!root.classList.contains('is-touring')) return;
        startX = event.clientX; dx = 0; moved = false;
      });
      list.addEventListener('pointermove', (event) => {
        if (startX === null) return;
        dx = event.clientX - startX;
        if (!moved && Math.abs(dx) < 8) return;
        if (!moved) { moved = true; list.classList.add('is-dragging'); list.setPointerCapture(event.pointerId); }
        // Past the first or last card the list only gives a little, like a rubber band.
        const at = ids.indexOf(root.dataset.current);
        const edge = (dx > 0 && at === 0) || (dx < 0 && at === ids.length - 1);
        root.style.setProperty('--explorer-drag', `${edge ? dx / 3 : dx}px`);
      });
      const release = () => {
        if (startX === null) return;
        startX = null;
        settle();
        if (!moved) return;
        const at = ids.indexOf(root.dataset.current);
        const next = ids[at + (dx < -40 ? 1 : dx > 40 ? -1 : 0)];
        if (next) open(next);
      };
      list.addEventListener('pointerup', release);
      list.addEventListener('pointercancel', release);
      list.addEventListener('click', (event) => {
        if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
      }, true);
    }

    heads.forEach((head) => {
      head.addEventListener('click', () => {
        if (empty && head.getAttribute('aria-expanded') === 'true') { collapse(head); return; }
        if (narrow.matches) tour(true);
        open(head.dataset.accordionHead);
        // In the explorer the head folds away once open — hand focus to the card.
        if (root.hasAttribute('data-accordion-explorer')) document.getElementById(head.getAttribute('aria-controls'))?.focus();
      });
      // The open head is see-through to the pointer, so the click lands on its card.
      const panel = document.getElementById(head.getAttribute('aria-controls'));
      if (!empty || !panel) return;
      panel.addEventListener('click', () => collapse(head));
      panel.addEventListener('keydown', (event) => {
        if (event.target !== panel || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        collapse(head);
      });
    });
    // Ролик открытого пункта играет, только пока блок на экране: так он не греет машину
    // за кадром, а первый запуск не зависит от того, успел ли ролик загрузиться к инициализации.
    const videos = clips.filter((clip) => clip.tagName === 'VIDEO');
    if (videos.length && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        const current = videos.find((clip) => clip.classList.contains('is-current'));
        if (!current || still.matches) return;
        if (entry.isIntersecting) current.play()?.catch?.(() => {});
        else current.pause();
      }, { threshold: 0.25 }).observe(root);
    }

    steps.forEach((step) => {
      step.addEventListener('click', () => {
        const next = ids[ids.indexOf(root.dataset.current) + Number(step.dataset.accordionStep)];
        if (next) open(next);
      });
    });
    still.addEventListener('change', () => open(root.dataset.current));
    open(empty ? '' : heads[0].dataset.accordionHead);
  });
})();

/* The embedded ATLAS composition reports its content height after each responsive
   layout. CSS reserves the exact desktop/mobile fallback first, so loading it does
   not move the following section. */
(() => {
  const frame = document.querySelector('.case-mechanics iframe');
  if (!frame) return;

  // Отступ до карточек внутри iframe меняется по ширине самого iframe (его брейкпоинт 700),
  // а не по брейкпоинту страницы, — поэтому меряем его здесь. От него зависит зазор
  // «утверждение → механики» (styles.css), токен --case-mechanics-inset — только запасной.
  const syncInset = () => {
    const card = frame.contentDocument?.querySelector('.mechanics-card');
    if (card) frame.parentElement.style.setProperty('--case-mechanics-inset', `${Math.round(card.getBoundingClientRect().top)}px`);
  };
  frame.addEventListener('load', syncInset);

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow ||
        event.data?.type !== 'atlas-mechanics-resize') return;
    const height = Number(event.data.height);
    if (Number.isFinite(height) && height >= 600 && height <= 1800) {
      frame.style.height = `${Math.ceil(height)}px`;
    }
    syncInset();
  });
})();

/* Scrolly: the scroll drives the story. Progress through the section is split into
   shelves (one per step) and short moves between them. On a shelf the step's gesture is
   scrubbed by the scroll — its frames from the master take; on a move the camera and text
   change while the picture holds on the seam (segments are back to back, so no cut).
   The master is an image sequence drawn on a canvas, the way apple.com scrubs its phones:
   seeking a <video> on every wheel tick made Chrome stutter (2026-09-22). Progress itself
   is eased toward the scroll position, so wheel steps turn into one continuous motion.
   Without a master (per-step clips) the shelf is the first and last 30% of each move. */
(function () {
  document.querySelectorAll('[data-scrolly]').forEach((root) => {
    const pin = root.querySelector('.ds-scrolly-pin');
    const surface = root.querySelector('[data-scrolly-surface]');
    const section = root.closest('.case-pitch-gestures');
    const stage = root.querySelector('.ds-phone-stage');
    const steps = [...root.querySelectorAll('[data-scrolly-step]')];
    const media = [...root.querySelectorAll('[data-scrolly-media]')];
    const master = root.querySelector('[data-scrolly-master]');
    if (!pin || !steps.length) return;
    root.style.setProperty('--scrolly-steps', steps.length);

    const still = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 780px)');
    const KEYS = ['--s', '--fx', '--fy', '--cx', '--cy'];
    const shots = steps.map((step) => {
      const css = getComputedStyle(step);
      return KEYS.map((key) => parseFloat(css.getPropertyValue(key)));
    });
    const clamp = (v) => Math.min(1, Math.max(0, v));
    const smooth = (v) => v * v * (3 - 2 * v);

    // ---- master: image sequence on a canvas ----
    // Отрезки шагов: data-scrolly-frame-segments — сразу в номерах кадров секвенции
    // (секвенция выровнена по движению, tools/equalize-seq.py в ATLAS, время там уже
    // неравномерно); data-scrolly-segments — в секундах, кадр = секунда × fps.
    const parse = (value) => (value || '').split(',').filter(Boolean).map((pair) => pair.split('-').map(Number));
    const frameSegments = parse(master?.dataset.scrollyFrameSegments);
    const segments = frameSegments.length ? frameSegments : parse(master?.dataset.scrollySegments);
    // Полка шага и переезд между шагами в долях прокрутки. Полка может быть длиннее
    // у шага, где движения больше: --shelf на самом шаге (иначе жест «пролетает»).
    const MOVE = 0.45;
    const shelves = steps.map((step) => parseFloat(getComputedStyle(step).getPropertyValue('--shelf')) || 1);
    // Кадр покоя для хвоста: телефон целиком, по центру. Значения — в CSS рядом с кадрами шагов.
    const restCss = getComputedStyle(root);
    const rest = KEYS.map((key, k) => {
      const value = parseFloat(restCss.getPropertyValue('--rest-' + key.slice(2)));
      return Number.isFinite(value) ? value : [1.33, .5, .5, 50, 50][k];
    });
    // Хвост: последние TAIL единиц прокрутки ничего не листают — на них плашка тем же
    // движением уезжает обратно в свой контейнер (правка Николая 2026-09-23).
    const TAIL = 0.5;
    const runUnits = shelves.reduce((a, b) => a + b, 0) + (steps.length - 1) * MOVE + TAIL;
    const fps = frameSegments.length ? 1 : Number(master?.dataset.scrollyFps) || 30;
    const count = Number(master?.dataset.scrollyFrameCount) || 0;
    const pattern = master?.dataset.scrollyFrames || '';
    const frames = new Array(count);
    const ctx = master?.getContext?.('2d');
    let drawn = null, wanted = 0;
    // Кадр рисуется по дробному номеру: соседние кадры смешиваются по прозрачности.
    // Без этого секвенция шла ступенями — при перемотке скроллом на кадр приходится
    // десяток пикселей прокрутки, и глаз ловит скачки (правка Николая 2026-09-23).
    const ready = (k) => { const img = frames[k]; return img?.complete && img.naturalWidth ? img : null; };
    const nearest = (index) => {
      for (let d = 0; d < count; d += 1) {
        for (const k of [index - d, index + d]) if (ready(k)) return k;
      }
      return -1;
    };
    const draw = (position) => {
      wanted = Math.round(position);
      if (!ctx) return;
      const k0 = Math.max(0, Math.min(count - 1, Math.floor(position)));
      const f = Math.max(0, Math.min(1, position - k0));
      const a = ready(k0) ? k0 : nearest(k0);
      if (a < 0) return;
      const b = f > 0.02 && ready(k0 + 1) ? k0 + 1 : -1;
      const key = b < 0 ? `${a}` : `${a}:${b}:${f.toFixed(2)}`;
      if (key === drawn) return;
      ctx.globalAlpha = 1;
      ctx.drawImage(frames[a], 0, 0, master.width, master.height);
      if (b >= 0) {
        ctx.globalAlpha = f;
        ctx.drawImage(frames[b], 0, 0, master.width, master.height);
        ctx.globalAlpha = 1;
      }
      drawn = key;
    };
    // Холст держим в экранном размере, а не в 1080×2338: лишние пиксели — лишняя работа
    // на каждый кадр, а кадров теперь два (смешивание).
    // Размер исходника берём из атрибутов холста — их задаёт страница под свою секвенцию.
    const srcWidth = master?.width || 0;
    const srcRatio = srcWidth ? (master.height / srcWidth) : 0;
    const fitCanvas = () => {
      if (!master || !ctx || !srcWidth) return;
      const css = master.clientWidth;
      if (!css) return;
      // ⚠️ Запас 1.5 — камера приближает телефон до 1.45: без запаса холст был бы ровно
      // в размер вёрстки, а на экране растягивался и мылил (грабля «мыльной картинки»).
      const w = Math.min(srcWidth, Math.round(css * Math.min(2, window.devicePixelRatio || 1) * 1.5));
      if (Math.abs(master.width - w) <= 8) return;
      master.width = w;
      master.height = Math.round(w * srcRatio);
      // Кадр 1400px ужимается до размера экрана — качество ресемплинга задаём явно,
      // по умолчанию браузер экономит и картинка выходит мягче.
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawn = null;
    };
    if (ctx && count) {
      // порядок загрузки: каждый 8-й кадр (грубая перемотка готова быстро), потом остальные
      const order = [];
      for (let k = 0; k < count; k += 8) order.push(k);
      for (let k = 0; k < count; k += 1) if (k % 8) order.push(k);
      let next = 0;
      const load = () => {
        if (next >= order.length) return;
        const k = order[next++];
        const img = new Image();
        img.decoding = 'async';
        img.onload = img.onerror = () => { draw(wanted); load(); };
        img.src = pattern.replace('{n}', String(k + 1).padStart(3, '0'));
        frames[k] = img;
      };
      for (let lane = 0; lane < 6; lane += 1) load();
    }

    // ---- per-step clips (no master) ----
    let active = -1;
    const show = (index) => {
      if (master || index === active) return;
      active = index;
      media.forEach((clip) => {
        const current = clip.dataset.scrollyMedia === steps[index].dataset.scrollyStep;
        clip.classList.toggle('is-current', current);
        if (clip.tagName !== 'VIDEO') return;
        if (current && !still.matches) { clip.currentTime = 0; clip.play().catch(() => {}); }
        else if (current) clip.controls = true;
        else clip.pause();
      });
    };

    // ---- render at an eased progress ----
    const render = (r, box) => {
      let i = 0, g = 0;
      if (segments.length === steps.length) {
        // [полка 0][переезд][полка 1][переезд][полка 2]
        let u = r * runUnits, time = 0;
        for (let k = 0; k < steps.length; k += 1) {
          const [a, b] = segments[k], shelf = shelves[k];
          if (u <= shelf || k === steps.length - 1) { i = Math.min(k, steps.length - 2); g = k > i ? 1 : 0; time = a + clamp(u / shelf) * (b - a); break; }
          u -= shelf;
          if (u <= MOVE) { i = k; g = smooth(u / MOVE); time = b; break; }
          u -= MOVE;
        }
        if (count) draw(Math.max(0, Math.min(count - 1, time * fps)));
      } else {
        const t = r * (steps.length - 1);
        i = Math.max(0, Math.min(steps.length - 2, Math.floor(t)));
        const raw = t - i;
        g = steps.length < 2 ? 0 : smooth(clamp((raw - 0.3) / 0.4));
      }
      const from = shots[i], to = shots[Math.min(steps.length - 1, i + 1)];
      // Хвост в конце: пока плашка едет обратно в контейнер, камера отъезжает к «кадру покоя»
      // (--rest-*) — телефон целиком встаёт в маленькую плашку. Без этого под ним оставалась
      // пустая полоса: кадр броска рассчитан на полный экран (правка Николая 2026-09-23).
      const closing = smooth(clamp((r * runUnits - (runUnits - TAIL)) / TAIL));
      KEYS.forEach((key, k) => {
        const value = from[k] + (to[k] - from[k]) * g;
        stage?.style.setProperty(key, closing ? value + (rest[k] - value) * closing : value);
      });
      const pos = i + g;
      // The ATLAS pitch can orchestrate one expansion while the camera moves from Globe
      // to Year dial. `data-scrolly-expand="false"` keeps the plate in its initial bounds
      // while preserving the full-bleed stage that anchors its content to the page grid.
      if (surface && root.hasAttribute('data-scrolly-expand')) {
        // Раскрытие ведёт переезд Globe → Year dial, схлопывание — хвост в конце.
        const expands = root.dataset.scrollyExpand !== 'false';
        const expansion = expands ? clamp(pos) * (1 - closing) : 0;
        // На телефоне вся сцена — единая поверхность от края до края, без рамки карточки.
        const insetScale = mobile.matches ? 0 : 1 - expansion;
        const bounds = section?.getBoundingClientRect();
        const rootCss = getComputedStyle(document.documentElement);
        // Сверху-снизу плашка отступает на фиксированный токен. Брать сюда измеренное левое
        // поле нельзя: на широком экране слева лежит ещё и остаток центрирования контейнера
        // (на 1920 это ~384 px), и плашка схлопывалась в полоску — поймано Николаем 2026-09-23.
        const edge = parseFloat(rootCss.getPropertyValue('--space-6')) || 24;
        const radius = parseFloat(rootCss.getPropertyValue('--radius-media')) || 0;
        const left = Math.max(0, bounds?.left || 0) * insetScale;
        const vw = document.documentElement.clientWidth;
        const right = Math.max(0, vw - (bounds?.right || vw)) * insetScale;
        const vertical = edge * insetScale;
        surface.style.setProperty('--pitch-inset-top', `${vertical.toFixed(2)}px`);
        surface.style.setProperty('--pitch-inset-right', `${right.toFixed(2)}px`);
        surface.style.setProperty('--pitch-inset-bottom', `${vertical.toFixed(2)}px`);
        surface.style.setProperty('--pitch-inset-left', `${left.toFixed(2)}px`);
        surface.style.setProperty('--pitch-radius', `${(radius * insetScale).toFixed(2)}px`);
      }
      steps.forEach((step, k) => {
        const d = pos - k;
        step.style.setProperty('--d', d.toFixed(3));
        // Тексты стоят в одном слоте: старый обязан уйти целиком до прихода нового,
        // иначе на середине пути две строки накладываются в кашу (поймано 2026-09-22).
        step.style.setProperty('--o', (1 - smooth(clamp((Math.abs(d) - 0.1) / 0.3))).toFixed(3));
        // Текущий шаг помечается классом — по нему CSS играет общий вход сайта (case-enter).
        step.classList.toggle('is-current', Math.abs(d) < .5);
      });
      show(Math.round(pos));
      const visible = box.bottom > 0 && box.top < window.innerHeight;
      media.forEach((clip) => { if (clip.tagName === 'VIDEO' && !visible) clip.pause(); });
    };

    // Сглаживание: прогресс догоняет скролл по экспоненте, независимо от частоты кадров.
    // Щелчки колеса превращаются в одно движение; при reduced motion — без догоняния.
    const EASE = 0.16;
    let target = 0, current = null, last = 0, running = false;
    const measure = () => {
      fitCanvas();
      if (root.hasAttribute('data-scrolly-expand')) {
        // Во всю ширину — по clientWidth и измеренному левому полю секции, а не через left:50%:
        // с полосой прокрутки половина 100vw и половина clientWidth расходятся, и плашка
        // вставала на пару пикселей левее (поймано 2026-09-23).
        const viewportWidth = document.documentElement.clientWidth;
        const shift = section ? section.getBoundingClientRect().left : viewportWidth * .5;
        root.style.setProperty('--pitch-viewport-width', `${viewportWidth}px`);
        root.style.setProperty('--pitch-viewport-shift', `${(-shift).toFixed(2)}px`);
      }
      const box = root.getBoundingClientRect();
      target = clamp(-box.top / Math.max(1, root.offsetHeight - pin.offsetHeight));
      return box;
    };
    const tick = (now) => {
      const box = measure();
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      if (current === null || still.matches) current = target;
      else current += (target - current) * (1 - Math.pow(1 - EASE, dt * 60));
      if (Math.abs(target - current) < 0.0002) current = target;
      render(current, box);
      if (current !== target) requestAnimationFrame(tick);
      else { running = false; last = 0; }
    };
    const request = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    request();
  });
})();

/* One object: the case's first screen and its three moves are one sticky scene. The
   section is as tall as its steps; while it passes, the step under the scroll becomes
   current and its id goes to the phone (data-current), which moves the 3D phone into
   that pose and plays the gesture (tools/atlas-phone-motion.js). Steps switch, they are
   not scrubbed — the camera move itself is timed, the same as a click would give. */
(function () {
  document.querySelectorAll('[data-one-object]').forEach((root) => {
    const steps = [...root.querySelectorAll('[data-one-step]')];
    const phone = root.querySelector('[data-phone-scene]');
    if (!steps.length || !phone) return;
    root.style.setProperty('--one-steps', steps.length);

    let current = -1;
    const update = () => {
      const box = root.getBoundingClientRect();
      const run = Math.max(1, root.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -box.top / run));
      const index = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      if (index === current) return;
      current = index;
      steps.forEach((step, k) => {
        step.classList.toggle('is-current', k === index);
        step.classList.toggle('is-past', k < index);
        step.inert = k !== index;
      });
      root.dataset.step = steps[index].dataset.oneStep || 'intro';
      phone.dataset.current = steps[index].dataset.oneStep;
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();



/* Тач: щит над прототипом в хиро. Тап — прототип оживает; «Scroll page» или уход
   из кадра — запирает обратно, чтобы страница листалась пальцем по телефону. */
(function () {
  document.querySelectorAll('.case-hero-media').forEach((media) => {
    const unlock = media.querySelector('[data-embed-unlock]');
    const lock = media.querySelector('[data-embed-lock]');
    if (!unlock || !lock) return;
    const frame = media.querySelector('iframe[src^="atlas-app/"]');
    let inViewport = true;
    const syncViewport = () => frame?.contentWindow.__setAtlasViewportActive?.(inViewport);
    frame?.addEventListener('load', syncViewport);
    const setLive = (live) => media.classList.toggle('is-live', live);
    unlock.addEventListener('click', () => setLive(true));
    lock.addEventListener('click', () => setLive(false));
    new IntersectionObserver((entries) => {
      inViewport = entries[0].isIntersecting;
      if (!inViewport) setLive(false);
      syncViewport();
    }, { threshold: 0.2 }).observe(media);
  });
})();

/* ?diag на странице кейса пробрасывается в iframe с прототипом: его панель показывает
   размеры окна и позиции элементов, чтобы снять прыжок раскладки на живом телефоне. */
(function () {
  if (location.search.indexOf('diag') === -1) return;
  document.querySelectorAll('.case-hero-media iframe').forEach((frame) => {
    frame.src += (frame.src.indexOf('?') === -1 ? '?' : '&') + 'diag=1';
  });
})();
