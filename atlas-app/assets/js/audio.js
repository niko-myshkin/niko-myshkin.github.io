/* ATLAS — ядро продукта. Вынесено из prototype-graphite-v4.html 2026-09-09
   ПОСТРОЧНО, без единой правки значений: это перенос кода, а не рефакторинг.

   Файлы — обычные скрипты (не module): они делят один верхний лексический
   контекст, поэтому продукт продолжает видеть их имена так же, как когда всё
   лежало в одном <script>. Порядок обязателен:
       catalog.js → dial.js → globe.js → audio.js → скрипт продукта,
   и ПОСЛЕДНЕЙ строкой скрипта продукта — window.__core.go().
   ⚠️ Без go() не запустится цикл кадров глобуса и не навесятся слушатели
   глобуса, шкалы и разблокировки звука: см. блок «ЗАТВОР ЯДРА» в catalog.js.
   ⚠️ dial.js СТРОГО перед globe.js: цикл кадров глобуса читает DIAL.magW и
   позицию шкалы, а кадр может успеть выпасть между двумя <script>.
   Ядро не должно ссылаться на код продукта В МОМЕНТ ЗАГРУЗКИ (только из
   функций, вызываемых позже) — иначе ломается порядок инициализации.

   ⚠️ Подключать С ВЕРСИЕЙ (?v=), и она обязана совпадать с window.__DATA_VER:
   ключ карты аудио — «Артист|Трек», то есть каталог и карта обязаны меняться
   ОДНОВРЕМЕННО (грабля 2026-09-07: кеш отдал вчерашнюю карту к новому
   каталогу, и 38 треков молча стали немыми).

   ЗВУК — движок.
   Наружу: AUDIO_MAP, audioFor, au, unlockAudio, MUSICKIT_TOKEN и подключение
   Apple Music, curEntry, loadAudio, nextInPair, tryPlay, autoBlocked, MUTED.
   ⚠️ Не самостоятелен: зовёт наружу playResult / startPlay / stopPlay /
   drawProg / state / ARTIST_PICS. Рисование прогресса, иконок play и перемотка
   остались в продукте — они прибиты к id разметки телефона. */

/* ── ЗВУК (2026-08-29) ───────────────────────────────────────────────
   Источник — 30-секундные превью Apple (iTunes Search API), разрезолвленные
   ОФЛАЙН скриптом tools/resolve-itunes.mjs и вшитые в AUDIO_MAP.
   Почему не искать в рантайме: лимит ~20 запросов/мин (заброс упёрся бы),
   сеть на каждый бросок костей и — главное — фаззи-матч молча подставляет
   ЧУЖОЙ трек («Yala» находится как «YALA (Slowed)» неизвестных диджеев).
   Это принцип №10: ничего не выдумывать. Резолв сверен руками.
   ⚠️ АВТОПЛЕЙ. Ни один браузер не даёт заиграть со звуком без касания, iOS
   Safari жёстче всех. Поэтому: пробуем play() сразу (где разрешат — заиграет),
   а при отказе ждём ПЕРВОГО ЛЮБОГО касания экрана — тапа, свайпа, кручения
   глобуса. Кнопки «включить звук» нет намеренно: принцип №2, самоочевидность
   через аффорданс, а не через подпись.
   ⚠️ Превью 30 с. Кончилось — идём на следующий трек той же пары (решение
   Николая): место и эпоха держатся, три трека ходят по кругу. */
const AUDIO_MAP = {};   /* заполняется из assets/data/audio-map.json — см. fillFromJson ниже */
const audioFor = e => (e && AUDIO_MAP[e.a+'|'+e.t]) || null;

/* ── ДАННЫЕ ЛЕЖАТ РЯДОМ, А НЕ ВНУТРИ ФАЙЛА (2026-09-04) ──────────────
   Карта аудио (236 КБ) и портреты (39 КБ) вынесены в assets/data/*.json:
   вдвоём они весили треть прототипа, из-за чего файл распух до 808 КБ и
   любое чтение инструментом тащило простыню ссылок целиком. Стало 513 КБ.
   Прототип перестал быть ОДНИМ файлом, но остался самодостаточным: данные
   лежат рядом и уезжают наружу тем же deploy/build.sh.
   ⚠️ Нужен http:// — с file:// fetch запрещён CORS. Ничего этим не теряем:
   по file:// прототип и так неполный (текстура Земли и SVG-маски режутся
   тем же CORS), смотреть его положено через превью-сервер `proto`.
   ⚠️ Заполняем Object.assign, а НЕ присваиваем: обе карты — const, и на них
   уже держатся audioFor() и setBanner(); подмена ссылки их бы не задела. */
