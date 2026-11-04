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

   ШКАЛА ЛЕТ — физика и рендер барабана.
   Наружу: DIAL (window.DIAL), dialMetrics, tx, txForIdx/idxFromTx/clampIdx,
   curveReel, applyTx, refreshDial, dmomentum, dland, clampTx.
   Требует в разметке #reel и #dialWrap; ячейки годов создаёт сам из DEC. */

/* ---- dial ----
   [F] Frame 378: ячейка года 70 + gap 24.328 → шаг 94.328; активная ячейка расширяется
   до слота 135.7711, поэтому центр текущей = i*шаг + ячейка/2 + (слот−ячейка)/2.
   Все размеры теперь в единицах экрана: пересчитываются в dialMetrics(). */
const FW=434;
let YRW=75, GAP=24, STEP=YRW+GAP, EXTRA=146-YRW, WRAPW=FW;   /* ячейка и слот подросли 2026-08-23 */
function dialMetrics(){
  /* берём ту же единицу, что применил CSS (--u), иначе физика считает в одних размерах,
     а ячейки нарисованы в других — активный год встаёт мимо центра */
  const u=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u'))||1;
  /* EXTRA = 0: активная ячейка больше не шире прочих, шаг ленты равномерный.
     Переменная оставлена, потому что от неё считаются txForIdx/idxFromTx — так
     формулы остаются прежними, а не переписываются под частный случай. */
  /* Ширина ячейки 126 и промежуток 30 (2026-09-04, просьба Николая «чуть больше
     расстояние между годами»). Причина тесноты была не только в промежутке:
     полная запись «1970s» занимает ~121 единицу, то есть была ШИРЕ прежней
     ячейки 110 — надпись торчала за её границы, и на зазор оставалось 12.
     Теперь ячейка вмещает глиф целиком, а шаг 156 против прежних 134.
     ⚠️ Те же два числа стоят в CSS (.yr width и .reel gap) и обязаны совпадать:
     физика считает шаг здесь, а рисует его раскладка — разъедутся, и активный
     год встанет мимо центра (уже ловили это 2026-08-26 на округлении). */
  YRW=126*u; GAP=30*u; STEP=YRW+GAP; EXTRA=0;
  WRAPW=document.getElementById('dialWrap').clientWidth||FW*u;
}
let tx=0,vel=0,dragging=false,dragMoved=false,lastX=0,lastT=0,raf=null,lastTickIdx=null;
const reel=document.getElementById('reel');
DEC.forEach((d,i)=>{ const el=document.createElement('div'); el.className='yr'; el.id='yr-'+i;
  el.textContent=decShort(d); reel.appendChild(el); });
const wrapW=()=>WRAPW;
const txForIdx=i=> wrapW()/2-(i*STEP+YRW/2+EXTRA/2);
const idxFromTx=t=> (wrapW()/2-t-YRW/2-EXTRA/2)/STEP;
const clampIdx=i=> Math.max(0,Math.min(DEC.length-1,i));
/* ⚠️ ВРЕМЯ — ВЕДУЩАЯ ОСЬ (решение Николая 2026-08-25, отменяет ограничение шкалы
   от того же дня). Шкала ходит по ВСЕМ эпохам всегда: «отталкиваемся от времени,
   а не от городов — гаснуть могут они, а не время». Поэтому здесь нет ни списка
   разрешённых эпох, ни привязки к выбранному городу. Если на новой эпохе у
   текущего города пусто, меняется ГОРОД (см. конец dmomentum), а не шкала. */
/* Набор доступных эпох меняется при смене ГОРОДА, а не при прокрутке шкалы,
   поэтому гашение годов надо пересчитывать и там — иначе после переезда в
   другой город на шкале висит подсветка от предыдущего. */
