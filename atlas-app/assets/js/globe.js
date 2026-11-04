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

   ГЛОБУС.
   Наружу: SIZE/CX/CY/R, resizeGlobe, yaw/pitch, rot, renderGlobe, magnetize,
   startEase/startMagnet, globeSpin, globeFocus, nearestPlace, placeAtPoint,
   gloop, window.bootAim / window.bootLand.
   Требует в разметке #globe и #gcanvas; жёсткость пружины берёт из DIAL.magW. */

/* ---- 3D globe on canvas ----
   Размер больше не фиксирован: глобус занимает столько, сколько ему отдала раскладка.
   SIZE/CX/CY/R пересчитываются в resizeGlobe() при каждом изменении экрана. */
let SIZE=353, CX=SIZE/2, CY=SIZE/2, R=SIZE/2;
const cv=document.getElementById('gcanvas'), ctx=cv.getContext('2d'), DPR=Math.min(2,window.devicePixelRatio||1);
function resizeGlobe(){
  const el=document.getElementById('globe'); const d=el.clientWidth;
  if(!d || Math.abs(d-SIZE)<0.5) return;
  SIZE=d; CX=CY=R=d/2;
  cv.width=Math.round(d*DPR); cv.height=Math.round(d*DPR);
  cv.style.width=d+'px'; cv.style.height=d+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  if(window.__globe3d && window.__globe3d.resize) window.__globe3d.resize(d);
}
resizeGlobe();
let yaw=0,pitch=0.30,vYaw=0,vPitch=0,gmode='idle',gTargetPlace=null,gAfter=null,eFy=0,eTy=0,eFp=0,eTp=0,easeStart=0,gLastT=performance.now();
function rot(o){ const cl=Math.cos(o.latR),sl=Math.sin(o.latR); let x=cl*Math.sin(o.lonR),y=sl,z=cl*Math.cos(o.lonR);
  let x1=x*Math.cos(yaw)+z*Math.sin(yaw),z1=-x*Math.sin(yaw)+z*Math.cos(yaw),y1=y;
  let y2=y1*Math.cos(pitch)-z1*Math.sin(pitch),z2=y1*Math.sin(pitch)+z1*Math.cos(pitch); return {x:x1,y:y2,z:z2}; }
/* Сетка широт/долгот снята 2026-08-25 по решению Николая: линии проступали
   на вращении и читались как артефакт, а не как аффорданс. Планета остаётся
   чистой в любом состоянии; прицел при захвате оставлен. */
let globe3dSize=0;
function renderGlobe(){
  ctx.clearRect(0,0,SIZE,SIZE);
  /* модуль three.js грузится отложенно и может появиться уже ПОСЛЕ первой раскладки —
     тогда его рендерер остаётся в стартовом размере. Держим его в синхроне каждый кадр (сравнение дешёвое). */
  if(window.__globe3d && window.__globe3d.resize && globe3dSize!==SIZE){ window.__globe3d.resize(SIZE); globe3dSize=SIZE; }
  if(window.__globe3d) window.__globe3d.setRotation(yaw,pitch);
  const t=performance.now()/1000;
  const liveD=liveDec();
  for(const p of PLACES){ const r=rot(p); if(r.z<=-0.04) continue;
    const x=CX+R*r.x, y=CY-R*r.y, sel=p.id===state.place, live=hasArchive(p,liveD);
    if(sel){ const pr=3.4+0.8*Math.sin(t*3);
      ctx.fillStyle='rgba(246,210,122,0.98)'; ctx.shadowColor='rgba(233,185,73,.95)'; ctx.shadowBlur=15;
      ctx.beginPath(); ctx.arc(x,y,pr,0,6.2832); ctx.fill(); ctx.shadowBlur=0;
      /* Подпись города на шаре снята (решение Николая 2026-08-27): она дублировала
         заголовок над глобусом, где то же место набрано крупно и засечным.
         Выбранный город держит амбер-точка со свечением — этого достаточно. */
    } else {
      /* ⚠️ Город без записей на этой эпохе НЕ РИСУЕТСЯ ВОВСЕ (решение Николая
         2026-09-07: «не нужны серые неактивные точки на карте»). Этим отменяется
         «города гаснут, но остаются на месте — видно, что мир больше выбора»
         (2026-08-25): раньше такая точка светилась в 20% и уменьшалась до 1.2.
         Само правило «время ведёт, места гаснут» в силе — меняется только его
         изображение: на глобусе теперь показано ровно то, что можно послушать. */
      if(!live) continue;
      const lam=Math.max(0, r.x*-0.40+r.y*0.50+r.z*0.77);
      ctx.fillStyle='rgba(255,255,255,'+(0.30+0.6*lam)+')';
      ctx.shadowColor='rgba(255,255,255,.8)'; ctx.shadowBlur=4+3*r.z;
      ctx.beginPath(); ctx.arc(x,y,1.7+0.6*r.z, 0, 6.2832); ctx.fill(); ctx.shadowBlur=0; }
  }
}
function shortRad(to,from){ let d=(to-from)%(2*Math.PI); return ((d+3*Math.PI)%(2*Math.PI))-Math.PI; }
function clampP(v){ return Math.max(-1.3,Math.min(1.3,v)); }
let eDur=640;   /* длительность доворота; заброс просит свою — под время отъезда камеры */
function startEase(yawT,pitchT,after,dur){ eFy=yaw; eTy=yaw+shortRad(yawT,yaw); eFp=pitch; eTp=clampP(pitchT); easeStart=performance.now(); eDur=dur||640; gAfter=after||null; gmode='ease'; }