/* Карты приходят с диска, а не из файла, поэтому первый трек может встать
   раньше них. Тогда дозаряжаем его тем же путём, каким его рисует продукт.
   ⚠️ Ждём конца заставки: во время неё playResult нарушил бы хореографию —
   музыка обязана начаться на посадке планеты, а не посреди полёта.
   ⚠️ Заполняем Object.assign, а НЕ присваиваем: обе карты — const, и на них
   уже держатся audioFor() и setBanner(); подмена ссылки их бы не задела. */
Promise.all(window.__DATA || []).then(function(res){
  if(res[0]) Object.assign(AUDIO_MAP,  res[0]);
  if(res[1]) Object.assign(ARTIST_PICS, res[1]);
  let tries=0;
  /* ⚠️ Сами карты заполняем СРАЗУ — они ни на что из продукта не ссылаются и
     чем раньше приедут, тем лучше. А вот дозарядку откладываем затвором: она
     зовёт playResult и stopPlay из скрипта продукта, а .then может прийти
     раньше него. См. «ЗАТВОР ЯДРА» в catalog.js. */
  window.__core.on(function adopt(){
    const app=document.querySelector('.app');
    if(app && app.classList.contains('booting') && ++tries<50){ setTimeout(adopt,120); return; }
    const p = state.place ? placeById(state.place) : null;
    if(!p) return;                       /* ещё ничего не играло — данные уже на месте */
    const e = curEntry();
    if(!e || au.src || !audioFor(e)) return;   /* звук уже заряжен или его и не будет */
    const wasPlaying = state.playing;
    playResult(p, state.dec, false, state.gi);  /* push=false — вторая запись в историю не нужна */
    if(!wasPlaying) stopPlay();                 /* пауза от человека догрузкой не отменяется */
  });
});
const au = new Audio();
au.preload='none'; au.playsInline=true; au.setAttribute('playsinline','');
/* ⚠️ Беззвучный прогон: `?mute=1` глушит плеер, всё остальное работает как
   обычно — интерфейс, прогресс, смена треков. Нужен, чтобы гонять прототип
   фоном под свою музыку и не слушать превью по 30 секунд подряд
   (просьба Николая 2026-09-04).
   Глушим САМ объект: аудио здесь не элемент разметки, а `new Audio()`, и
   `document.querySelectorAll('audio')` его не находит — на этом уже
   обжигались при отладке автоплея 2026-08-30.
   `muted` — свойство объекта, при смене `src` оно не сбрасывается,
   поэтому ставится один раз здесь. */
const MUTED = location.search.indexOf('mute') !== -1;
if (MUTED) { au.muted = true; au.volume = 0; }
let audioOK=false;          /* элемент разблокирован жестом */
let curDur=DUR;             /* длительность текущего источника; без звука — макетная */

/* Разблокировка: первый же контакт с экраном. Слушаем на этапе перехвата и
   не глотаем событие — оно продолжает работать как обычный тап по интерфейсу. */
function unlockAudio(){
  /* ⚠️ Здесь больше НЕ стартует звук (2026-09-09). Раньше первое касание экрана
     вступало само — это была страховка от заблокированного автоплея; теперь
     автоплея нет вовсе, и играть по касанию глобуса значило бы обманывать: на
     кнопке ▶, а музыка идёт. Жест только помечает элемент разблокированным,
     чтобы последующий play() прошёл программно. */
  if(audioOK) return;
  if(au.src) audioOK=true;
}
window.__core.on(function(){
  ['pointerdown','touchstart','keydown'].forEach(ev=>
    document.addEventListener(ev, unlockAudio, {capture:true, passive:true}));
});