function refreshDial(){ try{
    /* Шкала обязана показывать ту эпоху, которая играет. Штатные пути её и так
       двигают (инерция, кости, выбор города), но playResult можно вызвать и
       напрямую — тогда шкала оставалась на прежнем годе и врала. Пока палец на
       шкале не лезем: там ведёт пользователь. */
    if(!dragging && state.dec){ const want=DEC.indexOf(state.dec);
      if(want>=0 && Math.round(idxFromTx(tx))!==want){ tx=txForIdx(want); applyTx(tx,true); } }
  }catch(_){} }
/* ── Дуга шкалы: барабан iOS, положенный набок ────────────────────────
   Цифры не просто едут — они уходят по дуге вглубь, сжимаясь к краям и
   уменьшаясь (просьба Николая 2026-08-27, референс — Set Timer в iOS).
   Физика НЕ трогается: она по-прежнему считает ленту линейно, а здесь
   линейная позиция проецируется на цилиндр — x' = R·sin(θ), масштаб = cos(θ).
   Поэтому шаг между цифрами сам сжимается к краям, как на настоящем барабане.
   Позиции берём формулой, а не из DOM: читать offsetLeft у десяти ячеек на
   каждом кадре — это layout thrashing, а тут та же арифметика, что в txForIdx. */
/* Настройки шкалы одним местом — как window.BOOT у заброса. Значения откручены
   Николаем в 03_design/dial-lab-live.html (2026-08-27): шкала стала заметно
   спокойнее — палец ведёт ленту вчетверо мягче, инерция гаснет быстрее,
   перемотка к слоту вдвое длиннее и идёт кривой iOS-шторки. */