/* ── магнит: пружина, а не кривая ──────────────────────────────────────
   Раньше доворот к городу был фиксированной кривой на 640 мс: она стартовала
   СВОЕЙ скоростью и обрывала инерцию вращения — отсюда рывок в момент захвата
   (поймано Николаем 2026-08-26). Теперь тот же приём, что у шторок: пружина
   принимает текущую скорость как начальную, поэтому шва между «шар летит» и
   «шар доводится» нет вовсе.
   Критическое демпфирование (ζ=1): магнит не должен проскакивать цель и
   возвращаться — город обязан встать под прицел и остаться там. */
/* жёсткость пружины живёт в DIAL.magW — её крутит лаборатория */
let mTy=0, mTp=0;                /* цель по yaw (уже развёрнутая по кратчайшему пути) и pitch */
function startMagnet(yawT,pitchT,after){
  mTy=yaw+shortRad(yawT,yaw); mTp=clampP(pitchT);
  if(window.__FILM_MODE){ gAfter=after||null; gmode='mag'; return; }
  /* наследуем скорость вращения, но не больше той, с которой пружина ещё
     успевает затормозить — иначе критическая пружина всё-таки перелетит */
  const capY=DIAL.magW*Math.abs(mTy-yaw)/1000, capP=DIAL.magW*Math.abs(mTp-pitch)/1000;
  vYaw=Math.max(-capY,Math.min(capY,vYaw)); vPitch=Math.max(-capP,Math.min(capP,vPitch));
  /* если шар в этот момент ехал ОТ цели, инерция гасится на две трети: иначе он
     сперва уезжает ещё дальше и только потом возвращается, и захват читается
     как заминка. Полностью не гасим — движение пальца должно остаться слышным */
  if(vYaw*(mTy-yaw)<0) vYaw*=0.35;
  if(vPitch*(mTp-pitch)<0) vPitch*=0.35;
  gAfter=after||null; gmode='mag';
}
/* с явной длительностью зовёт только заброс — там доворот обязан совпасть
   по кадру с отъездом камеры, поэтому остаётся кривой */
function magnetize(p,after,dur){ dur ? startEase(-p.lonR,p.latR,after,dur)
                                    : startMagnet(-p.lonR,p.latR,after); }

/* ── заброс: доворот к городу синхронно с отъездом камеры ──────────────
   bootAim отворачивает планету до старта (иначе доворачивать нечего —
   первый заброс уже выставил глобус на цель), bootLand ведёт её обратно
   ровно за время полёта камеры. */
window.bootAim=function(){ const p=placeById(state.place); if(!p)return;
  yaw=-p.lonR-0.85; pitch=clampP(p.latR+0.28); gmode='hold'; };
window.bootLand=function(ms){ const p=placeById(state.place); if(!p)return;
  magnetize(p,null,ms); };