/* ── APPLE MUSIC — НАДСТРОЙКА, А НЕ ЗАМЕНА (2026-08-29) ──────────────
   Превью остаются работой по умолчанию: продукт обязан звучать сразу, без
   логина (принцип №1 — заброс без выбора). Кто подключил Apple Music и имеет
   подписку, получает ПОЛНЫЕ треки; всем остальным ничего не меняется.
   ⚠️ Библиотека грузится ТОЛЬКО по тапу «подключить» — до этого ни одного
   внешнего запроса, самодостаточность файла на обычном пути не тронута.
   ⚠️ Токен разработчика подписывается ключом Apple Developer ($99/год) и
   вшивается ниже между маркерами; без него строка в профиле честно говорит
   «недоступно» и ничего не пробует. Живёт до полугода — истёк, перевыпустить
   скриптом tools/make-musickit-token.mjs и вшить tools/inject-musickit-token.mjs. */
const MUSICKIT_TOKEN = /*<mk-token>*/""/*</mk-token>*/;
const MK_SRC='https://js-cdn.music.apple.com/musickit/v3/musickit.js';
let mk=null;                 /* экземпляр MusicKit */
let mkOn=false;              /* полные треки идут через него */
let mkStatus='off';          /* off | loading | nosub | on | error | notoken */

function mkAvailable(){ return !!MUSICKIT_TOKEN; }
function appleId(e){ const m=audioFor(e); return m && m.id ? String(m.id) : null; }

function loadMusicKitLib(){
  if(window.MusicKit) return Promise.resolve();
  return new Promise((res,rej)=>{
    const t=document.createElement('script');
    t.src=MK_SRC; t.async=true;
    t.onload=()=>res(); t.onerror=()=>rej(new Error('musickit not loaded'));
    document.head.appendChild(t);
  });
}
/* ⚠️ Вход открывается отдельным окном Apple ID. Если его заблокировал
   браузер или человек его закрыл, обещание authorize() не разрешается НИКОГДА,
   и строка вечно показывает «Connecting…» — то есть врёт. Поэтому вся попытка
   идёт наперегонки с таймаутом, а повторный тап во время попытки игнорируется. */
const MK_TIMEOUT=45000;
const mkRace=p=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('mk-timeout')),MK_TIMEOUT))]);
async function connectAppleMusic(){
  if(!mkAvailable()){ mkStatus='notoken'; refreshProfileIfOpen(); return; }
  if(mkStatus==='loading') return;          /* уже пробуем — второй тап не плодит попыток */
  if(mkOn){ disconnectAppleMusic(); return; }
  mkStatus='loading'; refreshProfileIfOpen();
  try{
    await mkRace(loadMusicKitLib());
    mk = await mkRace(MusicKit.configure({ developerToken: MUSICKIT_TOKEN,
      app:{ name:'ATLAS', build:'v4' } }));
    await mkRace(mk.authorize());
    /* Подписки может не быть — тогда полные треки не проиграются. Честно
       откатываемся на превью и говорим об этом, а не притворяемся. */
    const can = mk.subscribeStatus ? !!mk.subscribeStatus.active : true;
    if(!can){ mkStatus='nosub'; mkOn=false; }
    else{
      mkOn=true; mkStatus='on';
      mk.addEventListener('playbackTimeDidChange', mkTime);
      mk.addEventListener('playbackStateDidChange', mkState);
      const e=curEntry(); if(e) { loadAudio(e); startPlay(); }
    }
  }catch(err){ const m=(err&&err.message)||'';
    /* отказ во входе и закрытое окно — это не поломка, а «передумал»:
       возвращаемся в исходное состояние, а не пугаем ошибкой */
    mkStatus = (/authoriz|cancel|mk-timeout/i.test(m)) ? 'off' : 'error';
    mkOn=false; }
  refreshProfileIfOpen();
}
function disconnectAppleMusic(){
  try{ if(mk){ mk.stop(); mk.unauthorize(); } }catch(_){}
  mkOn=false; mkStatus='off';
  const e=curEntry(); if(e){ loadAudio(e); startPlay(); }
  refreshProfileIfOpen();
}
/* текущая находка — нужна и движку, и переподключению */
function curEntry(){ const p=state.place?placeById(state.place):null;
  const arr=p?(p.eras[state.dec]||[]):[]; return arr[state.gi]||null; }

function mkTime(ev){ if(seeking||!mkOn) return;
  const d=ev&&ev.currentPlaybackDuration, t=ev&&ev.currentPlaybackTime;
  if(!d) return; curDur=d; prog=Math.max(0,Math.min(100,t/d*100)); drawProg(); }