const DIAL = {
  /* ⚠️ Поднято 0.45 → 0.70 и 0.855 → 0.88 (2026-09-07: «лента слишком туго крутится
     на телефоне, сложновато переключать»). Причина мерилась, а не угадывалась: снап
     уходит на соседнюю эпоху, когда лента прошла полшага — 78 px из 156. При sens
     0.45 это требовало провести пальцем 173 px, то есть почти полэкрана, а короткий
     свайп 70 px давал всего 60 px хода вместе с инерцией и откатывался назад.
     При 0.70/0.88 тот же свайп даёт ~103 px и эпоха меняется. */
  sens:   0.70,   /* чувствительность драга: доля хода ленты на пиксель пальца */
  decay:  0.88,   /* затухание инерции за кадр: меньше — раньше встаёт */
  stop:   0.03,   /* порог остановки инерции */
  snapMs: 1100,   /* перемотка к слоту, в том числе после костей */
  /* ⚠️ Кривая iOS-шторки. Её меняли 2026-08-27 на плавный вход (.42,0,.12,1)
     из-за рывка в начале хода; на барабане Николай вернул шторочную —
     с новой чувствительностью (.45 против .75) резкого входа больше нет. */
  snapEase: 'cubic-bezier(.32,.72,0,1)',
  playMs: 400,    /* когда после приземления шкалы стартует трек — отдельно от
                     длительности перемотки, иначе музыка ждала бы целую секунду */
  /* Полёт планеты при костях ведёт ПРУЖИНА магнита — она и есть всё движение.
     ⚠️ Фаза «раскрутки» (spin/ramp/spinDecay) удалена 2026-08-27: замер показал,
     что она не работала никогда. Скорость стартовала с нуля, то есть заведомо
     ниже порога передачи, и магнит забирал шар первым же кадром. Попытка не
     отдавать шар до конца разгона сделала хуже — движение стало двугорбым:
     разгон, затухание, а потом пружина разгоняла заново.
     Пружина критически задемпфирована, поэтому одногорбая и плавная по природе:
     трогается с нуля, разгоняется, гасится у цели и не проскакивает её. */
  magW:   9.6,    /* жёсткость пружины, рад/с: МЕНЬШЕ — дольше и мягче полёт.
                     ⚠️ Ведёт ТРОИХ разом: планету к городу, посадку ленты лет и
                     бросок знака (у него сверху свой множитель ORB.wMul).
                     9.6 откручено Николаем в orb-lab-live.html 2026-09-05 —
                     этим отменён максимум 12 от 2026-09-04. */
  R:      0.76,   /* радиус барабана в долях ширины кадра: больше — положе дуга */
  dim:    4.0,    /* затухание по дуге: края заметно бледнее */
  end:    1.40,   /* за этим углом год ушёл за горизонт и не рисуется.
                     ⚠️ Сужать его под полную запись года бесполезно (проверено
                     2026-09-04 на 1.18): дальние годы гасит МАСКА по кромке
                     барабана, и она срабатывает раньше углового горизонта. */
  /* Разгорание: год наливается амбером и свечением ПО МЕРЕ ЗАХОДА ПОД КАПСУЛУ,
     а не по флагу «стал активным». Раньше цвет включался скачком, когда цифра
     была ещё сбоку (решение Николая 2026-08-27). */
  heat:   4.00,   /* резкость нарастания: больше — загорается ближе к центру */
  glow:   17,     /* радиус свечения в максимуме, px */
  engrave: 1.30,  /* резкость, с которой свет пробивается сквозь выбитые точки:
                     больше — загорается позже и ближе к центру */
  swell:  0,      /* рост в слоте СНЯТ решением Николая 2026-09-04: год не должен
                     увеличиваться при выборе. Место в центре ему больше не нужно —
                     ячейки равны, а активный обозначен положением, а не размером */
};
const CURVE_MIN = .42;   /* мельче этого не сжимаем: дот-матрица рассыпается */
function curveReel(t){
  const ci = clampIdx(Math.round(idxFromTx(t))), half = wrapW()/2;
  const u = YRW/75;                                  /* та же единица, что в dialMetrics */
  const R = wrapW()*DIAL.R;
  for(let i=0;i<reel.children.length;i++){
    /* центр ячейки внутри ленты: активная шире на EXTRA, поэтому всё, что
       правее неё, сдвинуто на эту добавку — та же логика, что в txForIdx */
    const c = i*STEP + YRW/2 + (i>ci?EXTRA:0) + (i===ci?EXTRA/2:0);
    const dx = t + c - half;
    const th = dx/R;
    const el = reel.children[i];
    /* ⚠️ За горизонтом год НЕ рисуем вовсе. Раньше угол просто зажимался, и все
       дальние ячейки вставали в одну точку друг на друга — слева получалась каша
       из наложенных цифр. На барабане их в этот момент физически не видно. */
    if(Math.abs(th) > DIAL.end){ el.style.opacity = 0; el.style.transform = 'scale(.4)'; continue; }
    /* Разгорание: насколько год зашёл под капсулу. 0 — цифра целиком снаружи,
       1 — стоит ровно в слоте. Считаем по РАССТОЯНИЮ, а не по индексу: год
       наливается амбером и свечением плавно, пока въезжает, и так же плавно
       гаснет, выезжая. Никаких флагов и переключений. */
    const reach = (146*u)/2 + YRW/2;             /* полуслот + полуячейка */
    const heat = Math.pow(Math.max(0, 1 - Math.abs(dx)/reach), DIAL.heat);
    /* Ячейку СНАЧАЛА переносим в центр вращения (-dx), там поворачиваем и выносим
       на радиус. Позицию и уменьшение считает уже перспектива, а не мы: поэтому
       глифы честно искажаются, а не просто мельчают. translateZ(-R) на ленте
       возвращает активную ячейку (θ=0) в плоскость экрана. Последним идёт рост
       в слоте — раньше это был скачок кегля 32→42. */
    el.style.transform =
      'translateX('+(-dx).toFixed(2)+'px) rotateY('+th.toFixed(4)+'rad) translateZ('+R.toFixed(1)+'px)'
      + ' scale('+(1 + DIAL.swell*heat).toFixed(3)+')';
    /* Края не просто мельче — они и бледнее: на барабане они отвёрнуты от света.
       Маска гасит у самой кромки кадра, а это затухание идёт по всей дуге. */
    el.style.opacity = Math.pow(Math.max(0,Math.cos(th)), DIAL.dim).toFixed(3);
    /* ── ПОКОЙ СЕРЫЙ, СВЕТ ПРИХОДИТ ИЗНУТРИ ─────────────────────────
       ⚠️ Выбитые точки (глиф темнее тела цилиндра, блик по нижней кромке)
       прожили один заход и отменены Николаем: «плохо видно годы, которые не
       загорелись». Он прав — выемка на тёмном барабане читается только
       кромкой, а её съедает затухание по дуге, и соседние годы пропадали.
       Теперь год в покое набран `color/text-dim` — тот же приглушённый серый,
       которым в продукте набраны вторые строки, — и по мере захода в центр
       разгорается изнутри до `color/accent` с ореолом в два слоя.
       ⚠️ Рост в слоте не возвращается: не нравилось именно увеличение. */
    const lit = Math.pow(heat, DIAL.engrave);
    /* #B3B3B3 → #EAB949 покомпонентно: rgba() не умеет альфу от токена */
    el.style.color = 'rgb('
      + Math.round(179 + (234-179)*lit) + ','
      + Math.round(179 + (185-179)*lit) + ','
      + Math.round(179 + ( 73-179)*lit) + ')';
    el.style.textShadow = lit > .02
      ? '0 0 ' + (DIAL.glow*lit*u).toFixed(1) + 'px rgba(234,185,73,' + (.85*lit).toFixed(2) + ')'
        + ', 0 0 ' + (DIAL.glow*2.6*lit*u).toFixed(1) + 'px rgba(234,185,73,' + (.30*lit).toFixed(2) + ')'
      : 'none';
  }
}
/* Пока лента доезжает своим CSS-переходом, applyTx уже не зовут — а гнуть надо
   каждый кадр, иначе цифры застынут в конечных масштабах и «доедут» плоскими.
   Поэтому на время перехода читаем фактический сдвиг из матрицы. */