function globeSpin(p){ gTargetPlace=p; gAfter=null; gmode='spin'; }
function globeFocus(p){ if(gmode!=='spin'&&gmode!=='drag') magnetize(p,null); }
/* Ближайшее к прицелу ЖИВОЕ место. Эпоху можно передать явно: без аргумента
   берётся та, что под прицелом ПРЯМО СЕЙЧАС (liveDec — она нужна глобусу,
   чтобы гасить точки во время прокрутки шкалы). ⚠️ Тот, кто собирается ИГРАТЬ
   конкретную эпоху, обязан передать её сам: liveDec читает живой tx, а он
   успевает уехать (refreshDial двигает ленту на каждом playResult), и место
   выбиралось бы для одной эпохи, а игралось в другой — так и открывалось
   отменённое «нет архива» (поймано 2026-09-10). */
function nearestPlace(dec){ const d=dec||liveDec(); let best=null,bz=-2;
  for(const p of PLACES){ if(!hasArchive(p,d)) continue; const z=rot(p).z; if(z>bz){bz=z;best=p;} }
  if(best) return best;
  /* ⚠️ Фолбэк тоже обязан быть живым на d: прежний placeById(state.place)
     возвращал текущее место как есть, то есть мог отдать пустую пару. */
  const cur=placeById(state.place);
  return (hasArchive(cur,d) && cur) || PLACES.find(p=>hasArchive(p,d)) || PLACES[0]; }
/* ⚠️ ГЛАВНОЕ ПРО ПРОИЗВОДИТЕЛЬНОСТЬ СТЕКЛА (2026-08-29).
   Пока поверх главного лежит стеклянная панель, глобус НЕ рисуем вовсе.
   Причина: `backdrop-filter` пересчитывается ровно тогда, когда меняется то,
   что под ним. Глобус же рисовался КАЖДЫЙ кадр и в покое ещё и медленно
   поворачивался (`yaw += 0.00012*dt`) — то есть под каждой стеклянной панелью
   картинка менялась постоянно, и размытие всей её площади считалось заново
   60 раз в секунду. Именно это и дёргалось на телефоне.
   Видимой потери нет: сквозь стекло планета и так размытое пятно, а её
   поворот на 0.0002 рад/кадр под блюром не читается. Заодно перестаёт
   работать three.js — двойная экономия.
   Проверка идёт по DOM, а не по флагу: так её нельзя забыть проставить в
   одной из десяти функций открытия, и глобус не может залипнуть замороженным. */
function gloop(now){ const dt=Math.min(48,now-gLastT); gLastT=now;
  if(document.querySelector('#nowsheet.up, .screen.up, #rowmenu.up, #signin.up')){
    requestAnimationFrame(gloop); return; }
  /* ночная фаза заброса: планета стоит. Рисуем кадр, но физику не двигаем —
     иначе на восходе Земля уже вертится, а по сцене она должна ожить при отдалении. */
  if(window.__bootFreeze){ renderGlobe(); requestAnimationFrame(gloop); return; }
  if(gmode==='idle'){ if(!RM) yaw+=0.00012*dt; }
  else if(gmode==='spin'){
    /* Режим оставлен только как мост: инерция от пальца доживает здесь, а как
       только она гаснет, шар уходит к цели пружиной. При костях сюда попадают
       уже с нулевой скоростью — значит пружина забирает управление сразу, и весь
       полёт ведёт она одна. */
    yaw+=vYaw*dt; pitch=clampP(pitch+vPitch*dt);
    const fr=Math.pow(0.94,dt/16); vYaw*=fr; vPitch*=fr;
    if(Math.hypot(vYaw,vPitch)<0.0016){ if(gTargetPlace) magnetize(gTargetPlace,null); else { const np=nearestPlace(); magnetize(np,()=>selectFromGlobe(np)); } } }
  else if(gmode==='ease'){ const t=Math.min(1,(now-easeStart)/eDur),k=1-Math.pow(1-t,3); yaw=eFy+(eTy-eFy)*k; pitch=eFp+(eTp-eFp)*k;
    if(t>=1){ yaw=eTy; pitch=eTp; gmode='hold'; if(gAfter){const cb=gAfter; gAfter=null; cb();} } }
  else if(gmode==='mag'){
    /* полушаг Эйлера по критически задемпфированной пружине; скорости живут
       в радианах за миллисекунду, как и вся остальная физика глобуса */
    const h=dt/1000, w=window.__FILM_MODE ? G_FILM.spring : DIAL.magW;
    vYaw   += ((mTy-yaw)*w*w/1000 - 2*w*vYaw)*h;
    vPitch += ((mTp-pitch)*w*w/1000 - 2*w*vPitch)*h;
    yaw+=vYaw*dt; pitch=clampP(pitch+vPitch*dt);
    /* доехали, когда и осталось мало, и скорость почти нулевая */
    if(Math.abs(mTy-yaw)<0.0015 && Math.abs(mTp-pitch)<0.0015 && Math.hypot(vYaw,vPitch)<0.00012){
      yaw=mTy; pitch=mTp; vYaw=vPitch=0; gmode='hold';
      if(gAfter){const cb=gAfter; gAfter=null; cb();} } }
  /* ЖИВОЙ ЗАГОЛОВОК (штатно с 2026-09-19, флаг ?hints=1 снят решением Николая):
     пока шар ведёт палец или инерция, заголовок показывает город под прицелом
     (previewPlace в скрипте продукта) — подписей на шаре нет, и без этого непонятно,
     куда едешь. Полёт к цели (заброс, тап) не трогаем: там город уже известен. */
  if((gmode==='drag'&&gMoved) || (gmode==='spin'&&!gTargetPlace)) previewPlace(nearestPlace());
  renderGlobe(); requestAnimationFrame(gloop); }