function mkState(ev){ if(!mkOn) return;
  /* 10 = завершено: тот же путь, что у превью — следующий трек ЭТОЙ ЖЕ пары */
  if(ev && ev.state===10) nextInPair(); }

function loadAudio(e){
  /* ⚠️ СТРАХОВКА ОТ НЕМОГО ПЛЕЕРА: что бы ни оставило громкость на нуле, каждый
     новый трек заряжается в полную. Продукт, показывающий «играет» при тишине, —
     тот же класс вранья, что чинили 2026-08-30 с автоплеем. */
  if(!MUTED && au.volume!==1) au.volume=1;
  const m=audioFor(e);
  clearInterval(progTimer); progTimer=null;
  prog=0;
  if(mkOn && appleId(e)){ au.pause(); au.removeAttribute('src'); return true; }
  if(!m || !m.preview){ au.pause(); au.removeAttribute('src'); curDur=DUR; return false; }
  au.src=m.preview; au.currentTime=0; curDur=30;
  return true;
}
/* следующий трек той же пары — общий путь для превью и полного трека */
/* Трек доиграл сам. Пара проходится ОДИН раз целиком, дальше — новый заброс.
   Считаем именно доигранные до конца треки: кнопка «дальше» сюда не приходит,
   она живёт в nextTrack, поэтому ручное листание счётчик не накручивает.
   Вход в пару может быть с любого трека (кости берут случайный) — счётчик
   от индекса не зависит, поэтому круг всегда получается ровно в длину пары. */
let pairEnded=0;
function nextInPair(){
  /* включено перемешивание находок — продолжаем по ним, как и кнопка «дальше» */
  if(state.shuffleLiked){ const r=randomLiked(); if(r){ playLikedTrack(r.pid,r.dec,r.gi); return; } }
  const p=state.place?placeById(state.place):null, arr=p?(p.eras[state.dec]||[]):[];
  pairEnded++;
  if(arr.length>1 && pairEnded<arr.length){ playResult(p,state.dec,true,(state.gi+1)%arr.length); return; }
  shuffle();                       /* круг пройден — бросок, как костями */
}
/* Автоплей запрещён до касания — и это НЕ то же самое, что пауза от человека.
   Различать обязательно: интерфейс не должен показывать «играет», когда звука
   нет (поймано Николаем 2026-08-30: «не проигрывается сразу как загружается»).
   Отказ → честная ▶ в баре и флаг, по которому первое касание вступит. */
let autoBlocked=false;
/* ⚠️ ФЕЙДА БОЛЬШЕ НЕТ (снят 2026-09-09, решение Николая). Первый трек нарастал
   из нуля за 1.6 с — это читалось как «поймали», пока музыка вступала сама на
   посадке планеты; с переходом на ручной старт (там же) нажатие play стало
   означать медленный подъём вместо звука, и фейд отменён. Вместе с ним ушли
   `TUNE.fade`, `tuneIn()` и `tuneKill`. История приёма — в STATUS за 2026-09-08. */
/* Сводка по звуку для панели ?diag=1 — чтобы «нет звука» диагностировалось
   скриншотом с телефона, а не переписыванием кода. Три причины немоты
   различаются здесь однозначно: карта не загрузилась (по file:// её режет CORS),
   браузер не дал автоплей (ждём касания) или громкость осталась на нуле. */
window.__audio=function(){
  return {map:Object.keys(AUDIO_MAP||{}).length, src:!!au.src, muted:au.muted,
    vol:+au.volume.toFixed(2), paused:au.paused, blocked:autoBlocked, mk:mkOn};
};
function tryPlay(){
  if(!au.src) return;
  const p=au.play();
  if(p && p.catch) p.catch(()=>{
    autoBlocked=true; state.playing=false; setPlayIcon('▶');
  });
}
au.addEventListener('loadedmetadata',()=>{ if(au.duration && isFinite(au.duration)) curDur=au.duration; drawProg(); });
au.addEventListener('timeupdate',()=>{ if(seeking||!au.duration) return;
  prog=Math.max(0,Math.min(100,au.currentTime/au.duration*100)); drawProg(); });
/* превью кончилось → следующий трек этой же пары, по кругу */
au.addEventListener('ended', nextInPair);
au.addEventListener('error',()=>{ /* ссылка протухла — не молчим в интерфейсе, крутим макетный прогресс */
  au.removeAttribute('src'); curDur=DUR; if(state.playing) startPlay(); });