let curveRaf=0;
function curveRun(ms){
  cancelAnimationFrame(curveRaf);
  const t0=performance.now();
  (function f(){
    const m=new DOMMatrixReadOnly(getComputedStyle(reel).transform);
    curveReel(m.m41);
    if(performance.now()-t0<ms) curveRaf=requestAnimationFrame(f);
  })();
}

let lastFocusIdx=-1;
function applyTx(t,trans){ reel.style.transition=trans?('transform '+DIAL.snapMs+'ms '+DIAL.snapEase):'none';
  reel.style.transform='translateX('+t+'px) translateZ('+(-wrapW()*DIAL.R).toFixed(1)+'px)';
  const ci=clampIdx(Math.round(idxFromTx(t))); [...reel.children].forEach((el,k)=>el.classList.toggle('cur',k===ci));
  if(ci!==lastTickIdx){ lastTickIdx=ci; tick(); }
  if(trans) curveRun(DIAL.snapMs+40); else { cancelAnimationFrame(curveRaf); curveReel(t); } }
const dial=document.getElementById('dialWrap');
function ddown(e){ cancelAnimationFrame(raf); dragging=true; dragMoved=false; vel=0; lastX=pX(e); lastT=performance.now();
  e.preventDefault(); }
function dmove(e){ if(!dragging)return; const x=pX(e),now=performance.now(),dx=x-lastX,dt=Math.max(8,now-lastT);
  tx=clampTx(tx+dx*DIAL.sens); vel=dx*DIAL.sens/dt; lastX=x; lastT=now; if(Math.abs(dx)>1)dragMoved=true; applyTx(tx,false); e.preventDefault&&e.preventDefault(); }
