/* Design system playbook.

   The page renders itself from design-system.css: every custom property
   declared on :root becomes a card here. Add a token to the CSS and it
   shows up on this page — there is no second list to keep in sync. */

(() => {
  const SOURCE = 'design-system.css';

  /* Prefix -> section. The only hand-kept mapping on the page, and it is
     about grouping, not values. An unknown prefix falls into "Other",
     which is the signal to add it here. */
  const SECTIONS = [
    { id: 'color',  title: 'Color',      prefixes: ['--color-', '--gradient-'], render: renderColor },
    { id: 'type',   title: 'Typography', prefixes: ['--text-', '--font-', '--line-height-', '--letter-spacing-'], render: renderType },
    { id: 'space',  title: 'Spacing',    prefixes: ['--space-'], render: renderSpace },
    { id: 'layout', title: 'Layout',     prefixes: ['--layout-', '--content-', '--case-', '--project-', '--avatar-'], render: renderPlain },
    { id: 'shape',  title: 'Shape',      prefixes: ['--radius-', '--border-', '--focus-', '--control-', '--icon-', '--cursor-', '--device-', '--flow-'], render: renderShape },
    { id: 'motion', title: 'Motion',     prefixes: ['--duration-', '--ease-', '--scroll-', '--reveal-', '--parallax-'], render: renderMotion },
    { id: 'other',  title: 'Other',      prefixes: [], render: renderPlain },
  ];

  const root = document.documentElement;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px';
  document.body.appendChild(probe);

  /* Custom properties come back as written ("clamp(43px, 4vw, 58px)").
     Bouncing one through a real property gives the number a reader wants. */
  function resolve(name, property) {
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;top:-9999px';
    probe.style.setProperty(property, `var(${name})`);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.style.removeProperty(property);
    return value;
  }

  function readTokens() {
    const sheet = [...document.styleSheets].find(s => s.href && s.href.includes(SOURCE));
    if (!sheet) return null;

    let rules;
    try { rules = sheet.cssRules; } catch { return null; }   // file:// blocks cssRules

    const order = [];
    const seen = new Map();
    const collect = (style, key) => {
      for (const prop of style) {
        if (!prop.startsWith('--')) continue;
        if (!seen.has(prop)) { seen.set(prop, { name: prop }); order.push(seen.get(prop)); }
        seen.get(prop)[key] = style.getPropertyValue(prop).trim();
      }
    };

    for (const rule of rules) {
      if (rule.selectorText === ':root') collect(rule.style, 'light');
      else if (rule.selectorText === ':root[data-theme="dark"]') collect(rule.style, 'dark');
      else if (rule.media && rule.media.mediaText.includes('780px')) {
        for (const inner of rule.cssRules || []) {
          if (inner.selectorText === ':root') collect(inner.style, 'mobile');
        }
      }
    }
    return order;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /* Every card carries its own name and copies var(--name) on click. */
  function card(token, preview, meta) {
    const node = el('button', 'pb-card');
    node.type = 'button';
    node.dataset.token = token.name;
    node.title = `Copy var(${token.name})`;
    if (preview) node.appendChild(preview);
    const body = el('span', 'pb-card-body');
    body.appendChild(el('code', 'pb-card-name', token.name));
    body.appendChild(el('span', 'pb-card-value', token.light));
    if (meta) body.appendChild(el('span', 'pb-card-meta', meta));
    const layer = /^var\(--[a-z0-9-]+\)$/.test(token.light || '') ? 'роль → ступень' : null;
    if (layer) body.appendChild(el('span', 'pb-card-layer', layer));
    if (token.dark) body.appendChild(el('span', 'pb-card-meta', `dark · ${token.dark}`));
    if (token.mobile) body.appendChild(el('span', 'pb-card-meta', `780↓ · ${token.mobile}`));
    node.appendChild(body);
    return node;
  }

  function renderColor(token) {
    const swatch = el('span', 'pb-swatch');
    swatch.style.background = `var(${token.name})`;
    return card(token, swatch);
  }

  function renderType(token) {
    const sample = el('span', 'pb-type-sample', 'Ag');
    if (token.name.startsWith('--text-') || token.name.startsWith('--font-size-')) {
      sample.style.fontSize = `var(${token.name})`;
      return card(token, sample, `computed · ${resolve(token.name, 'font-size')}`);
    }
    if (token.name.startsWith('--font-weight-')) {
      sample.style.fontWeight = `var(${token.name})`;
      return card(token, sample);
    }
    if (token.name.startsWith('--line-height-')) {
      sample.textContent = 'Two lines\nof text';
      sample.className = 'pb-type-sample pb-type-sample--lines';
      sample.style.lineHeight = `var(${token.name})`;
      return card(token, sample);
    }
    if (token.name.startsWith('--letter-spacing-')) {
      sample.textContent = 'Tracking';
      sample.style.letterSpacing = `var(${token.name})`;
      return card(token, sample);
    }
    sample.style.fontFamily = `var(${token.name})`;
    return card(token, sample);
  }

  function renderSpace(token) {
    const bar = el('span', 'pb-bar');
    bar.style.width = `var(${token.name})`;
    return card(token, bar);
  }

  function renderShape(token) {
    if (!token.name.startsWith('--radius-')) return renderPlain(token);
    const box = el('span', 'pb-radius');
    box.style.borderRadius = `var(${token.name})`;
    return card(token, box);
  }

  /* Durations and easings only mean something in motion, so the card runs. */
  function renderMotion(token) {
    const isDuration = token.name.startsWith('--duration-') || token.name.includes('delay');
    const isEase = token.name.startsWith('--ease-');
    if (!isDuration && !isEase) return renderPlain(token);

    const track = el('span', 'pb-track');
    const dot = el('span', 'pb-dot');
    track.appendChild(dot);
    dot.style.transitionDuration = isDuration ? `var(${token.name})` : 'var(--duration-slow)';
    dot.style.transitionTimingFunction = isEase ? `var(${token.name})` : 'var(--ease-standard)';

    const node = card(token, track, isDuration ? `computed · ${resolve(token.name, 'transition-duration')}` : null);
    node.addEventListener('pointerenter', () => track.classList.add('is-running'));
    node.addEventListener('pointerleave', () => track.classList.remove('is-running'));
    node.addEventListener('focus', () => track.classList.add('is-running'));
    node.addEventListener('blur', () => track.classList.remove('is-running'));
    return node;
  }

  function renderPlain(token) {
    return card(token, null);
  }

  function build() {
    const tokens = readTokens();
    const mount = document.querySelector('[data-playbook]');
    const nav = document.querySelector('[data-playbook-nav]');
    if (!mount || !nav) return;

    if (!tokens) {
      mount.querySelector('[data-playbook-tokens]').appendChild(offlineNote());
      return;
    }

    const buckets = new Map(SECTIONS.map(s => [s.id, []]));
    for (const token of tokens) {
      const section = SECTIONS.find(s => s.prefixes.some(p => token.name.startsWith(p)));
      buckets.get(section ? section.id : 'other').push(token);
    }

    const host = mount.querySelector('[data-playbook-tokens]');
    for (const section of SECTIONS) {
      const list = buckets.get(section.id);
      if (!list.length) continue;

      const node = el('section', 'ds-doc-section');
      node.id = section.id;
      const head = el('div', 'pb-section-head');
      head.appendChild(el('h2', 'ds-heading-2 ds-doc-section-title', section.title));
      head.appendChild(el('p', 'ds-label', `${list.length} tokens`));
      node.appendChild(head);

      const grid = el('div', `pb-grid pb-grid--${section.id}`);
      for (const token of list) grid.appendChild(section.render(token));
      node.appendChild(grid);
      host.appendChild(node);
    }

    buildNav(nav);
  }

  function offlineNote() {
    const note = el('div', 'ds-card');
    note.appendChild(el('p', 'ds-card-eyebrow', 'Tokens not readable'));
    note.appendChild(el('p', 'ds-card-title', 'Open the site over a static server'));
    note.appendChild(el('p', 'ds-body',
      'The browser hides stylesheet contents from a page opened as a file, so this section cannot read design-system.css. Run "python3 -m http.server" in Portfolio_Codex and open localhost:8000/design-system.html. Everything below this section works either way.'));
    return note;
  }

  /* The side rail follows the reader. */
  function buildNav(nav) {
    const sections = [...document.querySelectorAll('.ds-doc-section[id]')];
    const links = new Map();
    for (const section of sections) {
      const title = section.querySelector('.ds-doc-section-title');
      const link = el('a', 'pb-nav-link', title ? title.textContent : section.id);
      link.href = `#${section.id}`;
      nav.appendChild(link);
      links.set(section.id, link);
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links.values()) link.removeAttribute('aria-current');
        links.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const section of sections) observer.observe(section);
  }

  function bindCopy() {
    document.addEventListener('click', async event => {
      const node = event.target.closest('[data-token]');
      if (!node) return;
      const text = `var(${node.dataset.token})`;
      try { await navigator.clipboard.writeText(text); } catch { return; }
      node.classList.add('is-copied');
      setTimeout(() => node.classList.remove('is-copied'), 900);
    });
  }

  build();
  bindCopy();
})();
