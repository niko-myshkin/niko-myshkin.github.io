/* ATLAS — режим UX-теста. Включается ссылкой ?test=1; грузит его загрузчик в последней строке
   prototype-graphite-v4.html, без флага продукт этого файла не видит вовсе.
   Сценарий и что меряем — 02_research/ux-test-async.md.

   Ничего никуда не отправляет: в конце человек сам копирует текст и пересылает тому, кто дал ссылку.
   Время, касания, звук и успех заданий снимаются по состоянию продукта (state, au, PLACES) —
   продукт при этом не трогается, только читается.

   Оформление — токены продукта (--bg0, --bg1, --lav, --ink, --dim, --on-accent, --r-sheet, --r-bar,
   --r-pill, --ui, --italic) и кегли канона 13 / 15 / 26. Это хром теста поверх продуктового кадра,
   как панель ?tune=1, а не интерфейс продукта. */
(function () {
  'use strict';
  const VER = 'test-5 · 2026-09-14';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const now = () => performance.now();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const sec = ms => (ms / 1000).toFixed(1) + ' с';

  const CSS = `
.tm, .tm * { box-sizing: border-box; }
.tm { font-family: var(--ui); color: var(--ink); -webkit-font-smoothing: antialiased; }
.tm-scrim { position: fixed; inset: 0; z-index: 1000; background: color-mix(in srgb, var(--bg0) 72%, transparent); }
.tm-block { position: fixed; inset: 0; z-index: 1000; }
.tm-card { position: fixed; z-index: 1001; left: 16px; right: 16px; bottom: calc(16px + env(safe-area-inset-bottom));
  max-height: calc(100% - 32px - env(safe-area-inset-top)); overflow: auto; padding: 24px;
  background: var(--bg1); border-radius: var(--r-sheet); box-shadow: inset 0 0 0 1px #242424; }
.tm-card.row { display: flex; align-items: center; gap: 16px; padding: 16px 16px 16px 24px; }
.tm-card.row .tm-p { margin: 0; flex: 1; }
.tm-card.row .tm-btn { width: auto; margin: 0; padding: 0 24px; flex: none; }
.tm-k { margin: 0 0 8px; font-size: 13px; line-height: 1.45; color: var(--dim); }
.tm-h { margin: 0 0 8px; font-family: var(--italic); font-weight: 400; font-size: 26px; line-height: 1.15; color: var(--ink); }
.tm-p { margin: 0 0 16px; font-size: 15px; line-height: 1.45; color: var(--dim); }
.tm-btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 56px; margin-top: 8px;
  border: 0; border-radius: var(--r-pill); background: var(--lav); color: var(--on-accent); font: 600 15px var(--ui); cursor: pointer; }
.tm-btn:disabled { opacity: .6; cursor: default; }
.tm-btn.ghost.on { background: var(--lav); color: var(--on-accent); box-shadow: none; }
.tm-card.top { top: calc(16px + env(safe-area-inset-top)); bottom: auto; }
.tm-btn.ghost { background: transparent; color: var(--ink); box-shadow: inset 0 0 0 1px rgba(255,255,255,.28); }
.tm-ta { display: block; width: 100%; min-height: 88px; margin: 0 0 16px; padding: 12px; border: 0; border-radius: var(--r-bar);
  background: var(--bg0); box-shadow: inset 0 0 0 1px #242424; color: var(--ink); font: 15px/1.45 var(--ui); resize: vertical; }
.tm-ta.out { min-height: 200px; font-size: 13px; }
.tm-seq { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 8px 0; }
.tm-seq button { min-height: 44px; border: 0; border-radius: var(--r-bar); background: var(--bg0);
  box-shadow: inset 0 0 0 1px #242424; color: var(--ink); font: 600 15px var(--ui); cursor: pointer; }
.tm-seq-l { display: flex; justify-content: space-between; font-size: 13px; color: var(--dim); }
.tm-pill { position: fixed; z-index: 1001; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px;
  height: 44px; max-width: calc(100% - 120px); padding-left: 16px; background: var(--bg1); border-radius: var(--r-pill);
  box-shadow: inset 0 0 0 1px #242424; font-size: 13px; }
.tm-pill span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tm-pill button { flex: none; height: 44px; padding: 0 16px; border: 0; border-radius: var(--r-pill); background: transparent;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.28); color: var(--ink); font: 500 13px var(--ui); cursor: pointer; }
.tm-mark { position: fixed; z-index: 1001; width: 36px; height: 36px; margin: -18px 0 0 -18px; display: grid; place-items: center;
  border-radius: 50%; background: var(--bg0); box-shadow: inset 0 0 0 2px var(--lav); color: var(--lav);
  font: 600 15px var(--ui); pointer-events: none; }
`;

  const R = { meta: {}, look: '', t1: null, t2: null, t3: null, free: null, q: [] };
  const Q = ['Как нашёл(ла) музыку, которая зацепила', 'Как часто включает подборки', 'Когда слушал(а) другую страну или время', 'Что было непонятно'];

  const style = el('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = el('div', 'tm'); document.body.appendChild(root);

  // ---- касания: в фазе захвата, до обработчиков продукта; элементы теста не считаем ----
  const LABELS = [['#cardPlay, #npfPlay', 'play'], ['#diceBtn, .dice-f', 'заброс'], ['#globe', 'глобус'], ['.dial-row', 'шкала'],
    ['.ctl-like', '♥'], ['.ctl-prev', 'назад'], ['.ctl-next', 'дальше'], ['.ctl-queue', 'список'], ['.ctl-activity', 'статистика'],
    ['#avatar', 'аватар'], ['#signin', 'окно входа'], ['#nowsheet', 'экран трека'], ['#track', 'плеер']];
  let taps = null;
  document.addEventListener('pointerdown', e => {
    if (!taps || e.target.closest('.tm')) return;
    const hit = LABELS.find(([s]) => e.target.closest(s));
    taps.push(hit ? hit[1] : 'другое');
  }, true);

  // ---- состояние продукта: только чтение ----
  // «звук пошёл» — по состоянию продукта, а не по событиям <audio>: state.playing ставит startPlay()
  // при нажатии play; до первого нажатия он ложный, и заброс его не включает (решение 2026-09-09).
  // События плеера здесь ненадёжны: в фоновой вкладке и при медленной сети они приходят с опозданием.
  const playing = () => { try { return state.playing === true; } catch (e) { return false; } };
  const placeOf = () => { try { return PLACES.find(p => p.id === state.place) || {}; } catch (e) { return {}; } };
  const liked = () => !!document.querySelector('.ctl-like.on, #likeRow.on, #npfLike.on');

  const tapSummary = list => {
    if (!list.length) return 'касаний 0';
    const c = {}; list.forEach(l => { c[l] = (c[l] || 0) + 1; });
    return 'касаний ' + list.length + ' (' + Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ') + '), первым: ' + list[0];
  };
  const outcome = t => (t.ok === true ? 'да' : 'нет — ' + (t.reason || '«сдаюсь»') + (t.how ? ' «' + t.how + '»' : ''))
    + ' · ' + sec(t.ms) + ' · ' + tapSummary(t.taps);

  // ---- карточки ----
  const clear = () => { root.innerHTML = ''; };
  function card(html, scrim = true) {
    clear();
    if (scrim) root.appendChild(el('div', 'tm-scrim'));
    const c = el('div', 'tm-card', html); root.appendChild(c); return c;
  }
  function pill(label, buttons) {
    clear();
    const a = $('#avatar'); const r = a ? a.getBoundingClientRect() : { top: 12, height: 40 };
    const p = el('div', 'tm-pill');
    p.style.top = Math.max(4, Math.round(r.top + r.height / 2 - 22)) + 'px';
    const span = el('span', '', label); p.appendChild(span);
    buttons.forEach(b => { const x = el('button', '', b.text); x.type = 'button'; x.onclick = b.on; p.appendChild(x); });
    root.appendChild(p);
    return span;
  }
  const oneButton = (html, label = 'Начать') => new Promise(res => {
    const c = card(html + `<button class="tm-btn" type="button">${label}</button>`);
    c.querySelector('.tm-btn').onclick = res;
  });

  // задание: полоска с текстом и кнопкой «Сдаюсь», продукт свободен; успех — по состоянию
  function run({ label, done, tick, extra, limit, stop = 'Сдаюсь' }) {
    return new Promise(res => {
      taps = []; const t0 = now(); let over = false, iv = 0;
      const finish = out => {
        if (over) return; over = true; clearInterval(iv);
        const list = taps; taps = null; clear();
        res(Object.assign({ ms: now() - t0, taps: list }, out));
      };
      const buttons = (extra || []).map(b => ({ text: b.text, on: () => finish(b.result) }));
      if (stop) buttons.push({ text: stop, on: () => finish({ ok: false }) });
      const span = pill(label, buttons);
      iv = setInterval(() => {
        const t = now() - t0;
        if (tick) tick(span, t);
        if (done && done(t0)) finish({ ok: true });
        else if (limit && t >= limit) finish({ ok: true, timeout: true });
      }, 200);
    });
  }

  const seq = n => new Promise(res => {
    const c = card(`<p class="tm-k">Задание ${n}</p><h2 class="tm-h">Насколько это было легко?</h2>
      <div class="tm-seq">${[1, 2, 3, 4, 5, 6, 7].map(i => `<button type="button">${i}</button>`).join('')}</div>
      <div class="tm-seq-l"><span>1 — очень трудно</span><span>7 — очень легко</span></div>`);
    c.querySelectorAll('.tm-seq button').forEach((b, i) => { b.onclick = () => res(i + 1); });
  });

  // после «Сдаюсь»: непонятое задание — дефект теста, «не нашёл как» — находка о продукте.
  // Пилот 2026-09-14 показал, почему это нужно: без вопроса «не понял» пряталось в «по-своему».
  const NOT_CLEAR = 'не понял(а) задание';
  const OTHER_WAY = ['Скриншот', 'Shazam или другое приложение', 'Запомнил(а)', 'Другое'];
  const why = () => new Promise(res => {
    const c = card(`<p class="tm-k">Ничего страшного — это тоже результат</p><h2 class="tm-h">Что случилось?</h2>
      <button class="tm-btn ghost" type="button" data-r="${NOT_CLEAR}">Не понял(а), что нужно сделать</button>
      <button class="tm-btn ghost" type="button" data-r="не нашёл(ла), как">Понял(а), но не нашёл(ла), как</button>
      <button class="tm-btn ghost" type="button" data-r="сделал(а) по-другому">Сделал(а) по-другому</button>`);
    c.querySelectorAll('[data-r]').forEach(b => { b.onclick = () => {
      const reason = b.dataset.r;
      if (reason !== 'сделал(а) по-другому') return res({ reason });
      pick(`<p class="tm-k">Сделал(а) по-другому</p><h2 class="tm-h">Как именно?</h2>`, OTHER_WAY).then(how => res({ reason, how }));
    }; });
  });
  // оценка лёгкости после непонятого задания ничего не значит — не спрашиваем
  const rate = async (t, n) => { if (t.ok !== true) Object.assign(t, await why()); t.seq = t.reason === NOT_CLEAR ? null : await seq(n); };

  // ---- выбор из готовых ответов: писать ничего не нужно (просьба Николая 2026-09-14) ----
  // ⚠️ не «shuffle»: это имя глобальной функции заброса в продукте, её зовёт задание 2
  const mix = (arr, keepLast = 1) => {          // случайный порядок, «не знаю» — всегда последним
    const head = arr.slice(0, arr.length - keepLast), tail = arr.slice(arr.length - keepLast);
    for (let i = head.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [head[i], head[j]] = [head[j], head[i]]; }
    return head.concat(tail);
  };
  const optionsHtml = opts => opts.map(o => `<button class="tm-btn ghost" type="button" data-o="${o}">${o}</button>`).join('');
  // один вопрос — одна карточка, тап по варианту сразу ведёт дальше.
  // keep — не стирать то, что уже на экране (метки первого взгляда); pos 'top' — карточка сверху
  const pick = (html, opts, { keep = false, pos = '' } = {}) => new Promise(res => {
    if (!keep) { clear(); root.appendChild(el('div', 'tm-scrim')); }
    const c = el('div', 'tm-card' + (pos ? ' ' + pos : ''), html + optionsHtml(opts));
    root.appendChild(c);
    c.querySelectorAll('[data-o]').forEach(b => { b.onclick = () => { c.remove(); res(b.dataset.o); }; });
  });

  // ---- шаги ----
  // «Это кнопка» — не выдумка: так шкалу прочитал первый человек, увидевший экран со стороны (2026-09-04)
  const GLOBE = ['Крутить и выбирать место', 'Просто картинка', 'Показывает, где я нахожусь', 'Не знаю'];
  const DIAL = ['Листать и выбирать эпоху', 'Показывает текущий год', 'Это кнопка', 'Не знаю'];
  async function firstLook() {
    clear();
    root.appendChild(el('div', 'tm-block'));
    // метки не на центре: там город под прицелом и активный год. Позицию пересчитываем,
    // пока вопросы висят: глобус после заставки ещё доезжает, и разовый замер промахивался
    const g = $('#globe'), d = $('.dial-row');
    const marks = [[g, '1', r => [r.left + r.width / 2, r.top + 28]], [d, '2', r => [r.left + 28, r.top + r.height / 2]]]
      .filter(([node]) => node)
      .map(([node, n, at]) => { const m = el('div', 'tm-mark', n); root.appendChild(m); return { node, m, at }; });
    const place = () => marks.forEach(({ node, m, at }) => {
      const [x, y] = at(node.getBoundingClientRect()); m.style.left = Math.round(x) + 'px'; m.style.top = Math.round(y) + 'px';
    });
    place(); const follow = setInterval(place, 250);
    await new Promise(res => {
      const c = el('div', 'tm-card row', `<p class="tm-p">Ничего не нажимай. Посмотри на экран и на цифры 1 и 2.</p><button class="tm-btn" type="button">Ответить</button>`);
      root.appendChild(c);
      c.querySelector('.tm-btn').onclick = () => { c.remove(); res(); };
    });
    // про 1 — карточка снизу, глобус с меткой виден; про 2 — сверху, видна шкала
    R.look1 = await pick(`<p class="tm-k">Первый взгляд</p><h2 class="tm-h">Что делает 1?</h2>`, mix(GLOBE), { keep: true });
    R.look2 = await pick(`<p class="tm-k">Первый взгляд</p><h2 class="tm-h">Что делает 2?</h2>`, mix(DIAL), { keep: true, pos: 'top' });
    clearInterval(follow); clear();
  }

  const FOUND = ['Подборка приложения', 'Посоветовали', 'Соцсети или видео', 'Искал(а) сам(а)', 'Не помню'];
  const OFTEN = ['Почти всегда', 'Часто', 'Иногда', 'Редко', 'Никогда'];
  const WHEN = ['На этой неделе', 'В этом месяце', 'Давно', 'Не помню такого'];
  const UNCLEAR = ['Как включить звук', 'Как выбрать место', 'Как выбрать год', 'Как сохранить', 'Что это за приложение'];
  const ALL_CLEAR = 'Всё было понятно';
  async function questions() {
    R.q[0] = await pick(`<p class="tm-k">Вопрос 1 из 4</p><h2 class="tm-h">Как ты в последний раз нашёл(ла) новую музыку, которая зацепила?</h2>`, mix(FOUND));
    R.q[1] = await pick(`<p class="tm-k">Вопрос 2 из 4</p><h2 class="tm-h">Как часто ты включаешь то, что приложение подобрало само?</h2>`, OFTEN);
    R.q[2] = await pick(`<p class="tm-k">Вопрос 3 из 4</p><h2 class="tm-h">Когда ты последний раз слушал(а) музыку другой страны или другого времени?</h2>`, WHEN);
    await new Promise(res => {
      const c = card(`<p class="tm-k">Вопрос 4 из 4 · можно несколько</p><h2 class="tm-h">Что было непонятно?</h2>
        ${optionsHtml(UNCLEAR.concat(ALL_CLEAR))}
        <textarea class="tm-ta" rows="2" placeholder="Хочешь — добавь своими словами (необязательно)"></textarea>
        <button class="tm-btn" type="button" data-done>Готово</button>`);
      const opts = [...c.querySelectorAll('[data-o]')];
      opts.forEach(b => { b.onclick = () => {
        if (b.dataset.o === ALL_CLEAR) { const on = !b.classList.contains('on'); opts.forEach(x => x.classList.toggle('on', x === b && on)); }
        else { b.classList.toggle('on'); opts.find(x => x.dataset.o === ALL_CLEAR).classList.remove('on'); }
      }; });
      c.querySelector('[data-done]').onclick = () => {
        R.q[3] = opts.filter(x => x.classList.contains('on')).map(x => x.dataset.o).join(', ');
        R.note = c.querySelector('.tm-ta').value.trim();
        res();
      };
    });
  }

  function resultText() {
    const L = ['ATLAS · UX-тест (' + VER + ')', 'Устройство: ' + R.meta.dev + ' · ' + R.meta.size + ' · ' + R.meta.at, ''];
    L.push('0 Первый взгляд: 1 (глобус) — «' + (R.look1 || '—') + '», 2 (шкала) — «' + (R.look2 || '—') + '»');
    L.push('1 Звук: ' + outcome(R.t1));
    L.push('2 Япония 1970-х: ' + outcome(R.t2) + ' · смен места ' + R.t2.places + ', декады ' + R.t2.decs + ' · лёгкость ' + (R.t2.seq ?? '—'));
    L.push('3 Сохранить: ' + outcome(R.t3) + (R.t3.signin ? ' · было окно входа' : '') + ' · лёгкость ' + (R.t3.seq ?? '—'));
    L.push('4 Свободно: ' + sec(R.free.ms) + ' · забросов ' + R.free.throws + ' · сохранений ' + R.free.saves + ' · мест ' + R.free.placesSeen);
    L.push('');
    Q.forEach((q, i) => L.push(q + ': ' + (R.q[i] || '—')));
    if (R.note) L.push('Своими словами: ' + R.note);
    return L.join('\n');
  }

  // Отправка — в Google Форму Николая «ATLAS тест», одно поле «Результат» (создана 2026-09-14).
  // Google не показывает браузеру ответ (mode: no-cors), поэтому «Скопировать» остаётся запасным путём.
  const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSf8_L7tJKFvJC3DF7rtR-k0XKJpRtTVY_WHyReYLarz2ALZ4Q/formResponse';
  const FIELD = 'entry.1875269691';

  function finish() {
    const text = resultText();
    const c = card(`<p class="tm-k">Готово, спасибо!</p><h2 class="tm-h">Отправь результат</h2>
      <p class="tm-p">Одна кнопка — и результат уйдёт в Google Форму того, кто дал тебе ссылку. Имени и почты в нём нет.</p>
      <textarea class="tm-ta out" readonly></textarea>
      <button class="tm-btn" type="button" data-send>Отправить</button>
      <button class="tm-btn ghost" type="button" data-copy>Скопировать</button>`);
    const ta = c.querySelector('.tm-ta'); ta.value = text;
    const send = c.querySelector('[data-send]'), copy = c.querySelector('[data-copy]');
    send.onclick = () => {
      if (send.disabled) return;
      send.disabled = true; send.textContent = 'Отправляю…';
      fetch(FORM, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [FIELD]: text }) })
        .then(() => { send.textContent = 'Отправлено ✓ Спасибо!'; })
        .catch(() => { send.disabled = false; send.textContent = 'Не отправилось — ещё раз или «Скопировать»'; });
    };
    copy.onclick = () => {
      const manual = () => { ta.focus(); ta.select(); copy.textContent = 'Текст выделен — скопируй вручную'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => { copy.textContent = 'Скопировано ✓'; }, manual);
      else manual();
    };
    window.__atlasTest = text;   // для проверки из консоли
  }

  // ---- ход теста ----
  // старт — когда заставка кончилась И глобус встал: класс booting снимается раньше,
  // чем камера доезжает, и первый взгляд застал бы планету на полпути
  function ready(cb) {
    let lastTop = null, still = 0;
    const iv = setInterval(() => {
      const app = $('.app'), g = $('#globe');
      if (!app || app.classList.contains('booting') || typeof state === 'undefined' || typeof au === 'undefined' || !g) return;
      const top = Math.round(g.getBoundingClientRect().top);
      still = top === lastTop ? still + 1 : 0; lastTop = top;
      if (still >= 3) { clearInterval(iv); cb(); }
    }, 200);
  }

  ready(async () => {
    // тест всегда идёт гостем: иначе задание «сохранить» пройдёт без окна входа
    try { if (state.signedIn && typeof logOut === 'function') logOut(); } catch (e) {}
    const ua = navigator.userAgent;
    R.meta = { dev: /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'компьютер',
      size: innerWidth + '×' + innerHeight, at: new Date().toLocaleString('ru-RU') };

    await oneButton(`<p class="tm-k">Тест ATLAS · около 7 минут</p><h2 class="tm-h">Проверяем приложение, а не тебя</h2>
      <p class="tm-p">Сначала один взгляд, потом четыре задания и пара вопросов. Время и нажатия приложение запишет само — ничего записывать не надо.</p>
      <p class="tm-p">Если задание не выходит — жми «Сдаюсь»: это тоже результат. Надень наушники или включи звук.</p>`, 'Начать');

    await firstLook();

    await oneButton(`<p class="tm-k">Задание 1 из 4</p><h2 class="tm-h">Включи что-нибудь послушать</h2>`);
    R.t1 = await run({ label: 'Включи что-нибудь послушать', done: () => playing() });
    if (R.t1.ok !== true) Object.assign(R.t1, await why());

    // если заброс уже стоит на Японии, задание решилось бы само — уводим в другое место
    for (let i = 0; i < 3 && placeOf().country === 'Japan'; i++) { try { shuffle(); } catch (e) {} await wait(2500); }
    await oneButton(`<p class="tm-k">Задание 2 из 4</p><h2 class="tm-h">Послушай музыку Японии 1970-х</h2>`);
    let lastPlace = state.place, lastDec = state.dec, places = 0, decs = 0;
    R.t2 = await run({
      label: 'Музыка Японии 1970-х',
      tick: () => {
        if (state.place !== lastPlace) { places++; lastPlace = state.place; }
        if (state.dec !== lastDec) { decs++; lastDec = state.dec; }
      },
      done: () => placeOf().country === 'Japan' && String(state.dec) === '1970' && playing(),
    });
    Object.assign(R.t2, { places, decs });
    await rate(R.t2, 2);

    await oneButton(`<p class="tm-k">Задание 3 из 4</p><h2 class="tm-h">Тебе понравилась песня, которая сейчас играет</h2>
      <p class="tm-p">Сохрани её в приложении, чтобы потом найти. Если попросят почту — подойдёт любая, даже выдуманная: прототип ничего не отправляет.</p>`);
    let signin = false;
    // успех — ♥ текущего трека закрашено: рост списка обманул бы, вход подтягивает демо-карту
    R.t3 = await run({
      label: 'Сохрани эту песню',
      tick: () => { if (document.querySelector('#signin.up, #signin.active, #signup.up, #login.up')) signin = true; },
      done: () => liked(),
    });
    R.t3.signin = signin;
    await rate(R.t3, 3);

    await oneButton(`<p class="tm-k">Задание 4 из 4</p><h2 class="tm-h">Две минуты — покрути что хочешь</h2>
      <p class="tm-p">Время приложение засечёт само. Можно закончить раньше.</p>`);
    // сохранения — по закрашиванию ♥, а не по росту списка: вход посреди режима подтягивает демо-карту
    // из 17 находок, и пилот 2026-09-14 насчитал «18 сохранений» за одно нажатие
    let wasOn = liked(), saves = 0; const seen = new Set([state.place]);
    R.free = await run({
      label: 'Свободно · 2:00', limit: 120000, stop: 'Хватит',
      tick: (span, t) => {
        seen.add(state.place);
        const on = liked(); if (on && !wasOn) saves++; wasOn = on;
        const left = Math.max(0, 120 - Math.floor(t / 1000));
        span.textContent = 'Свободно · ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      },
    });
    R.free.throws = R.free.taps.filter(x => x === 'заброс').length;
    R.free.saves = saves;
    R.free.placesSeen = seen.size;

    await questions();
    finish();
  });
})();