/* ⚠️ Первый кадр — только после того, как продукт дочитан. Иначе отрисовка,
   вставленная браузером между <script src>, стартует цикл на полусобранном
   продукте, а его ветки уходят в selectFromGlobe → haptic/playResult.
   В исходном одном <script> эта строка тоже отрабатывала раньше конца файла,
   но первый КАДР приходил после него — затвор возвращает ровно это. */
window.__core.on(function(){ requestAnimationFrame(gloop); });
const globeEl=document.getElementById('globe');
let gDrag=false,gMoved=false,gx=0,gy=0,gt=0,gAmt=0,gDownX=0,gDownY=0;
const pX=e=>(e.touches&&e.touches[0])?e.touches[0].clientX:e.clientX;
const pY=e=>(e.touches&&e.touches[0])?e.touches[0].clientY:e.clientY;
/* Чувствительность вращения. 0.011 → 0.0072 («крутить туже», палец уводил
   планету слишком далеко) → 0.0060 (2026-08-27, «чуть поменьше, чтобы пальцами
   было удобнее»): тот же жест поворачивает шар на 17% меньше, чем вчера, и
   почти вдвое меньше исходного. */
const G_GAIN=0.0060;
/* Порог, после которого жест считается вращением, а не тапом. Был 1 px — палец
   всегда дрожит на пару пикселей, и тап никогда не был тапом. */
const G_TAP_SLOP=6;
/* ?film: скорость берём не из последнего шумного события, а из короткого хвоста
   жеста. Горизонт прогноза выбирает город там, куда палец уже направил шар;
   само движение до цели остаётся одной пружиной с непрерывной скоростью. */
const G_FILM={ velocityWindowMs:100, predictionMs:260, spring:7.2 };
window.__ATLAS_FILM_GLOBE=G_FILM;
let gSamples=[];
function filmSample(x,y,now){
  gSamples.push({x:x,y:y,t:now});
  const edge=now-G_FILM.velocityWindowMs;
  while(gSamples.length>2 && gSamples[1].t<edge) gSamples.shift();
}
function filmVelocity(now){
  filmSample(gx,gy,now);
  const first=gSamples[0], last=gSamples[gSamples.length-1], dt=Math.max(16,last.t-first.t);
  return { yaw:(last.x-first.x)*G_GAIN/dt, pitch:(last.y-first.y)*G_GAIN/dt };
}
function nearestPlaceAt(yawAt,pitchAt){
  const saveYaw=yaw, savePitch=pitch;
  yaw=yawAt; pitch=clampP(pitchAt);
  const place=nearestPlace();
  yaw=saveYaw; pitch=savePitch;
  return place;
}
/* Радиус попадания по точке города: сама точка ~2 px, но целятся пальцем —
   держим зону не меньше половины тач-минимума (44/2) и ~9% диаметра шара. */