function dup(e){ if(!dragging)return; dragging=false; if(dragMoved){ dmomentum(); return; }
  /* ?hints=1: тап по году переводит на него (проба 2026-09-19). Раньше касание без
     движения молча игнорировалось, а год выглядит кнопкой — в тесте люди тапали,
     ничего не происходило, и они сдавались. Невидимые за горизонтом годы не ловим. */
  if(!window.__HINTS) return;
  const el=e&&e.target&&e.target.closest&&e.target.closest('.yr');
  if(!el || parseFloat(el.style.opacity)<.15) return;
  const idx=[...reel.children].indexOf(el);
  if(idx<0 || idx===clampIdx(Math.round(idxFromTx(tx)))) return;
  tx=txForIdx(idx); applyTx(tx,true); dland(idx); }
function clampTx(t){ return Math.max(txForIdx(DEC.length-1),Math.min(txForIdx(0),t)); }
/* ⚠️ Через затвор: dmomentum на приземлении зовёт playResult и tick, а они
   объявлены в скрипте продукта. Касание в щель между <script src> подняло бы
   ReferenceError. См. блок «ЗАТВОР ЯДРА» в catalog.js. */
window.__core.on(function(){
dial.addEventListener('mousedown',ddown); dial.addEventListener('touchstart',ddown,{passive:false});
document.addEventListener('mousemove',dmove); document.addEventListener('touchmove',dmove,{passive:false});
document.addEventListener('mouseup',dup); document.addEventListener('touchend',dup);
});
function dmomentum(){ cancelAnimationFrame(raf); let last=performance.now();
  if(window.__FILM_MODE){
    const predicted=clampTx(tx+vel*260), idx=clampIdx(Math.round(idxFromTx(predicted)));
    filmDialSpring(txForIdx(idx),vel,idx); return;
  }
  (function f(now){ const dt=Math.min(40,now-last); last=now; tx+=vel*dt; vel*=Math.pow(DIAL.decay,dt/16);
    const cl=clampTx(tx); if(cl!==tx){tx=cl;vel=0;} applyTx(tx,false);
    if(Math.abs(vel)<DIAL.stop){ const idx=clampIdx(Math.round(idxFromTx(tx))); tx=txForIdx(idx); applyTx(tx,true);
      /* Подмену делаем НЕ здесь: лента едет к слоту ещё 340 мс (её собственный
         transition), и год всё это время должен ехать вместе с ней. Переключимся,
         когда она доедет, — тогда ячейка и неподвижный слой совпадут точка в точку. */
      dland(idx); return; }
    raf=requestAnimationFrame(f); })(last); }
/* ?film: one critically-damped spring carries the release velocity into the
   selected decade, so the reel never switches from free motion to a separate
   CSS transition with a visible kick. */
function filmDialSpring(target,initialVelocity,idx){
  cancelAnimationFrame(raf); reel.style.transition='none';
  let v=initialVelocity*1000, last=performance.now();
  (function step(now){
    const dt=Math.min(.04,(now-last)/1000); last=now;
    const w=10.5;
    v += ((target-tx)*w*w - 2*w*v)*dt;
    tx += v*dt; applyTx(tx,false);
    if(Math.abs(target-tx)<.5 && Math.abs(v)<8){
      tx=target; applyTx(tx,false); dland(idx); return;
    }
    raf=requestAnimationFrame(step);
  })(last);
}
/* Приземление на эпоху idx: музыка вступает через DIAL.playMs, пока лента доезжает.
   Вынесено из dmomentum 2026-09-19 — тем же путём идёт тап по году. */
function dland(idx){
      setTimeout(()=>{ const dec=DEC[idx];
        /* Время повело — мир перестроится под него. Своей проверки здесь больше
           НЕТ (2026-09-10): «есть ли архив, а если нет — довернуть к ближайшему
           живому» держит playResult, одна на все пути смены пары. Прежняя копия
           спрашивала ближайшее место у живого tx, а он за эти DIAL.playMs успевал
           уехать — место выбиралось для одной эпохи, а игралось в другой.
           Здесь остаётся только «от кого отталкиваемся». */
        const p=state.place?placeById(state.place):nearestPlace(dec);
        lastPlace=p.id; playResult(p,dec,true); },DIAL.playMs); }