const gTapR=()=>Math.max(22, SIZE*0.09);
/* Город под пальцем: ближайшая ЖИВАЯ точка на видимой стороне в пределах зоны */
function placeAtPoint(cx,cy){
  const r=document.getElementById('globe').getBoundingClientRect(), d=liveDec();
  let best=null, bd=1e9;
  for(const p of PLACES){ if(!hasArchive(p,d)) continue;
    const q=rot(p); if(q.z<=0.02) continue;                    /* обратная сторона не кликается */
    const x=r.left+CX+R*q.x, y=r.top+CY-R*q.y, dd=Math.hypot(cx-x,cy-y);
    if(dd<bd){ bd=dd; best=p; } }
  return (best && bd<=gTapR()) ? best : null;
}
function gdown(e){ gDrag=true; gMoved=false; gAmt=0; vYaw=0; vPitch=0; gTargetPlace=null; gmode='drag';
  gx=pX(e); gy=pY(e); gDownX=gx; gDownY=gy; gt=performance.now();
  if(window.__FILM_MODE) gSamples=[{x:gx,y:gy,t:gt}];
  document.getElementById('globe').classList.add('grabbing'); e.preventDefault(); }
function gmoveH(e){ if(!gDrag)return; const x=pX(e),y=pY(e),now=performance.now(),dx=x-gx,dy=y-gy,dt=Math.max(8,now-gt);
  /* тянем вправо — планета едет вправо. Знак при yaw был обратным (2026-08-23):
     r.x растёт вместе с yaw, поэтому вычитание уводило шар против пальца.
     Вертикаль не трогаем — там направление уже совпадало. */
  yaw+=dx*G_GAIN; pitch=clampP(pitch+dy*G_GAIN); vYaw=dx*G_GAIN/dt; vPitch=dy*G_GAIN/dt; gx=x; gy=y; gt=now;
  if(window.__FILM_MODE) filmSample(x,y,now);
  gAmt+=Math.abs(dx)+Math.abs(dy); if(gAmt>G_TAP_SLOP) gMoved=true;
  e.preventDefault&&e.preventDefault(); }
function gup(){ if(!gDrag)return; gDrag=false; document.getElementById('globe').classList.remove('grabbing');
  if(gMoved){
    if(window.__FILM_MODE){
      const velocity=filmVelocity(performance.now());
      vYaw=velocity.yaw; vPitch=velocity.pitch;
      const np=nearestPlaceAt(yaw+vYaw*G_FILM.predictionMs,pitch+vPitch*G_FILM.predictionMs);
      gTargetPlace=np; previewPlace(np); magnetize(np,()=>selectFromGlobe(np));
    } else gmode='spin';
    return;
  }
  /* тап: сначала пробуем попасть по городу, и только если промах — прежнее
     поведение «ближайший к прицелу» */
  const hit=placeAtPoint(gDownX,gDownY), np=hit||nearestPlace();
  gTargetPlace=np; magnetize(np,()=>selectFromGlobe(np)); }
/* ⚠️ Через затвор: gup зовёт magnetize с колбэком selectFromGlobe, а тот —
   haptic и playResult из скрипта продукта. См. «ЗАТВОР ЯДРА» в catalog.js. */
window.__core.on(function(){
globeEl.addEventListener('mousedown',gdown); globeEl.addEventListener('touchstart',gdown,{passive:false});
document.addEventListener('mousemove',gmoveH); document.addEventListener('touchmove',gmoveH,{passive:false});
document.addEventListener('mouseup',gup); document.addEventListener('touchend',gup);
});
function selectFromGlobe(p){ haptic(14);   /* город встал под прицел */
  /* Время не трогаем: магнит цепляется только за живые города, поэтому текущая
     эпоха выбранному городу заведомо подходит. nearestDec оставлен страховкой. */
  const want=DEC[clampIdx(Math.round(idxFromTx(tx)))];
  lastPlace=p.id; playResult(p, nearestDec(p,want), true); }
