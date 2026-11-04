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

   КАТАЛОГ И ЧИСТЫЕ ФУНКЦИИ (DOM не трогают).
   Наружу: DEC, D2R, PLACES, ARTISTS, DUR, RM, placeById, lastPlace,
   trackArt/isRealArt/artVars, glowColor, trackTint,
   ARTIST_PICS (портреты), hasArchive, liveDec, nearestDec, decShort.
   ⚠️ ARTIST_PICS обязан жить ЗДЕСЬ, а не в продукте: карты приходят fetch'ем,
   и их .then может сработать между скриптами — из продукта константа была бы
   ещё в TDZ, и портреты молча не подхватились бы.
   liveDec читает шкалу (tx/idxFromTx из dial.js) и state продукта — но только
   в момент вызова; try/catch внутри и рассчитан на то, что шкалы ещё нет.
   ⚠️ state объявлен ЗДЕСЬ, а не в продукте: первый кадр глобуса может выпасть
   раньше, чем выполнится скрипт продукта, а renderGlobe читает state.place. */

/* ── ЗАТВОР ЯДРА (2026-09-10) ─────────────────────────────────────────
   Пока всё лежало в ОДНОМ <script>, ни один кадр rAF и ни одно событие не
   могли случиться раньше, чем скрипт дочитан целиком: JS однопоточен, и
   первый кадр приходил после последней строки. Вынос в четыре файла это
   свойство сломал — между <script src> браузер вправе вставить отрисовку
   (и он это делает, пока следующий файл ещё качается), а касание экрана
   вправе прийти в ту же щель. Тогда цикл глобуса и слушатели шкалы
   дотягиваются до playResult / haptic / tick / startPlay, которые живут в
   скрипте продукта и ЕЩЁ НЕ ОБЪЯВЛЕНЫ, — ReferenceError на пустом месте.
   Затвор возвращает прежний инвариант: всё, что стартует циклы и вешает
   слушатели, откладывается до go(), а go() зовёт продукт последней строкой
   своего скрипта — ровно там, где эта же точка была в исходном файле.
   ⚠️ Данные (Object.assign в карты) НЕ откладываются: им можно и нужно
   приезжать раньше, они ни на что из продукта не ссылаются.
   ⚠️ Страховка на DOMContentLoaded — на случай, если продукт упал с ошибкой
   до своей последней строки: тогда глобус хотя бы не останется замороженным.
   Событие приходит после всех парсер-блокирующих скриптов, то есть раньше
   продукта сработать не может. */
window.__core = window.__core || (function(){
  let ready=false; const q=[];
  return {
    isReady(){ return ready; },
    on(fn){ ready ? fn() : q.push(fn); },
    go(){ if(ready) return; ready=true; while(q.length) q.shift()(); }
  };
})();
document.addEventListener('DOMContentLoaded', function(){ window.__core.go(); });

const DEC=["1930","1940","1950","1960","1970","1980","1990","2000","2010","NOW"];
const D2R=Math.PI/180;
const PLACES=[
  {id:"moscow",name:"Moscow",country:"Russia",lat:55.75,lon:37.62,coord:"55°45′N 37°37′E",hue:355,eras:{
    "1930":[{g:"Soviet Jazz",t:"Always With You (Vsegda S Toboi)",a:"Alexander Tsfasman"},{g:"Tea-Jazz",t:"Heart (From \"The Merry Fellows\")",a:"Leonid Utesov"},{g:"Soviet Film Song",t:"Kakhovka Song (From \"The Three Comrades\")",a:"Nikolay Batalov & Isaac Dunaevsky"}],
    "1940":[{g:"Soviet Film Song",t:"Тёмная ночь",a:"Mark Bernes, Александр Иванов-Крамской & Ансамбль п/у Александра Цфасмана"},{g:"Frontline Jazz",t:"The Road to Berlin (1943)",a:"Leonid Utesov"},{g:"Army Ensemble Song",t:"In the Forest (Front-Line) [1944]",a:"Georgiy Vinogradov"}],
    "1960":[{g:"Bard Song",t:"Грузинская песня",a:"Bulat Okudzhava"},{g:"Soviet Swing",t:"Blue Prelude",a:"Eddie Rosner Variety Orchestra"},{g:"Estrada Jazz",t:"In the Mood",a:"Oleg Lundstrem Orchestra"}],
    "1970":[{g:"Electronic Score",t:"Solaris",a:"Eduard Artemyev"},{g:"Bard Song",t:"Молитва",a:"Bulat Okudzhava"},{g:"Vocal-Instrumental",t:"Из вагантов",a:"David Tukhmanov"}],
    "1980":[{g:"Art Punk",t:"Серый голубь",a:"Zvuki Mu"},{g:"Siberian Punk",t:"Мышеловка",a:"Grazhdanskaya Oborona"},{g:"Soviet Rockabilly",t:"Чёрный кот",a:"Bravo"}],
    "1990":[{g:"Post-Soviet Rock",t:"Хару мамбуру",a:"Nogu Svelo!"},{g:"Ethno Electronic",t:"Кострома",a:"Ivan Kupala"},{g:"Alternative Rock",t:"Прыгну со скалы",a:"Korol i Shut"}],
    "2010":[{g:"Synth Pop",t:"Spirit of the Night",a:"Tesla Boy"},{g:"Witch House",t:"Смерти Больше Нет",a:"IC3PEAK"},{g:"Experimental Pop",t:"Конец света",a:"Samoe Bolshoe Prostoe Chislo"}],
    "NOW":[{g:"Moscow Ambient",t:"Kata",a:"Kate NV"},{g:"Leftfield Techno",t:"Ghetto Kraviz",a:"Nina Kraviz"},{g:"Chamber Electronic",t:"Plans",a:"Kate NV"}]}},
  {id:"saintpetersburg",name:"Saint Petersburg",country:"Russia",lat:59.94,lon:30.31,coord:"59°56′N 30°19′E",hue:238,eras:{
    "1960":[{g:"Leningrad Beat",t:"Синий иней (Remastered 2024)",a:"Poyushchiye Gitary"},{g:"Chanson",t:"Сиреневый туман",a:"Владимир Маркин"},{g:"Estrada",t:"Огромное небо",a:"Edita Piekha"}],
    "1980":[{g:"Post-Punk",t:"Троллейбус",a:"Kino"},{g:"Art Rock",t:"Дети декабря",a:"Akvarium"},{g:"Avant-Garde Rock",t:"Иван Бодхидхарма",a:"Akvarium"}],
    "1990":[{g:"Noise Rock",t:"Человек и кошка",a:"Nol"},{g:"Alt Rock",t:"Зимнее солнце",a:"Tequilajazzz"},{g:"Ska Punk",t:"Настроение",a:"Spitfire"}],
    "2010":[{g:"Post-Punk Revival",t:"Стыд",a:"Shortparis"},{g:"Cold Wave",t:"Things I Don't Need",a:"Human Tetris"},{g:"Experimental Pop",t:"90",a:"Pompeya"}],
    "NOW":[{g:"Neo-Folk",t:"Сумецкая",a:"Otava Yo"},{g:"Petersburg Techno",t:"Zarubezh",a:"Vtgnike"},{g:"Chamber Pop",t:"Страшно",a:"Shortparis"}]}},
  {id:"kyiv",name:"Kyiv",country:"Ukraine",lat:50.45,lon:30.52,coord:"50°27′N 30°31′E",hue:52,eras:{
    "1970":[{g:"Ukrainian Beat",t:"Червона рута",a:"Sofiya Rotaru"},{g:"Ukrainian Folk Beat",t:"Я піду в далекі гори",a:"Володимир Івасюк"},{g:"Estrada Soul",t:"Водограй",a:"Володимир Івасюк"}],
    "1980":[{g:"Ukrainian New Wave",t:"Tantsi",a:"Vopli Vidopliassova"},{g:"Folk Protest",t:"Гей нумо хлопці до зброї",a:"Василь Жданкін"},{g:"Ukrainian Punk",t:"Наркомани на городі",a:"Braty Gadyukiny"}],
    "1990":[{g:"Ethno Punk",t:"Ia Letel",a:"Vopli Vidopliassova"},{g:"Alternative",t:"Там, де нас нема",a:"Okean Elzy"},{g:"Trip Hop",t:"Au",a:"Perkalaba"}],
    "2010":[{g:"Ritual Folk",t:"Karpatskyi Rep",a:"DakhaBrakha"},{g:"Electro Folk",t:"Vidlik",a:"Onuka"},{g:"Indie Rock",t:"Обійми",a:"Okean Elzy"}],
    "NOW":[{g:"Ukrainian Rap",t:"Рідні мої",a:"alyona alyona & Jerry Heil"},{g:"Folktronica",t:"Плакала",a:"KAZKA"},{g:"Kyiv Techno",t:"Up the Steel Stairway",a:"Stanislav Tolkachev"}]}},
  {id:"tbilisi",name:"Tbilisi",country:"Georgia",lat:41.72,lon:44.79,coord:"41°43′N 44°47′E",hue:118,eras:{
    "1960":[{g:"Polyphonic Chant",t:"Chakrulo",a:"Rustavi Choir"},{g:"Georgian Urban Song",t:"Tsintskaro",a:"Vocal Ensemble Gordela"},{g:"Estrada",t:"Дорогой Длинною",a:"Nani Bregvadze"}],
    "1970":[{g:"Jazz Rock",t:"Арго (Из мюзикла \"Аргонавты\")",a:"Иверия"},{g:"Caucasian Fusion",t:"Лалеби",a:"Orera"},{g:"Film Score",t:"Mimino",a:"Giya Kancheli"}],
    "1990":[{g:"Georgian Jazz",t:"Olei",a:"Nino Katamadze & Insight"},{g:"Ethno Jazz",t:"Арго",a:"Tamara Gverdtsiteli"},{g:"Folk Revival",t:"Shen Khar Venakhi",a:"Ensemble Basiani"}],
    "NOW":[{g:"Bassiani Techno",t:"Flats",a:"HVL"},{g:"Neo-Folk Rock",t:"Sikvaruli",a:"Mgzavrebi"},{g:"Caucasian Electronica",t:"Doodle (with Werkstatt)",a:"Natalie Beridze"}]}},
  {id:"yerevan",name:"Yerevan",country:"Armenia",lat:40.18,lon:44.51,coord:"40°11′N 44°31′E",hue:8,eras:{
    "1950":[{g:"Symphonic",t:"Sabre Dance",a:"Aram Khachaturian"},{g:"Ashugh Song",t:"Yes Im Anush Hayastani",a:"HOVHANNES BADALYAN"},{g:"Armenian Folk",t:"Garun",a:"Ruben Matevosyan & Rouben Matevosian"}],
    "1970":[{g:"Duduk",t:"I Will Not Be Sad In This World",a:"Djivan Gasparyan"},{g:"Armenian Estrada",t:"Ur Ek Tghaner",a:"Raisa Mkrtchyan"},{g:"Folk Jazz",t:"Yerevan Jan",a:"Levon Malkhasyan"}],
    "1980":[{g:"Armenian Rock",t:"Arev E Elel",a:"The Bambir"},{g:"Prog Folk",t:"Where Were You God?",a:"Arthur Meschian"},{g:"Chamber Jazz",t:"Nocturne",a:"Levon Malkhasyan"}],
    "NOW":[{g:"Duduk Ambient",t:"Kamancha",a:"Vardan Hovanissian & Emre Gültekin"},{g:"Armenian Jazz",t:"Rays of Light",a:"Tigran Hamasyan"},{g:"Alt Folk",t:"Im Aghjik",a:"Sona Rubenyan"}]}},
  {id:"baku",name:"Baku",country:"Azerbaijan",lat:40.41,lon:49.87,coord:"40°25′N 49°52′E",hue:172,eras:{
    "1960":[{g:"Mugham",t:"Chahargah",a:"Seyid Shushinski"},{g:"Mugham Dastgah",t:"Meni Dari",a:"Seyid Shushinski"},{g:"Folk Tar",t:"Bayati Shiraz",a:"Bahram Mansurov"}],
    "1970":[{g:"Jazz Mugham",t:"Recollection of Tbillisi (Live)",a:"Vagif Mustafazadeh & Mugam"},{g:"Azerbaijani Jazz",t:"Азиза",a:"Vagif Mustafazadeh"},{g:"Soviet Jazz",t:"Играю с удовольствием",a:"Vagif Mustafazadeh"}],
    "1990":[{g:"Piano Mugham",t:"Aspiration",a:"Aziza Mustafa Zadeh"},{g:"Modern Mugham",t:"Getme, Getme (Don’t Leave, Don’t Leave)",a:"Alim Qasimov Ensemble & Kronos Quartet"},{g:"Ethno Fusion",t:"Allaha Dua",a:"Fərqanə Qasımova & Alim Qasimov"}],
    "NOW":[{g:"Modern Mugham Vocal",t:"Neve",a:"Elnare Abdullayeva"},{g:"Caspian Jazz",t:"Planet",a:"Isfar Sarabski"},{g:"Alt Mugham",t:"Rüya",a:"Nisa"}]}},
  {id:"naples",name:"Naples",country:"Italy",lat:40.85,lon:14.27,coord:"40°51′N 14°16′E",hue:18,eras:{
    "1950":[{g:"Canzone Napoletana",t:"Malafemmina",a:"Giacomo Rondinella"},{g:"Neapolitan Swing",t:"Tu vuò fà l'Americano",a:"Renato Carosone"},{g:"Festival Song",t:"Guaglione",a:"Aurelio Fierro"}],
    "1970":[{g:"Canzone Napoletana",t:"Carmela",a:"Sergio Bruni"},{g:"Neapolitan Prog",t:"Aria",a:"Alan Sorrenti"},{g:"Folk Revival",t:"Tammurriata Nera",a:"Nuova Compagnia di Canto Popolare"}],
    "1980":[{g:"Neapolitan Blues",t:"Napule è",a:"Pino Daniele"},{g:"Jazz Fusion",t:"Je so' pazzo",a:"Pino Daniele"},{g:"Sceneggiata",t:"Zappatore",a:"Mario Merola"}],
    "2000":[{g:"Dub Mediterraneo",t:"Sanacore",a:"Almamegretta"},{g:"Trip Hop",t:"Fattallà",a:"Almamegretta"},{g:"Neapolitan Hip Hop",t:"Quello che",a:"99 Posse"}],
    "NOW":[{g:"Nu-Neapolitan",t:"Nove Maggio",a:"Liberato"},{g:"Mediterranean Disco",t:"Tienaté",a:"Nu Genea"},{g:"Neomelodic Pop",t:"Suonno",a:"Nino D'Angelo"}]}},
  {id:"belgrade",name:"Belgrade",country:"Serbia",lat:44.8,lon:20.45,coord:"44°49′N 20°27′E",hue:205,eras:{
    "1980":[{g:"Yugoslav New Wave",t:"Ona Se Budi",a:"Šarlo Akrobata"},{g:"Post-Punk",t:"Radostan Dan",a:"Ekatarina Velika"},{g:"Synth-pop",t:"Retko te viđam sa devojkama",a:"Idoli"}],
    "1990":[{g:"Art Rock",t:"Zemlja",a:"Ekatarina Velika"},{g:"Balkan Satire",t:"Amerika i Engleska",a:"Rambo Amadeus"},{g:"Turbo-folk",t:"Mile voli disko",a:"Lepa Brena"}],
    "NOW":[{g:"Balkan Electronic",t:"Tišina",a:"Lena Kovačević"},{g:"Belgrade Techno",t:"Mechanism Delight",a:"Marko Nastić"},{g:"Alt Pop",t:"Suženi snovi",a:"Repetitor"}]}},
  {id:"warsaw",name:"Warsaw",country:"Poland",lat:52.23,lon:21.01,coord:"52°14′N 21°01′E",hue:225,eras:{
    "1930":[{g:"Cabaret Song",t:"Miłość Ci wszystko wybaczy",a:"Hanka Ordonówna"},{g:"Polish Tango",t:"To Ostatnia Niedziela",a:"Mieczyslaw Fogg"},{g:"Film Song",t:"Już Taki Jestem Zimny Drań",a:"Eugeniusz Bodo"}],
    "1970":[{g:"Psychedelic Rock",t:"Dziwny jest ten świat",a:"Czesław Niemen"},{g:"Blues Rock",t:"Kiedy byłem małym chłopcem",a:"Breakout"},{g:"Jazz",t:"Ballada",a:"Zbigniew Namysłowski"}],
    "1980":[{g:"Cold Wave",t:"Nieustanne tango",a:"Republika"},{g:"New Wave",t:"Kocham cię, kochanie moje",a:"Maanam"},{g:"Post-Punk",t:"Nie płacz Ewka",a:"Perfect"}],
    "NOW":[{g:"Alt Pop",t:"Varsovie",a:"Brodka"},{g:"Industrial Techno",t:"Ruin",a:"Zamilska"},{g:"Polish Jazz Now",t:"Purple Sun",a:"EABS"}]}},
  {id:"dakar",name:"Dakar",country:"Senegal",lat:14.72,lon:-17.47,coord:"14°43′N 17°28′W",hue:48,eras:{
    "1970":[{g:"Afro-Cuban",t:"Utrus Horas",a:"Orchestra Baobab"},{g:"Mbalax",t:"Xalis",a:"Étoile de Dakar"},{g:"Senegalese Rumba",t:"Sey",a:"Orchestra Baobab"}],
    "1980":[{g:"Mbalax Moderne",t:"Immigrés",a:"Youssou N'Dour"},{g:"Afro-Pop",t:"Bole Doley",a:"Super Diamono"},{g:"Griot Soul",t:"Tadieu Bone",a:"Ismaël Lô"}],
    "2000":[{g:"Senegalese Hip Hop",t:"Boomerang",a:"Daara J"},{g:"Afro-Fusion",t:"Set",a:"Youssou N'Dour"},{g:"Acoustic Griot",t:"Tajabone",a:"Ismaël Lô"}]}},
  {id:"luanda",name:"Luanda",country:"Angola",lat:-8.84,lon:13.23,coord:"08°50′S 13°14′E",hue:38,eras:{
    "1970":[{g:"Semba",t:"Mona Ki Ngi Xica",a:"Bonga"},{g:"Angolan Rumba",t:"Saudades De Luanda",a:"Os Kiezos"},{g:"Merengue Angolano",t:"Muxima",a:"Waldemar Bastos"}],
    "2000":[{g:"Kuduro",t:"Felicidade",a:"Sebem"},{g:"Kuduro Progressivo",t:"Tá Bater ou Nã",a:"Puto Prata"},{g:"Semba Moderno",t:"Poema do Semba",a:"Paulo Flores"}],
    "NOW":[{g:"Afro House",t:"Sofre",a:"DJ Znobia"},{g:"Angolan Electronic",t:"Break of Dawn (feat. Richie Campbell)",a:"Nelson Freitas"},{g:"Semba Contemporâneo",t:"Lá No Fundo",a:"Yola Semedo"}]}},
  {id:"joburg",name:"Johannesburg",country:"South Africa",lat:-26.2,lon:28.05,coord:"26°12′S 28°03′E",hue:290,eras:{
    "1950":[{g:"Kwela",t:"Kwela Spokes",a:"Spokes Mashiyane"},{g:"Township Jive",t:"Hamba Nontsokolo (feat. The Golden Rhythm Crooners)",a:"Dorothy Masuka"},{g:"Close Harmony",t:"Sindiza Ngecadillacs",a:"Miriam Makeba & The Skylarks"}],
    "1970":[{g:"South African Jazz",t:"Emampondweni",a:"Batsumi"},{g:"Malombo",t:"Sangoma",a:"Malombo"},{g:"Mbaqanga",t:"Thoko",a:"Mahlathini and the Mahotella Queens"}],
    "1980":[{g:"Bubblegum",t:"Weekend Special",a:"Brenda Fassie"},{g:"Township Pop",t:"Umqombothi",a:"Yvonne Chaka Chaka"},{g:"Electro-Mbaqanga",t:"Burnout",a:"Sipho Mabuse"}],
    "2000":[{g:"Kwaito",t:"Umdlwembe",a:"Zola"},{g:"Afro-Pop",t:"Emlanjeni",a:"Mafikizolo"},{g:"SA Hip Hop",t:"Building Castles",a:"Skwatta Kamp"}],
    "2010":[{g:"Afro House",t:"Superman",a:"Black Coffee"},{g:"Kwaito",t:"Kaffir",a:"Arthur Mafokate"},{g:"Gqom",t:"MY POWER",a:"DJ Lag"}],
    "NOW":[{g:"Amapiano",t:"Sponono",a:"Kabza De Small"},{g:"Piano Soul",t:"Abalele",a:"DJ Maphorisa"},{g:"Afro-Tech",t:"The Rapture Pt. III",a:"Black Coffee"}]}},
  {id:"medellin",name:"Medellín",country:"Colombia",lat:6.24,lon:-75.58,coord:"06°14′N 75°34′W",hue:12,eras:{
    "1970":[{g:"Salsa Dura",t:"El Preso",a:"Fruko y sus Tesos"},{g:"Cumbia",t:"La Piragua",a:"Gabriel Romero"},{g:"Descarga",t:"Manyoma",a:"Fruko y sus Tesos"}],
    "1980":[{g:"Salsa Romántica",t:"Cali Pachanguero",a:"Grupo Niche"},{g:"Vallenato",t:"La Creciente",a:"Binomio de Oro"},{g:"Tropical",t:"Los Sabanales",a:"Calixto Ochoa"}],
    "2010":[{g:"Reggaeton",t:"6 AM",a:"J Balvin"},{g:"Latin Trap",t:"Ginza",a:"J Balvin"},{g:"Electro-Cumbia",t:"Danza Kuduro",a:"Don Omar"}]}},
  {id:"salvador",name:"Salvador",country:"Brazil",lat:-12.97,lon:-38.5,coord:"12°58′S 38°30′W",hue:28,eras:{
    "1970":[{g:"Tropicália",t:"Expresso 2222",a:"Gilberto Gil"},{g:"Baião Rock",t:"Preta Pretinha",a:"Novos Baianos"},{g:"Afro-Samba",t:"Berimbau",a:"Baden Powell"}],
    "1980":[{g:"Axé",t:"Faraó Divindade do Egito",a:"Margareth Menezes"},{g:"Samba-Reggae",t:"Faraó",a:"Olodum"},{g:"Afoxé",t:"Alfazema",a:"Filhos de Gandhy"}],
    "NOW":[{g:"Bass Baiano",t:"Playsom",a:"BaianaSystem"},{g:"Afro-Bahian Pop",t:"Cupido Erê",a:"Larissa Luz"},{g:"Samba Eletrônico",t:"Duas Cidades",a:"BaianaSystem"}]}},
  {id:"portofspain",name:"Port of Spain",country:"Trinidad & Tobago",lat:10.65,lon:-61.51,coord:"10°39′N 61°31′W",hue:55,eras:{
    "1930":[{g:"Calypso",t:"Ugly Woman",a:"Roaring Lion"},{g:"Calypso Commentary",t:"Graf Zeppelin",a:"Attila the Hun"},{g:"Calypso Social",t:"Money Is King",a:"Growling Tiger"}],
    "1950":[{g:"Calypso",t:"London Is the Place for Me",a:"Lord Kitchener"},{g:"Calypso Ballad",t:"Jean and Dinah",a:"Mighty Sparrow"},{g:"Steelpan",t:"Curry Tabanca (Arr. for Steelband by Leon Edwards)",a:"Trinidad All Stars"}],
    "1970":[{g:"Soca",t:"Indrani",a:"Lord Shorty"},{g:"Calypso Soul",t:"Sweet Soca Music",a:"Lord Shorty"},{g:"Rapso",t:"Cyar Take That",a:"Brother Resistance"}],
    "NOW":[{g:"Power Soca",t:"Like Ah Boss",a:"Machel Montano"},{g:"Groovy Soca",t:"Famalay",a:"Bunji Garlin"},{g:"Steelpan Now",t:"Pan in A Minor",a:"Renegades Steel Orchestra"}]}},
  {id:"beirut",name:"Beirut",country:"Lebanon",lat:33.89,lon:35.5,coord:"33°53′N 35°30′E",hue:36,eras:{
    "1960":[{g:"Lebanese Classical",t:"Kifak Inta",a:"Fairuz"},{g:"Rahbani Musical",t:"Nassam Alayna El Hawa",a:"Fairuz"},{g:"Arabic Tarab",t:"Ya Ana Ya Ana",a:"Wadih El Safi"}],
    "1970":[{g:"Oriental Jazz",t:"Abu Ali",a:"Ziad Rahbani"},{g:"Arabic Funk",t:"Ana Mush Kafir",a:"Ziad Rahbani"},{g:"Levantine Pop",t:"Yana Yana",a:"Sabah"}],
    "NOW":[{g:"Arabic Indie",t:"Fasateen",a:"Mashrou' Leila"},{g:"Electro-Tarab",t:"Ya Nas",a:"Bachar Mar-Khalifé"},{g:"Beirut Experimental",t:"Souk El Ahad",a:"Charif Megarbane"}]}},
  {id:"tehran",name:"Tehran",country:"Iran",lat:35.7,lon:51.42,coord:"35°42′N 51°25′E",hue:345,eras:{
    "1970":[{g:"Iranian Pop",t:"Do Panjereh",a:"Googoosh"},{g:"Psych Rock",t:"Gol-e Yakh",a:"Kourosh Yaghmaei"},{g:"Persian Funk",t:"Roud Khouneha",a:"Ramesh"}],
    "1980":[{g:"Persian Classical",t:"Morgh-e Sahar",a:"Mohammad-Reza Shajarian"},{g:"Setar Instrumental",t:"Bidad",a:"Parviz Meshkatian"},{g:"Diaspora Pop",t:"Cheshme Man",a:"Dariush"}],
    "NOW":[{g:"Persian Alt",t:"Delam",a:"Mohsen Namjoo"},{g:"Tehran Electronic",t:"Ash",a:"Ata Ebtekar"},{g:"Underground Rock",t:"Eshghe Sorat",a:"Kiosk"}]}},
  {id:"osaka",name:"Osaka",country:"Japan",lat:34.69,lon:135.5,coord:"34°41′N 135°30′E",hue:185,eras:{
    "1980":[{g:"Kansai Punk",t:"Twist Barbie",a:"Shonen Knife"},{g:"New Wave Kansai",t:"What the Hell",a:"Ultra Bidé"},{g:"Enka Pop",t:"Naniwa Koi-Shigure",a:"Harumi Miyako"}],
    "1990":[{g:"Noise Rock",t:"Domsbore",a:"Boredoms"},{g:"Japanoise",t:"Jet Net",a:"Boredoms"},{g:"Indie Pop",t:"Riding on the Rocket",a:"Shonen Knife"}],
    "2010":[{g:"Kansai Electronic",t:"Don't Stop the Music",a:"tofubeats"},{g:"Jazz Fusion",t:"Quinty",a:"Yasei Collective"},{g:"City Pop Revival",t:"Loretta",a:"Ginger Root"}]}},
  {id:"lisbon",name:"Lisbon",country:"Portugal",lat:38.7,lon:-9.1,coord:"38°43′N 09°08′W",hue:32,eras:{
    "1970":[{g:"Fado",t:"Gaivota",a:"Amália Rodrigues"},{g:"Morna",t:"Sodade",a:"Cesária Évora"},{g:"Chanson",t:"Lisboa Antiga",a:"Hermínia Silva"}],
    "1980":[{g:"Synth-pop",t:"Canção do Engate",a:"António Variações"},{g:"New Wave",t:"Estou Além",a:"António Variações"},{g:"Fado",t:"Estranha Forma de Vida",a:"Amália Rodrigues"}],
    "1950":[{g:"Fado",t:"Barco Negro",a:"Amália Rodrigues"},{g:"Fado Castiço",t:"Lembro-me de Ti",a:"Alfredo Marceneiro"},{g:"Fado Menor",t:"Fado das Horas",a:"Maria Teresa de Noronha"}],
    "2000":[{g:"Kuduro",t:"Sound of Kuduro",a:"Buraka Som Sistema"},{g:"Fado Novo",t:"Ó Gente da Minha Terra",a:"Mariza"},{g:"Hip Hop Tuga",t:"Dialectos de Ternura",a:"Da Weasel"}],
    "NOW":[{g:"Afro-Portuguese",t:"Nova Lisboa",a:"Dino d'Santiago"},{g:"Global Bass",t:"SDDS",a:"Branko"},{g:"Afro-Lisboa",t:"Alegria",a:"Batida"}]}},
  {id:"paris",name:"Paris",country:"France",lat:48.9,lon:2.35,coord:"48°51′N 02°21′E",hue:330,eras:{
    "1930":[{g:"Jazz Manouche",t:"Minor Swing",a:"Django Reinhardt"},{g:"Chanson Réaliste",t:"Mon légionnaire",a:"Édith Piaf"},{g:"Chanson Swing",t:"Y'a d'la joie",a:"Charles Trenet"}],
    "1940":[{g:"Chanson",t:"La Vie en rose",a:"Édith Piaf"},{g:"Chanson Poétique",t:"La Mer",a:"Charles Trenet"},{g:"Swing Occupé",t:"Nuages",a:"Django Reinhardt"}],
    "1950":[{g:"Chanson Rive Gauche",t:"Si tu t'imagines",a:"Juliette Gréco"},{g:"Chanson",t:"Le gorille",a:"Georges Brassens"},{g:"Trad Jazz",t:"Petite fleur",a:"Sidney Bechet"}],
    "1960":[{g:"Yé-yé",t:"Tous les garçons et les filles",a:"Françoise Hardy"},{g:"Chanson",t:"Bonnie and Clyde",a:"Serge Gainsbourg"},{g:"Pop",t:"Comment te dire adieu",a:"Françoise Hardy"}],
    "1990":[{g:"French Touch",t:"Da Funk",a:"Daft Punk"},{g:"House",t:"Music Sounds Better with You",a:"Stardust"},{g:"Electro",t:"Flat Beat",a:"Mr. Oizo"}],
    "2000":[{g:"French Electro",t:"D.A.N.C.E.",a:"Justice"},{g:"French Touch",t:"Cherry Blossom Girl",a:"Air"},{g:"Chanson Électronique",t:"La Ritournelle",a:"Sébastien Tellier"}],
    "NOW":[{g:"Art Pop",t:"People, I've Been Sad",a:"Christine and the Queens"},{g:"Electronica",t:"Bye Bye Macadam",a:"Rone"},{g:"Nu-disco",t:"Agitations Tropicales",a:"L'Impératrice"}]}},
  {id:"berlin",name:"Berlin",country:"Germany",lat:52.5,lon:13.4,coord:"52°31′N 13°24′E",hue:210,eras:{
    "1930":[{g:"Weimar Cabaret",t:"Ich bin von Kopf bis Fuß auf Liebe eingestellt",a:"Marlene Dietrich"},{g:"Vocal Harmony",t:"Veronika, der Lenz ist da",a:"Comedian Harmonists"},{g:"Schlager",t:"Lili Marleen",a:"Lale Andersen"}],
    "1940":[{g:"UFA Torch Song",t:"Ich weiß, es wird einmal ein Wunder gescheh'n",a:"Zarah Leander"},{g:"Film Swing",t:"Wir machen Musik",a:"Ilse Werner"},{g:"Wartime Schlager",t:"Sing, Nachtigall Sing",a:"Evelyn Künneke"}],
    "1970":[{g:"Krautrock",t:"Hallogallo",a:"Neu!"},{g:"Motorik",t:"Mother Sky",a:"Can"},{g:"Ambient",t:"Bayreuth Return",a:"Klaus Schulze"}],
    "1990":[{g:"Dub Techno",t:"Phylyps Trak",a:"Basic Channel"},{g:"Minimal",t:"Mø6b",a:"Maurizio"},{g:"Techno",t:"Octagon",a:"Basic Channel"}],
    "2000":[{g:"Microhouse",t:"Arcadia",a:"Apparat"},{g:"Electro",t:"Kill Bill Vol. 4",a:"Modeselektor"},{g:"Techno",t:"Down",a:"Ellen Allien"}],
    "2010":[{g:"Neoclassical",t:"Says",a:"Nils Frahm"},{g:"Techno",t:"Subzero",a:"Ben Klock"},{g:"Hard Techno",t:"Seduction",a:"Marcel Dettmann"}]}},
  {id:"lagos",name:"Lagos",country:"Nigeria",lat:6.5,lon:3.4,coord:"06°27′N 03°24′E",hue:150,eras:{
    "1970":[{g:"Afrobeat",t:"Water No Get Enemy",a:"Fela Kuti"},{g:"Highlife",t:"Sweet Mother",a:"Prince Nico Mbarga"},{g:"Funk",t:"Chant to Mother Earth",a:"BLO"}],
    "1980":[{g:"Synth-funk",t:"Atomic Bomb",a:"William Onyeabor"},{g:"Afro-disco",t:"Only You",a:"Steve Monite"},{g:"Boogie",t:"Things Fall Apart (Vocal)",a:"Steve Monite"}],
    "2010":[{g:"Afrobeats",t:"Ojuelegba",a:"Wizkid"},{g:"Afropop",t:"Aye",a:"Davido"},{g:"Nigerian Pop",t:"Personally",a:"P-Square"}],
    "NOW":[{g:"Afrofusion",t:"Last Last",a:"Burna Boy"},{g:"Alté",t:"Free Mind",a:"Tems"},{g:"Afrobeats",t:"Terminator",a:"Asake"}]}},
  {id:"addis",name:"Addis Ababa",country:"Ethiopia",lat:9.0,lon:38.7,coord:"09°01′N 38°44′E",hue:28,eras:{
    "1970":[{g:"Ethio-jazz",t:"Tezeta",a:"Mulatu Astatke"},{g:"Groove",t:"Yègellé Tezeta",a:"Mulatu Astatke"},{g:"Soul-jazz",t:"Yèkèrmo Sèw",a:"Mulatu Astatke"}]}},
  {id:"tokyo",name:"Tokyo",country:"Japan",lat:35.7,lon:139.7,coord:"35°41′N 139°41′E",hue:285,eras:{
    "1930":[{g:"Ryūkōka",t:"Sake wa Namida ka Tameiki ka",a:"Ichiro Fujiyama"},{g:"Blues Kayō",t:"Wakare no Blues",a:"Noriko Awaya"},{g:"Ondo",t:"Tokyo Ondo",a:"Katsutaro Kouta"}],
    "1940":[{g:"Postwar Kayōkyoku",t:"Ringo no Uta",a:"Michiko Namiki"},{g:"Japanese Boogie",t:"Tokyo Boogie-Woogie",a:"Shizuko Kasagi"},{g:"Film Theme",t:"Aoi Sanmyaku",a:"Ichiro Fujiyama"}],
    "1950":[{g:"Kayōkyoku",t:"Ringo Oiwake",a:"Hibari Misora"},{g:"Mood Kayō",t:"Yurakucho De Aimasho",a:"Frank Nagai"},{g:"Jazz Pop",t:"Tennessee Waltz",a:"Eri Chiemi"}],
    "1980":[{g:"City Pop",t:"Plastic Love",a:"Mariya Takeuchi"},{g:"Funk",t:"Last Summer Whisper",a:"Anri"},{g:"Disco",t:"Stay With Me",a:"Miki Matsubara"}],
    "1970":[{g:"Japan Rock",t:"Kaze wo Atsumete",a:"Happy End"},{g:"Folk Rock",t:"Natsu Nandesu",a:"Happy End"},{g:"City Pop",t:"4:00 A.M.",a:"Taeko Onuki"}],
    "2000":[{g:"Shibuya-kei",t:"Point of View Point",a:"Cornelius"},{g:"Ambient",t:"Blue Sky and Yellow Sunflower",a:"Susumu Yokota"},{g:"Electronic Rock",t:"Dive for You",a:"Boom Boom Satellites"}],
    "2010":[{g:"Technopop",t:"Spring of Life",a:"Perfume"},{g:"Kawaii Pop",t:"PONPONPON",a:"Kyary Pamyu Pamyu"},{g:"Dance Rock",t:"Shin Takarajima",a:"Sakanaction"}]}},
  {id:"seoul",name:"Seoul",country:"South Korea",lat:37.5,lon:127.0,coord:"37°33′N 126°58′E",hue:200,eras:{
    "1930":[{g:"Trot",t:"Tears of Mokpo",a:"Lee Nan-young"},{g:"Diaspora Ballad",t:"Hometown's Light",a:"Lee Nan-young"},{g:"Sinminyo",t:"Tears of the Duman River",a:"Kim Jeong-gu"}],
    "1980":[{g:"Korean Rock",t:"Don't Go",a:"Sanullim"},{g:"Psychedelia",t:"Already Now",a:"Sanullim"},{g:"Folk",t:"To the Land of Happiness",a:"Han Dae-soo"}],
    "1990":[{g:"K-pop",t:"I Know",a:"Seo Taiji and Boys"},{g:"Rap Rock",t:"Come Back Home",a:"Seo Taiji and Boys"},{g:"New Jack Swing",t:"We Are",a:"Deux"}],
    "2000":[{g:"K-Indie",t:"Cheap Coffee",a:"Chang Kiha"},{g:"K-Hip Hop",t:"Fly (feat. Amin. J)",a:"Epik High"},{g:"Lounge Electronica",t:"Sweety",a:"Clazziquai"}],
    "2010":[{g:"K-pop",t:"Fantastic Baby",a:"BIGBANG"},{g:"K-hip-hop",t:"I Am the Best",a:"2NE1"},{g:"Electropop",t:"Abracadabra",a:"Brown Eyed Girls"}],
    "NOW":[{g:"K-pop",t:"Ditto",a:"NewJeans"},{g:"Dance Pop",t:"Perfect Night",a:"LE SSERAFIM"},{g:"Hyperpop",t:"Next Level",a:"aespa"}]}},
  {id:"mumbai",name:"Mumbai",country:"India",lat:19.0,lon:72.8,coord:"19°04′N 72°52′E",hue:18,eras:{
    "1930":[{g:"Talkie Duet",t:"Main Ban Ki Chidiya Banke",a:"Devika Rani & Ashok Kumar"},{g:"Filmi Folk",t:"Kit Gaye Ho Khewanhar",a:"Saraswati Devi"},{g:"Filmi Bhajan",t:"Kit Jaoge Kanhaiya",a:"Devika Rani"}],
    "1940":[{g:"Filmi Ghazal",t:"Awaaz De Kahan Hai",a:"Noor Jehan"},{g:"Filmi Playback",t:"Aayega Aanewala",a:"Lata Mangeshkar"},{g:"Filmi Novelty",t:"Mere Piya Gaye Rangoon",a:"Shamshad Begum"}],
    "1950":[{g:"Filmi Cabaret",t:"Babuji Dheere Chalna",a:"Geeta Dutt"},{g:"Filmi Rock and Roll",t:"Eena Meena Deeka (Male Vocals)",a:"Kishore Kumar"},{g:"Filmi Ghazal",t:"Jalte Hain Jiske Liye",a:"Talat Mahmood"}],
    "1970":[{g:"Bollywood",t:"Dum Maro Dum",a:"Asha Bhosle"},{g:"Filmi Funk",t:"Piya Tu Ab To Aaja",a:"R.D. Burman"},{g:"Disco",t:"Mehbooba Mehbooba",a:"R.D. Burman"}],
    "2000":[{g:"Filmi",t:"Jai Ho",a:"A. R. Rahman"},{g:"Bollywood Soundtrack",t:"Kal Ho Naa Ho",a:"Shankar–Ehsaan–Loy"},{g:"Bollywood Pop",t:"Dus Bahane",a:"Vishal–Shekhar"}]}},
  {id:"newyork",name:"New York",country:"USA",lat:40.7,lon:-74.0,coord:"40°43′N 74°00′W",hue:220,eras:{
    "1930":[{g:"Big Band Swing",t:"It Don't Mean a Thing",a:"Duke Ellington"},{g:"Harlem Jazz",t:"Minnie the Moocher",a:"Cab Calloway"},{g:"Vocal Jazz",t:"Summertime",a:"Billie Holiday"}],
    "1940":[{g:"Bebop",t:"Ko-Ko",a:"Charlie Parker"},{g:"Big Band Bop",t:"Salt Peanuts",a:"Dizzy Gillespie"},{g:"Torch Song",t:"Lover Man",a:"Billie Holiday"}],
    "1970":[{g:"Soul",t:"Theme from Shaft",a:"Isaac Hayes"},{g:"Funk",t:"The Payback",a:"James Brown"},{g:"Symphonic Soul",t:"Walk On By",a:"Isaac Hayes"}],
    "1980":[{g:"Hip-hop",t:"The Message",a:"Grandmaster Flash"},{g:"Electro-funk",t:"Planet Rock",a:"Afrika Bambaataa"},{g:"Breakbeat",t:"Apache",a:"Incredible Bongo Band"}],
    "1950":[{g:"Modal Jazz",t:"So What",a:"Miles Davis"},{g:"Bebop",t:"'Round Midnight",a:"Thelonious Monk"},{g:"Post-bop",t:"Haitian Fight Song",a:"Charles Mingus"}],
    "1960":[{g:"Art Rock",t:"Sunday Morning",a:"The Velvet Underground"},{g:"Girl Group",t:"Be My Baby",a:"The Ronettes"},{g:"Spiritual Jazz",t:"A Love Supreme",a:"John Coltrane"}],
    "2000":[{g:"Dance-punk",t:"Losing My Edge",a:"LCD Soundsystem"},{g:"Garage Rock",t:"Last Nite",a:"The Strokes"},{g:"Post-punk Revival",t:"Obstacle 1",a:"Interpol"}],
    "2010":[{g:"Indie Rock",t:"Diane Young",a:"Vampire Weekend"},{g:"Alt-R&B",t:"Charcoal Baby",a:"Blood Orange"},{g:"Hip Hop",t:"Electric Body",a:"A$AP Rocky"}]}},
  {id:"detroit",name:"Detroit",country:"USA",lat:42.3,lon:-83.0,coord:"42°20′N 83°03′W",hue:265,eras:{
    "1940":[{g:"Detroit Boogie Blues",t:"Boogie Chillen'",a:"John Lee Hooker"},{g:"R&B Instrumental",t:"Blues for the Red Boy AKA Ok Blues",a:"Todd Rhodes"},{g:"Jump Blues",t:"Red Hot Blues",a:"T.J. Fowler"}],
    "1950":[{g:"Detroit Blues",t:"I'm in the Mood",a:"John Lee Hooker"},{g:"Gospel",t:"Precious Lord (Live at New Bethel Baptist Church, Detroit 1956)",a:"Aretha Franklin"},{g:"Rhythm and Blues",t:"Money (That's What I Want)",a:"Barrett Strong"}],
    "1960":[{g:"Motown",t:"My Girl",a:"The Temptations"},{g:"Soul",t:"Dancing in the Street",a:"Martha and the Vandellas"},{g:"Pop-soul",t:"You Can't Hurry Love",a:"The Supremes"}],
    "1980":[{g:"Detroit Techno",t:"Strings of Life",a:"Derrick May"},{g:"House",t:"Big Fun",a:"Inner City"},{g:"Electro",t:"Clear",a:"Cybotron"}],
    "2000":[{g:"Detroit Hip Hop",t:"Fall In Love",a:"Slum Village"},{g:"Garage Rock",t:"Hotel Yorba",a:"The White Stripes"},{g:"Detroit Electro",t:"Cascading Celestial Giants",a:"Drexciya"}],
    "2010":[{g:"Hip Hop",t:"Grown Up",a:"Danny Brown"},{g:"Detroit House",t:"Kaychunk",a:"Kyle Hall"},{g:"Deep House",t:"Lyk U Use 2",a:"Moodymann"}]}},
  {id:"havana",name:"Havana",country:"Cuba",lat:23.1,lon:-82.4,coord:"23°08′N 82°23′W",hue:48,eras:{
    "1930":[{g:"Son Cubano",t:"El Manisero",a:"Antonio Machín"},{g:"Afro-Son",t:"Bruca Maniguá",a:"Orquesta Casino de la Playa"},{g:"Bolero-Son",t:"Lágrimas Negras",a:"Trío Matamoros"}],
    "1940":[{g:"Son Montuno",t:"Dundunbanza",a:"Arsenio Rodríguez"},{g:"Afro-Cuban Jazz",t:"Tanga",a:"Machito"},{g:"Punto Guajiro",t:"Que Viva Changó",a:"Celina y Reutilio"}],
    "1950":[{g:"Mambo",t:"Mambo No. 5",a:"Pérez Prado"},{g:"Danzón",t:"Rapsodia en Azul (Arreglo Orestes López) [Danzón de Nuevo Ritmo]",a:"Antonio Arcaño"},{g:"Charanga",t:"El Bodeguero",a:"Orquesta Aragón"}],
    "1990":[{g:"Son",t:"Chan Chan",a:"Buena Vista Social Club"},{g:"Bolero",t:"Dos Gardenias",a:"Ibrahim Ferrer"},{g:"Danzón",t:"El Cuarto de Tula",a:"Buena Vista Social Club"}]}},
  {id:"saopaulo",name:"São Paulo",country:"Brazil",lat:-23.5,lon:-46.6,coord:"23°33′S 46°38′W",hue:45,eras:{
    "1950":[{g:"Samba Paulista",t:"Saudosa Maloca",a:"Os Demônios da Garoa"},{g:"Música Caipira",t:"Moda Da Pinga",a:"Inezita Barroso, Ochelsis Laureano & Raul Torres"},{g:"Brazilian Rock and Roll",t:"Estupido Cupido (Stupid Cupid)",a:"Celly Campello"}],
    "1960":[{g:"Tropicália",t:"A Minha Menina",a:"Os Mutantes"},{g:"Psychedelia",t:"Panis et Circenses",a:"Os Mutantes"},{g:"MPB",t:"Alegria, Alegria",a:"Caetano Veloso"}],
    "1970":[{g:"Samba Rock",t:"Taj Mahal",a:"Jorge Ben"},{g:"MPB",t:"Aquele Abraço",a:"Gilberto Gil"},{g:"Groove",t:"Umbabarauma",a:"Jorge Ben"}],
    "2000":[{g:"Indie Dance",t:"Alala",a:"CSS"},{g:"Baile Funk",t:"Solta o Frango",a:"Bonde do Rolê"},{g:"MPB Nova",t:"Malemolência",a:"Céu"}]}},
  {id:"kingston",name:"Kingston",country:"Jamaica",lat:18.0,lon:-76.8,coord:"17°58′N 76°47′W",hue:100,eras:{
    "1950":[{g:"Mento",t:"Island Gal Sally",a:"Count Lasher"},{g:"Jamaican R&B",t:"Boogie in My Bones",a:"Laurel Aitken"},{g:"Jamaican Shuffle",t:"Shuffling Jug",a:"Clue J & The Blues Blasters"}],
    "1970":[{g:"Roots Reggae",t:"Marcus Garvey",a:"Burning Spear"},{g:"Dub",t:"King Tubby Meets the Rockers Uptown",a:"Augustus Pablo"},{g:"Reggae",t:"Stir It Up",a:"Bob Marley & The Wailers"}],
    "1960":[{g:"Ska",t:"007 (Shanty Town)",a:"Desmond Dekker"},{g:"Rocksteady",t:"Tougher Than Tough",a:"Derrick Morgan"},{g:"Reggae",t:"Do the Reggay",a:"Toots and the Maytals"}],
    "2000":[{g:"Dancehall",t:"Get Busy",a:"Sean Paul"},{g:"Bashment",t:"Pon de River, Pon de Bank",a:"Elephant Man"},{g:"Roots Dancehall",t:"Just One of Those Days",a:"Sizzla"}],
    "2010":[{g:"Reggae Revival",t:"Smile Jamaica",a:"Chronixx"},{g:"Modern Roots",t:"Who Knows",a:"Protoje"},{g:"Roots Reggae",t:"Avocado",a:"Jah9"}],
    "NOW":[{g:"Reggae",t:"Toast",a:"Koffee"},{g:"Dancehall",t:"Family",a:"Popcaan"},{g:"Reggae Soul",t:"Where I'm Coming From",a:"Lila Iké"}]}},
  /* ── ДОБАВЛЕНО 2026-08-25: ещё 12 городов ────────────────────────
     Николай: «посмотреть, что будет, если у нас будет больше треков и точек».
     Правила каталога соблюдены: ровно 3 трека на пару место×эпоха и три РАЗНЫХ
     жанра внутри пары — жанр служит ключом оттенка свечения, на дублях свет
     переставал меняться при смене трека. */
  {id:"london",name:"London",country:"UK",lat:51.51,lon:-0.13,coord:"51°31′N 00°08′W",hue:215,eras:{
    "1930":[{g:"Dance Band",t:"The Very Thought of You",a:"Al Bowlly"},{g:"Novelty Song",t:"Teddy Bears' Picnic",a:"Henry Hall"},{g:"Hot Dance",t:"Body and Soul",a:"Ambrose and His Orchestra"}],
    "1940":[{g:"Wartime Ballad",t:"The White Cliffs of Dover",a:"Vera Lynn"},{g:"Forces Song",t:"Lili Marlene",a:"Anne Shelton"},{g:"British Big Band",t:"Opus One",a:"Ted Heath and His Music"}],
    "1950":[{g:"Skiffle",t:"Rock Island Line",a:"Lonnie Donegan"},{g:"Trad Jazz",t:"Bad Penny Blues",a:"Humphrey Lyttelton"},{g:"British Rock and Roll",t:"Move It",a:"Cliff Richard & The Drifters"}],
    "1960":[{g:"Beat",t:"Waterloo Sunset",a:"The Kinks"},{g:"Psych Rock",t:"Paint It Black",a:"The Rolling Stones"},{g:"Blue-eyed Soul",t:"You Don't Have to Say You Love Me",a:"Dusty Springfield"}],
    "1970":[{g:"Punk",t:"London Calling",a:"The Clash"},{g:"Mod Revival",t:"In the City",a:"The Jam"},{g:"Glam",t:"Life on Mars?",a:"David Bowie"}],
    "1980":[{g:"Art Pop",t:"Running Up That Hill",a:"Kate Bush"},{g:"Sophisti-pop",t:"Smooth Operator",a:"Sade"},{g:"Sound System Soul",t:"Back to Life",a:"Soul II Soul"}],
    "1990":[{g:"Britpop",t:"Parklife",a:"Blur"},{g:"Drum and Bass",t:"Inner City Life",a:"Goldie"},{g:"Progressive House",t:"Born Slippy",a:"Underworld"}],
    "2000":[{g:"Grime",t:"I Luv U",a:"Dizzee Rascal"},{g:"Eskibeat",t:"Wot Do U Call It?",a:"Wiley"},{g:"Neo Soul",t:"Rehab",a:"Amy Winehouse"}],
    "NOW":[{g:"UK Hip Hop",t:"Point and Kill",a:"Little Simz"},{g:"Alternative Soul",t:"Wildfires",a:"Sault"},{g:"House",t:"Delilah",a:"Fred again.."}]}},
  {id:"manchester",name:"Manchester",country:"UK",lat:53.48,lon:-2.24,coord:"53°29′N 02°14′W",hue:200,eras:{
    "1930":[{g:"Film Song",t:"Sing As We Go",a:"Gracie Fields"},{g:"Music Hall",t:"When I'm Cleaning Windows",a:"George Formby"},{g:"Dance Band",t:"Music Maestro Please",a:"Jack Hylton"}],
    "1980":[{g:"Post-Punk",t:"Love Will Tear Us Apart",a:"Joy Division"},{g:"Synth Dance",t:"Blue Monday",a:"New Order"},{g:"Indie Rock",t:"This Charming Man",a:"The Smiths"}],
    "1990":[{g:"Britpop",t:"Live Forever",a:"Oasis"},{g:"Madchester",t:"Step On",a:"Happy Mondays"},{g:"Big Beat",t:"Block Rockin' Beats",a:"The Chemical Brothers"}],
    "2000":[{g:"Indie",t:"There Goes the Fear",a:"Doves"},{g:"Alt Rock",t:"Grounds for Divorce",a:"Elbow"},{g:"Folk Pop",t:"Something to Talk About",a:"Badly Drawn Boy"}]}},
  {id:"chicago",name:"Chicago",country:"USA",lat:41.88,lon:-87.63,coord:"41°53′N 87°38′W",hue:270,eras:{
    "1930":[{g:"Bluebird Blues",t:"Just a Dream",a:"Big Bill Broonzy"},{g:"Hokum Blues",t:"Hoodoo Lady",a:"Memphis Minnie"},{g:"Harmonica Blues",t:"Good Morning, School Girl",a:"Sonny Boy Williamson I"}],
    "1940":[{g:"Electric Chicago Blues",t:"I Can't Be Satisfied",a:"Muddy Waters"},{g:"Urban Blues",t:"Me and My Chauffeur Blues",a:"Memphis Minnie"},{g:"Country Blues",t:"Key to the Highway",a:"Big Bill Broonzy"}],
    "1950":[{g:"Chicago Blues",t:"Hoochie Coochie Man",a:"Muddy Waters"},{g:"Electric Blues",t:"Smokestack Lightnin'",a:"Howlin' Wolf"},{g:"Rhythm and Blues",t:"Bo Diddley",a:"Bo Diddley"}],
    "1960":[{g:"Chicago Soul",t:"People Get Ready",a:"The Impressions"},{g:"Rhythm and Blues",t:"At Last",a:"Etta James"},{g:"Blues",t:"First Time I Met the Blues",a:"Buddy Guy"}],
    "1980":[{g:"House",t:"Your Love",a:"Frankie Knuckles"},{g:"Deep House",t:"Move Your Body",a:"Marshall Jefferson"},{g:"Acid House",t:"Acid Tracks",a:"Phuture"}],
    "2000":[{g:"Conscious Hip Hop",t:"Kick, Push",a:"Lupe Fiasco"},{g:"Alt-Country",t:"Jesus, Etc.",a:"Wilco"},{g:"Post-Rock",t:"Seneca",a:"Tortoise"}],
    "2010":[{g:"Alt Hip Hop",t:"Same Drugs",a:"Chance the Rapper"},{g:"Drill",t:"Love Sosa",a:"Chief Keef"},{g:"Neo Soul",t:"Blk Girl Soldier",a:"Jamila Woods"}],
    "NOW":[{g:"Jazz Rap",t:"Bye Bye Baby",a:"Noname"},{g:"Hip Hop",t:"Down On My Luck",a:"Vic Mensa"},{g:"Art Pop",t:"Wasted",a:"Nnamdï"}]}},
  {id:"neworleans",name:"New Orleans",country:"USA",lat:29.95,lon:-90.07,coord:"29°57′N 90°04′W",hue:42,eras:{
    "1930":[{g:"Hot Jazz",t:"Maple Leaf Rag",a:"Sidney Bechet & His New Orleans Feetwarmers"},{g:"Swing",t:"Cross Patch (78 rpm Version)",a:"Louis Prima & His New Orleans Gang"},{g:"Piano Blues",t:"Winin' Boy Blues",a:"Jelly Roll Morton"}],
    "1940":[{g:"Jump Blues",t:"Good Rocking Tonight",a:"Roy Brown"},{g:"Mardi Gras Rhumba",t:"Mardi Gras in New Orleans",a:"Professor Longhair"},{g:"Big Easy Boogie",t:"Country Boy",a:"Dave Bartholomew"}],
    "1950":[{g:"Rhythm and Blues",t:"Blueberry Hill",a:"Fats Domino"},{g:"New Orleans Piano",t:"Tipitina",a:"Professor Longhair"},{g:"Rock and Roll",t:"Tutti Frutti",a:"Little Richard"}],
    "1970":[{g:"Funk",t:"Hey Pocky A-Way",a:"The Meters"},{g:"Swamp Funk",t:"Right Place Wrong Time",a:"Dr. John"},{g:"New Orleans Soul",t:"Southern Nights",a:"Allen Toussaint"}],
    "1990":[{g:"Bounce",t:"Ha",a:"Juvenile"},{g:"Southern Rap",t:"Make 'Em Say Uhh!",a:"Master P"},{g:"Brass Band",t:"Do Whatcha Wanna",a:"Rebirth Brass Band"}],
    "NOW":[{g:"Brass Funk",t:"Do to Me",a:"Trombone Shorty"},{g:"Soul Fusion",t:"Quick",a:"Tank and the Bangas"},{g:"Bounce Pop",t:"Explode",a:"Big Freedia"}]}},
  {id:"buenosaires",name:"Buenos Aires",country:"Argentina",lat:-34.6,lon:-58.38,coord:"34°36′S 58°23′W",hue:18,eras:{
    "1930":[{g:"Tango Canción",t:"El día que me quieras",a:"Carlos Gardel"},{g:"Orquesta Típica",t:"La Cumparsita",a:"Juan d'Arienzo"},{g:"Tango de Salón",t:"Poema",a:"Francisco Canaro"}],
    "1940":[{g:"Tango de Barrio",t:"Tres Esquinas",a:"Ángel D'Agostino"},{g:"Milonga Ciudadana",t:"Siga el Baile",a:"Alberto Castillo"},{g:"Tango de Guardia",t:"Toda mi vida",a:"Aníbal Troilo"}],
    "1950":[{g:"Tango",t:"Sur",a:"Aníbal Troilo"},{g:"Nuevo Tango",t:"Adiós Nonino",a:"Astor Piazzolla"},{g:"Tango Orquesta",t:"La Yumba",a:"Osvaldo Pugliese"}],
    "1970":[{g:"Rock Nacional",t:"Canción para mi muerte",a:"Sui Generis"},{g:"Prog Rock",t:"Seminare",a:"Serú Girán"},{g:"Folk Rock",t:"Muchacha (Ojos de Papel)",a:"Luis Alberto Spinetta"}],
    "1980":[{g:"Rock en Español",t:"Cuando pase el temblor",a:"Soda Stereo"},{g:"Ska Rock",t:"Mi Novia Se Cayó en un Pozo Ciego",a:"Los Fabulosos Cadillacs"},{g:"Pop Rock",t:"Demoliendo Hoteles",a:"Charly García"}],
    "NOW":[{g:"Trap",t:"Bzrp Music Sessions",a:"Bizarrap"},{g:"Latin Soul",t:"Mafiosa",a:"Nathy Peluso"},{g:"Rap",t:"Canguro",a:"Wos"}]}},
  {id:"mexicocity",name:"Mexico City",country:"Mexico",lat:19.43,lon:-99.13,coord:"19°26′N 99°08′W",hue:352,eras:{
    "1930":[{g:"Bolero",t:"Mujer",a:"Agustín Lara"},{g:"Ranchera",t:"La Tequilera",a:"Lucha Reyes"},{g:"Son Jarocho",t:"Lamento Jarocho",a:"Toña la Negra"}],
    "1940":[{g:"Mambo",t:"Que Rico el Mambo",a:"Pérez Prado and His Orchestra"},{g:"Mariachi Ranchera",t:"Ay, Jalisco, No Te Rajes",a:"Lucha Reyes"},{g:"Bolero",t:"Amor Perdido",a:"María Luisa Landín"}],
    "1950":[{g:"Ranchera",t:"Cien Años",a:"Pedro Infante"},{g:"Bolero",t:"Solamente una vez",a:"Agustín Lara"},{g:"Bolero Tropical",t:"Veracruz",a:"Toña la Negra"}],
    "1970":[{g:"Balada",t:"El Triste",a:"José José"},{g:"Rock Mexicano",t:"Chavo de Onda",a:"Three Souls in My Mind"},{g:"Psych Rock",t:"Lost in My World",a:"Los Dug Dug's"}],
    "1990":[{g:"Rock en Español",t:"La Ingrata",a:"Café Tacvba"},{g:"Alt Rock",t:"La Célula Que Explota",a:"Caifanes"},{g:"Rap Rock",t:"Gimme Tha Power",a:"Molotov"}],
    "NOW":[{g:"R&B",t:"Rosas",a:"Girl Ultra"},{g:"Cumbia Psicodélica",t:"El Mercado De Los Brujos",a:"Sonido Gallo Negro"},{g:"Indie Pop",t:"Berlin",a:"Little Jesus"}]}},
  {id:"kinshasa",name:"Kinshasa",country:"DR Congo",lat:-4.32,lon:15.31,coord:"04°19′S 15°19′E",hue:98,eras:{
    "1960":[{g:"African Jazz",t:"Indépendance Cha Cha",a:"Le Grand Kallé"},{g:"Rumba Congolaise",t:"On Entre OK, On Sort KO",a:"Franco"},{g:"Soukous",t:"Nakei Nairobi",a:"Tabu Ley Rochereau"}],
    "1970":[{g:"Rumba Rock",t:"Ana Lengo",a:"Papa Wemba"},{g:"Congolese Funk",t:"Nakomitunaka",a:"Verckys"},{g:"Zaiko Soukous",t:"Mbeya Mbeya",a:"Zaiko Langa Langa"}],
    "1980":[{g:"Rumba",t:"Mario",a:"Franco"},{g:"Kwassa Kwassa",t:"Sai",a:"Kanda Bongo Man"},{g:"Ndombolo",t:"Nina",a:"Pepe Kalle"}],
    "NOW":[{g:"Congotronics",t:"Malukayi",a:"Mbongwana Star"},{g:"Electro Kin",t:"Buka Dansa",a:"Kokoko!"},{g:"Afro-Punk",t:"Vie Eza",a:"Fulu Miziki"}]}},
  {id:"bamako",name:"Bamako",country:"Mali",lat:12.64,lon:-8.0,coord:"12°38′N 08°00′W",hue:48,eras:{
    "1970":[{g:"Mande Jazz",t:"Sunjata",a:"Rail Band"},{g:"Afro-Mande",t:"Mandjou",a:"Salif Keita"},{g:"Mali Blues",t:"Mali Twist",a:"Boubacar Traoré"}],
    "1990":[{g:"Wassoulou",t:"Diaraby Nene",a:"Oumou Sangaré"},{g:"Kora",t:"Kaira",a:"Toumani Diabaté"},{g:"Desert Blues",t:"Diaraby",a:"Ali Farka Touré"}],
    "2000":[{g:"Bamako Pop",t:"Beaux dimanches",a:"Amadou & Mariam"},{g:"Griot Orchestra",t:"Boulevard de l'Indépendance",a:"Toumani Diabaté's Symmetric Orchestra"},{g:"Kora Blues",t:"Kala",a:"Ali Farka Touré & Toumani Diabate"}],
    "2010":[{g:"Desert Rock",t:"Soubour",a:"Songhoy Blues"},{g:"Wassoulou Pop",t:"Nterini",a:"Fatoumata Diawara"},{g:"Ngoni Blues",t:"Ngoni Fola",a:"Bassekou Kouyaté"}],
    "NOW":[{g:"Mande Pop",t:"Bi Ye Tulonba Ye",a:"Rokia Koné"},{g:"Sahel Rock",t:"Diarabi",a:"Vieux Farka Touré"},{g:"Wassoulou Soul",t:"Wassulu Don",a:"Oumou Sangaré"}]}},
  {id:"istanbul",name:"Istanbul",country:"Turkey",lat:41.01,lon:28.98,coord:"41°01′N 28°59′E",hue:22,eras:{
    "1970":[{g:"Anadolu Rock",t:"Cemalim",a:"Erkin Koray"},{g:"Anatolian Pop",t:"Dağlar Dağlar",a:"Barış Manço"},{g:"Protest Folk",t:"Yaz Gazeteci Yaz",a:"Selda Bağcan"}],
    "1990":[{g:"Turkish Pop",t:"Hadi Bakalım",a:"Sezen Aksu"},{g:"Dance Pop",t:"Şımarık",a:"Tarkan"},{g:"Anadolu Folk",t:"Olmasa Mektubun",a:"Yeni Türkü"}],
    "2000":[{g:"Psychebelly Dub",t:"Bir Sana Bir de Bana",a:"BaBa ZuLa & Mad Professor"},{g:"Turkish Rock",t:"Senden Daha Güzel",a:"Duman"},{g:"Roman Fusion",t:"Surmat",a:"Laço Tayfa"}],
    "NOW":[{g:"Psych Anadolu",t:"Hologram",a:"Gaye Su Akyol"},{g:"Electronic Folk",t:"Sumeru",a:"Islandman"},{g:"Alt Rock",t:"En Güzel Yerinde Evin",a:"Büyük Ev Ablukada"}]}},
  {id:"cairo",name:"Cairo",country:"Egypt",lat:30.04,lon:31.24,coord:"30°02′N 31°14′E",hue:58,eras:{
    "1930":[{g:"Cinema Song",t:"Ya Wardet El Hob",a:"Mohamed Abdel Wahab"},{g:"Tarab",t:"Ala Balad El Mahbub",a:"Umm Kulthum"},{g:"Qasida",t:"Ayoha Al Raeh El Moged",a:"Umm Kulthum"}],
    "1940":[{g:"Cinema Song",t:"Ya Habibi Taala",a:"Asmahan"},{g:"Egyptian Orchestral",t:"Han El Wad",a:"Mohammed Abdel Wahab"},{g:"Modern Tarab",t:"Emta Te'oud",a:"Farid al-Atrash"}],
    "1950":[{g:"Tarab",t:"Ana Fi Entezarak",a:"Umm Kulthum"},{g:"Egyptian Pop",t:"Ahwak",a:"Abdel Halim Hafez"},{g:"Oud Tarab",t:"Law Tessma'eni Li Akher Marrah",a:"Farid al-Atrash"}],
    "1970":[{g:"Shaabi",t:"Zahma",a:"Ahmed Adaweyah"},{g:"Nubian Pop",t:"Shamandora",a:"Mohamed Mounir"},{g:"Nubian Funk",t:"Mabruk",a:"Ali Hassan Kuban"}],
    "2010":[{g:"Mahraganat",t:"Mahragan Wanady",a:"Sadat"},{g:"Alt Rock",t:"Basrah w Atooh",a:"Cairokee"},{g:"Electro Shaabi",t:"Ana Kadab",a:"Oka Wi Ortega"}],
    "NOW":[{g:"Egyptian Rap",t:"KARMA",a:"Abyusif"},{g:"Contemporary Folk",t:"Turning Back",a:"Dina El Wedidi"},{g:"Trap Shaabi",t:"Sallam Alay (feat. Khateeb)",a:"Molotof"}]}},
  {id:"rio",name:"Rio de Janeiro",country:"Brazil",lat:-22.91,lon:-43.17,coord:"22°55′S 43°10′W",hue:132,eras:{
    "1930":[{g:"Samba",t:"Com Que Roupa?",a:"Noel Rosa"},{g:"Marchinha",t:"O Que É Que a Baiana Tem?",a:"Carmen Miranda"},{g:"Samba-Exaltação",t:"Aquarela do Brasil",a:"Francisco Alves"}],
    "1940":[{g:"Samba-Canção",t:"Ai, Que Saudades da Amélia",a:"Ataulfo Alves"},{g:"Samba Praieiro",t:"Marina",a:"Dorival Caymmi"},{g:"Samba de Carnaval",t:"Praça Onze",a:"Herivelto Martins"}],
    "1950":[{g:"Bossa Nova",t:"Chega de Saudade",a:"João Gilberto"},{g:"Samba-Canção",t:"Canção do Amor Demais",a:"Elizeth Cardoso"},{g:"Choro",t:"Noites Cariocas",a:"Jacob do Bandolim"}],
    "1960":[{g:"Bossa Nova",t:"Desafinado",a:"João Gilberto"},{g:"Bossa",t:"Diz Que Fui Por Aí",a:"Nara Leão"},{g:"Samba Rock",t:"Mas Que Nada",a:"Jorge Ben"}],
    "1970":[{g:"Brazilian Soul",t:"Azul da Cor do Mar",a:"Tim Maia"},{g:"Samba Funk",t:"Taj Mahal",a:"Jorge Ben"},{g:"Bossa Nova",t:"Águas de Março",a:"Tom Jobim"}],
    "1990":[{g:"Funk Carioca",t:"Rio 40 Graus",a:"Fernanda Abreu"},{g:"Rap Rock",t:"Legalize Já",a:"Planet Hemp"},{g:"Reggae Rock",t:"Minha Alma",a:"O Rappa"}],
    "2000":[{g:"Funk Carioca",t:"Boladona",a:"Tati Quebra Barraco & DJ Marlboro"},{g:"Samba Rap",t:"Vai Vendo",a:"Marcelo D2"},{g:"Indie Rock",t:"O Vencedor",a:"Los Hermanos"}],
    "NOW":[{g:"Funk Pop",t:"Vai Malandra",a:"Anitta"},{g:"Baile Funk",t:"Cheguei",a:"Ludmilla"},{g:"Tropicália Nova",t:"Baile de Máscaras",a:"Bala Desejo"}]}},
  {id:"bangkok",name:"Bangkok",country:"Thailand",lat:13.75,lon:100.5,coord:"13°45′N 100°30′E",hue:88,eras:{
    "1970":[{g:"Thai Funk",t:"Aow Pai Pao",a:"Sroeng Santi"},{g:"Luk Thung",t:"Tang Ngarn Si Nong",a:"Dao Bandon"},{g:"Molam",t:"Mae Kha Som Tam",a:"Onuma Singsiri"}],
    "NOW":[{g:"Bedroom Pop",t:"Lover Boy",a:"Phum Viphurit"},{g:"Thai Rap",t:"Mirror Mirror",a:"Milli"},{g:"Molam",t:"Lam San Disco",a:"Paradise Bangkok Molam International Band"}]}}
];
PLACES.forEach(p=>{ p.lonR=p.lon*D2R; p.latR=p.lat*D2R; });

/* Одна настоящая обложка на весь мок-каталог: смотреть раскладку на живой картинке,
   а не на сером градиенте (2026-08-25). Каталог по PRD и так мок — арт на трек
   появится только с боевым каталогом. */
/* ── ОБЛОЖКА ТРЕКА (2026-08-25) ────────────────────────────────────────
   Настоящих обложек в проекте нет и не будет: права на арт — вне scope по PRD,
   как и само воспроизведение. Раньше на все 282 трека стояла одна картинка
   cover.png, то есть обложка не значила ничего. Теперь она РИСУЕТСЯ из тех же
   данных, что и свет за глобусом: цвет ведёт пара «место + жанр» (trackTint),
   а раскладка пятен — хеш названия и артиста. Один и тот же трек всегда даёт
   одну и ту же обложку, разные треки внутри места — разные.
   Три слоя: тёплое пятно (источник света), холодный отсвет в углу и тёмная
   диагональная подложка, чтобы вещь оставалась ночной, а не «карнавальной». */
/* Размытие подслоя обложки (заведено 2026-08-25) осмысленно только для
   ГЕНЕРАТИВНОГО арта: он рисуется из данных трека, и блюр делает из градиента
   мягкое пятно. На настоящей обложке тот же блюр съедает картинку целиком —
   поэтому у резолвленных треков размытие снимается. */
const isRealArt = e => !!(audioFor(e) && audioFor(e).art);
/* настоящему арту не нужны ни размытие, ни вылет за края (вылет существует
   ТОЛЬКО чтобы блюр не давал виньетку; без блюра он просто режет обложку) */
const artVars = e => isRealArt(e) ? ';--art-blur:0px;--art-bleed:0' : '';
function trackArt(p,e){
  if(!p) return 'linear-gradient(160deg,#1a1a1a,#101010)';
  /* Настоящая обложка, если трек разрезолвлен. Генеративная остаётся фолбэком:
     нет резолва или нет сети — рисуем из данных трека, как и раньше.
     100 px из ответа API поднимаем до 600: тот же CDN отдаёт любой размер. */
  const m=audioFor(e);
  /* ⚠️ Кавычки ОДИНАРНЫЕ, и это не косметика: значение уходит не только в
     style.setProperty, но и в HTML-атрибут шаблонной строкой (коллаж и строки
     плейлиста). Двойная кавычка обрывала там style="…", атрибут ломался целиком,
     и обложки в плейлисте не появлялись вовсе. Поймано Николаем 2026-08-30;
     раньше не всплывало — генеративный арт это градиент, кавычек в нём нет. */
  if(m && m.art) return "url('"+m.art.replace('100x100bb','600x600bb')      /* Apple отдаёт любой размер */
                                     .replace('500x500-','1000x1000-')+"')"; /* Deezer тоже */
  const t=trackTint(p,e), base=(((t.hue%360)+360)%360);
  let n=0; const key=(e? e.t+'|'+e.a : p.id);
  for(let i=0;i<key.length;i++) n=(n*31+key.charCodeAt(i))>>>0;
  /* Свет ставим В УГОЛ, а не в центр: центральное пятно читалось как лава-лампа,
     а не как обложка. Угол выбирается хешем — четыре варианта. */
  /* сдвиги ТОЛЬКО беззнаковые (>>>): обычный >> приводит число к int32 и на
     половине хешей уходит в минус — индекс массива тогда отрицательный, угол
     получался undefined, слой ломался, и вся обложка схлопывалась в чёрное */
  const q=n%4, px=(q===0||q===3)?16+((n>>>3)%12):74+((n>>>3)%12),
               py=(q<2)?18+((n>>>7)%12):76+((n>>>7)%12);
  const ang=[14,52,118,166][(n>>>5)%4];
  const hA=base, hB=(base+128+((n>>>11)%84))%360;        /* второй тон — дуотон, не радуга */
  const sat=44+((n>>>13)%18);                             /* приглушённо: ночь важнее цвета */
  const l1=Math.round(Math.max(34,Math.min(52, t.light*100*0.58)));
  return 'radial-gradient(44% 48% at '+px+'% '+py+'%, hsl('+hA+' '+(sat+20)+'% '+l1+'%), transparent 70%),'
       + 'radial-gradient(52% 56% at '+(100-px)+'% '+(100-py)+'%, hsl('+hB+' '+sat+'% 27%), transparent 74%),'
       + 'linear-gradient('+ang+'deg, hsl('+hA+' '+Math.round(sat*0.7)+'% 15%), #101010 84%)';
}
/* Короткие биографии артистов каталога. Пишутся вручную вместе с треками:
   заглушка «Bio coming soon.» остаётся только страховкой на случай, если трек
   добавили, а текст — нет. Объём поднят 2026-08-25 по просьбе Николая
   («накинь побольше текста»): было 41 био по одному предложению на 261 артиста,
   стало 261 по 2–3 предложения, и в карточке наконец появляется «see more». */
const ARTISTS={
  "Alexander Tsfasman":"He led the Soviet Union's first professional jazz orchestra and played piano with a virtuosity that made Moscow radio bearable in the 1930s. Officials disliked the music and used him anyway, because nobody else could swing a dance band that well.",
  "Leonid Utesov":"An Odessa-born singer who invented Soviet 'tea-jazz' — jazz softened just enough to survive the censors. His film The Merry Fellows made him the country's first mass-market pop star.",
  "Nikolay Batalov & Isaac Dunaevsky":"Dunaevsky wrote the marches that defined 1930s Soviet cinema; Batalov sang them on screen. Their songs were designed to be whistled by millions and still are.",
  "Bulat Okudzhava":"A Moscow poet who sang his own verse over a plain guitar and started the bard movement almost by accident. He avoided both protest and propaganda, writing instead about courtyards, trolleybuses and small human loyalty.",
  "Eddie Rosner Variety Orchestra":"A German-Polish trumpeter who fled Hitler, became a Soviet star, then spent years in the camps for trying to leave. His orchestra played swing so precise that Stalin's officials both banned it and demanded it.",
  "Oleg Lundstrem Orchestra":"Founded in Shanghai in 1934 by Russian émigrés, this band returned to the USSR and outlasted the state itself, holding the record as the world's longest continuously working jazz orchestra.",
  "Eduard Artemyev":"He built the electronic scores for Tarkovsky's Solaris, Stalker and Mirror on Soviet-made synthesisers, and made machines sound like weather rather than technology.",
  "David Tukhmanov":"His 1976 album On the Wave of My Memory smuggled prog rock and medieval poetry past the Soviet record industry and sold millions anyway.",
  "Zvuki Mu":"Pyotr Mamonov fronted them as a twitching, muttering figure who looked like a Moscow drunk and performed like an art object. Brian Eno produced their international album in 1989.",
  "Grazhdanskaya Oborona":"Yegor Letov recorded most of it himself in a Siberian flat on domestic tape decks, and the deliberate wall of distortion became the sound of Soviet punk.",
  "Bravo":"They revived rockabilly in Moscow when it was three decades out of date everywhere else, and Zhanna Aguzarova sang it in a voice that belonged to no Soviet category at all.",
  "Nogu Svelo!":"Maxim Pokrovsky wrote pop songs with nonsense syllables and unstable structures, which is how a track built on the phrase Kharu Mamburu became a national hit.",
  "Ivan Kupala":"They cut field recordings of village singers into dance tracks, giving Russian folk voices a second life in 1990s clubs without turning them into costume.",
  "Korol i Shut":"Horror-story punk from Saint Petersburg, built on Mikhail Gorshenyov's theatrical howl and songs that read like folk tales gone wrong.",
  "Tesla Boy":"Moscow synth-pop that took 1980s production seriously rather than ironically, and found an audience abroad before one at home.",
  "IC3PEAK":"A duo whose songs about death and state violence made them a target for cancelled concerts and police visits across Russia, which only widened their audience.",
  "Samoe Bolshoe Prostoe Chislo":"Kirill Ivanov's project turned deadpan spoken Russian into dance music, somewhere between poetry reading and a house track.",
  "Kate NV":"Kate Shilonosova builds bright, precise miniatures out of synths and household sounds, closer to Japanese ambient pop than to anything Russian radio plays.",
  "Nina Kraviz":"A trained dentist from Irkutsk who became one of techno's most recognisable DJs, and kept the raw, unpolished edge of her early Moscow records.",
  "Poyushchiye Gitary":"The USSR's first beat group, they turned Western guitar pop into something the state would license — and then filled stadiums with it.",
  "Владимир Маркин":"He made his name singing old Russian romances and city songs in a plain, unadorned way, at a moment when Soviet pop was reaching for orchestras.",
  "Edita Piekha":"Born in France to Polish parents, she sang in Leningrad with an accent she never lost, and it became her signature rather than her handicap.",
  "Kino":"Viktor Tsoi wrote short, cold songs about waiting and change that a generation heard as prophecy. His death at 28 sealed them into that role permanently.",
  "Akvarium":"Boris Grebenshchikov ran the band as a moving workshop for forty years, mixing Russian poetry, reggae, Celtic folk and Buddhism without apology.",
  "Nol":"Fyodor Chistyakov played accordion in a punk band, which should not have worked and did, giving Leningrad rock its strangest and funniest record.",
  "Tequilajazzz":"Yevgeny Fyodorov's band brought loud, textured alternative rock to Russia in the 1990s and stayed uninterested in radio formats.",
  "Spitfire":"A Petersburg ska and surf band that played instrumental music fast enough to make lyrics unnecessary.",
  "Shortparis":"They perform closer to physical theatre than to rock, and their songs about crowds and obedience have made their concerts genuinely uncomfortable to watch, on purpose.",
  "Human Tetris":"Post-punk built on cold guitar lines, sung in English by a Moscow band that sounded like it had grown up in Manchester.",
  "Pompeya":"Indie pop with a sunlit, almost Californian production, written in Moscow and mostly heard abroad.",
  "Otava Yo":"They play Russian village music on modern instruments with a straight face and a sense of humour, and their videos have travelled far past the folk audience.",
  "Vtgnike":"A Petersburg producer working in footwork and broken rhythm, released on European labels long before that music had a Russian scene.",
  "Sofiya Rotaru":"A Ukrainian singer of Moldovan descent who became one of the biggest stars in the Soviet Union, and made Chervona Ruta the song of a generation.",
  "Володимир Івасюк":"He wrote Chervona Ruta at twenty and gave Ukrainian pop its own melodic language. He was found dead in a forest near Lviv in 1979, a case still unresolved.",
  "Vopli Vidopliassova":"VV took Ukrainian village melodies and played them at punk speed, which in the late 1980s read as both a joke and a declaration.",
  "Василь Жданкін":"A kobzar who sang old Cossack songs in the tradition of blind travelling minstrels, and won Chervona Ruta's first festival in 1989.",
  "Braty Gadyukiny":"From Lviv, they sang in Ukrainian with a Galician accent and played rock'n'roll about drunks and gardens when that was a political act.",
  "Okean Elzy":"Svyatoslav Vakarchuk's band became the largest rock act in Ukraine, and its concerts turned into public gatherings that meant more than music.",
  "Perkalaba":"A Carpathian band mixing trembita horns and village brass with punk, sung in Hutsul dialect that most Ukrainians only half understand.",
  "DakhaBrakha":"They call it ethno-chaos: four musicians in tall wool hats reworking Ukrainian ritual songs with African and Indian percussion.",
  "Onuka":"Nata Zhyzhchenko plays the bandura and the sopilka against electronics, and performed the result at Eurovision to an audience of millions.",
  "alyona alyona & Jerry Heil":"A former kindergarten teacher and a YouTube singer who between them made Ukrainian-language rap and pop that no longer needed to explain itself.",
  "KAZKA":"Their song Plakala became the first Ukrainian-language track to pass a hundred million streams, which settled a long argument about the language's commercial reach.",
  "Stanislav Tolkachev":"A Kyiv producer whose techno is deliberately unstable and hard to mix, released on labels that value that difficulty.",
  "Rustavi Choir":"Georgia's best-known polyphonic ensemble, whose recording of Chakrulo was placed on the Voyager Golden Record and left the solar system.",
  "Vocal Ensemble Gordela":"A women's ensemble singing Georgian polyphony in a style close to village practice rather than the concert hall.",
  "Nani Bregvadze":"A Tbilisi singer who made Russian romances her own, and performed them with an aristocratic restraint that outlasted Soviet pop fashion.",
  "Иверия":"A Tbilisi jazz-rock ensemble that fused Georgian melody with electric instruments and became a Soviet-wide hit act in the 1970s.",
  "Orera":"The band that turned Georgian vocal harmony into a Soviet stage act, and launched Vakhtang Kikabidze's career.",
  "Giya Kancheli":"A Georgian composer whose symphonies work in extreme quiet punctuated by violence. He also wrote film music that most of the USSR knew by heart without knowing his name.",
  "Nino Katamadze & Insight":"She sings mostly without words, in a voice that moves between jazz and Georgian folk, and improvises differently every night.",
  "Tamara Gverdtsiteli":"A Tbilisi singer with a wide operatic range who worked across Georgian, Russian and French repertoire.",
  "Ensemble Basiani":"A choir of the Georgian Orthodox Patriarchate that studies and performs regional polyphonic traditions with archival precision.",
  "HVL":"A resident of Tbilisi's Bassiani club, whose records mix machine funk and Caucasian melody without treating either as decoration.",
  "Mgzavrebi":"Their name means travellers, and their folk-rock became the soundtrack to Georgia's post-Soviet generation.",
  "Natalie Beridze":"A Georgian electronic composer working in fragile, granular textures, released on European experimental labels since the early 2000s.",
  "Aram Khachaturian":"His Sabre Dance escaped the ballet it was written for and became one of the most recognisable pieces of the twentieth century, to his own irritation.",
  "HOVHANNES BADALYAN":"He sang in the ashugh tradition of travelling Armenian poets, and his voice is still the reference recording for much of that repertoire.",
  "Ruben Matevosyan & Rouben Matevosian":"An Armenian singer who spent decades performing folk songs on state radio and made them sound personal rather than official.",
  "Djivan Gasparyan":"He played the duduk for eight decades and made the instrument internationally famous, appearing on scores from Gladiator to Blade Runner 2049.",
  "Raisa Mkrtchyan":"An Armenian singer who worked with the Yerevan radio jazz orchestra, moving between estrada and folk material.",
  "Levon Malkhasyan":"Known as Malkhas, he opened Yerevan's central jazz club and played piano there most nights for decades.",
  "The Bambir":"Armenian rock that began in the Soviet era and continued through a second generation of the same family, keeping folk modes inside loud arrangements.",
  "Arthur Meschian":"An architect by training, he wrote Armenian rock songs of unusual severity and then stopped performing for years at a time.",
  "Vardan Hovanissian & Emre Gültekin":"An Armenian duduk player and a Turkish saz player performing together, which in that repertoire is itself the statement.",
  "Tigran Hamasyan":"He plays jazz piano with Armenian folk modes and progressive metal rhythms, at a technical level that has made him a reference for younger players.",
  "Sona Rubenyan":"An Armenian singer who came out of folk ensemble work and moved into contemporary arrangements of traditional songs.",
  "Seyid Shushinski":"One of the great mugham singers of the twentieth century, from Shusha in Karabakh, a town that was the training ground for Azerbaijani vocal music.",
  "Bahram Mansurov":"A tar player whose recordings preserved the classical mugham repertoire in performances that scholars still use as reference.",
  "Vagif Mustafazadeh & Mugam":"Mustafazadeh invented jazz mugham, grafting Azerbaijani modal improvisation onto bebop harmony. He died on stage at 39.",
  "Vagif Mustafazadeh":"The pianist who fused mugham with jazz and won Monaco's composition competition posthumously, with his daughter Aziza continuing the work.",
  "Aziza Mustafa Zadeh":"She sings and plays piano in her father's jazz-mugham idiom, with a vocal range that treats the voice as another improvising instrument.",
  "Alim Qasimov Ensemble & Kronos Quartet":"A meeting between Azerbaijan's leading mugham singer and an American string quartet, recorded without either side simplifying its practice.",
  "Fərqanə Qasımova & Alim Qasimov":"Father and daughter performing mugham together, a transmission of the tradition that happens in public rather than in private lessons.",
  "Elnare Abdullayeva":"An Azerbaijani singer working in mugham and folk repertoire, known for performing the older dastgah forms at full length.",
  "Isfar Sarabski":"A Baku pianist who won the Montreux Jazz competition at 20 and writes music that keeps mugham phrasing inside a jazz trio.",
  "Nisa":"An Azerbaijani singer whose recent work sets mugham vocal ornament against electronic production.",
  "Vic Mensa":"He came up in the same Chicago circle as Chance the Rapper and then spent years refusing to settle into one sound, moving between house-inflected pop and hard-edged rap. 'Down On My Luck' is the record that made people pay attention.",
  "Marko Nastić":"Serbia's best-known techno DJ built a scene in Belgrade during years when almost nothing about the city made that easy. His own records are stripped-back and functional, made for rooms rather than headphones.",
  "tofubeats":"A producer from Kobe who started uploading tracks as a teenager and never quite left the internet's sense of humour behind. His records treat J-pop, house and sampled nostalgia as the same material.",
  "Dariush":"Dariush Eghbali sang about political imprisonment before the revolution and about exile after it, and the second half of that career has now lasted far longer than the first. For Iranians who left, his voice is the one that does the remembering.",
  "Klaus Schulze":"He passed through both Tangerine Dream and Ash Ra Tempel before deciding he preferred working alone with banks of synthesisers. His pieces run twenty minutes or more because he was interested in what happens after a listener stops waiting for the next thing to arrive.",
  "Anri":"Her early-eighties records sit exactly where Japanese pop absorbed American AOR and made it breezier. 'Last Summer Whisper' is the one that keeps getting rediscovered by people who found city pop through a recommendation algorithm.",
  "Brown Eyed Girls":"They began as a vocal group and then released 'Abracadabra', a piece of dark electropop that looked nothing like anything else on Korean television in 2009. The choreography ended up more famous than the group.",
  "Machito":"Frank Grillo put Cuban rhythm sections and jazz horns in the same room and left them there to argue. 'Tanga', worked out on the stand in 1943, is usually named as the first Afro-Cuban jazz recording.",
  "Onuma Singsiri":"A luk thung and molam singer whose records were cut for audiences in Thailand's northeast rather than for Bangkok radio. Reissue labels caught up with her several decades late.",
  "Taeko Onuki":"She left Sugar Babe after a single album and made records quieter and stranger than the city pop happening around her. 'Sunshower' was ignored in 1977 and is now the album everybody names.",
  "99 Posse":"A Neapolitan collective born in the Officina 99 squat. They put rap in Neapolitan dialect over dub bass and ragga, and spoke about unemployment and police more plainly than anyone in the Italian mainstream.",
  "Alan Sorrenti":"A Neapolitan who began with prog records sung in a high, almost feminine voice. He later turned to disco and became a star, but those early albums are still counted among the strangest things Italian music has produced.",
  "Almamegretta":"A Neapolitan group that joined dub and trip-hop to Mediterranean modes. They sang in dialect and called their sound the dub of the South — Naples as a port, not a postcard.",
  "Arthur Mafokate":"A South African musician called the father of kwaito. His early tracks took the tempo of house, slowed it down, and put the language of Soweto's streets on top.",
  "Ata Ebtekar":"An Iranian electronic composer who also records as Sote. He builds pieces from Persian modes and digital noise, showing that tradition and synthesis are not opposites.",
  "Bachar Mar-Khalifé":"A Lebanese pianist and singer, son of the oud master Marcel Khalife. He folds Arabic melody into electronics and minimalism, often reworking songs he heard as a child.",
  "Baden Powell":"A Brazilian guitarist who joined samba to Afro-religious rhythm and classical technique. The afro-sambas he wrote with Vinicius de Moraes changed what a Brazilian guitar could sound like.",
  "BaianaSystem":"A group from Salvador built around the guitarra baiana and the bass rigs of carnival. Their concerts are a street procession translated into club sound.",
  "Batsumi":"A South African jazz ensemble of the 1970s working at the edge of free jazz and African rhythm. They recorded little, and those records became collector's legend.",
  "Binomio de Oro":"A Colombian vallenato duo who carried the accordion music of the coast to the whole country. Their ballads still play at every celebration.",
  "Black Coffee":"A DJ and producer from Durban who became the face of African house worldwide. He plays with one hand after a car accident in his youth, and built a sound in which house is unmistakably South African.",
  "Bonga":"An Angolan singer who fled the country with semba recordings in his suitcase. His hoarse voice and songs about colonial rule became a voice of independence.",
  "Boredoms":"An Osaka collective that started in chaotic noise-punk and arrived at trance-like rituals with several drummers at once. No two of their records resemble each other.",
  "Breakout":"A Polish blues-rock band of the 1970s led by Tadeusz Nalepa. They played blues in Polish as though it had always belonged there.",
  "Brenda Fassie":"A South African singer they called the Madonna of the townships. Her bubblegum hits filled every dance floor, and her bluntness on stage and off made her a folk hero.",
  "Brodka":"A Polish singer who walked away from the pop machine to make her own records. Her albums bind Slavic folk material to cold electronics.",
  "Brother Resistance":"A Trinidadian poet and musician, one of the inventors of rapso — calypso rhythm carrying spoken word. His lyrics about workers and streets read like a manifesto.",
  "Bunji Garlin":"A Trinidadian artist who brought rap phrasing and dancehall into soca. His \"Differentology\" carried the carnival rhythm far beyond the Caribbean.",
  "Calixto Ochoa":"A Colombian accordionist and composer whose vallenatos became folk songs. People sing them without knowing anyone wrote them.",
  "Charif Megarbane":"A Lebanese musician recording instrumental miniatures between library music and Arabic modes. He works almost alone and releases records by the dozen.",
  "Czesław Niemen":"A Polish singer and composer with an enormous range and a taste for experiment. His \"Dziwny jest ten świat\" is a hit and a protest song at the same time.",
  "DJ Lag":"A producer from Durban, one of the architects of gqom — a heavy, almost empty South African rhythm. His beats are built on the gaps as much as the hits.",
  "DJ Maphorisa":"A South African producer present at the beginning of amapiano. He works as the hub of the scene, gathering vocalists, DJs and pianists around a single groove.",
  "DJ Znobia":"An Angolan producer whose early kuduro beats defined the genre's sound. He worked on cheap software and turned the limits into a recognisable style.",
  "Daara J":"A Senegalese hip-hop group rapping in Wolof, French and English. They argue that rap returned to Africa, where it left with the griot tradition.",
  "Don Omar":"A Puerto Rican artist among those who carried reggaeton onto world stages. His \"Danza Kuduro\" joined a Caribbean rhythm to Angolan kuduro.",
  "EABS":"A Polish collective replaying the legacy of Polish jazz through hip-hop and electronics. They began by reworking Krzysztof Komeda.",
  "Ekatarina Velika":"A Belgrade band and the central voice of Yugoslav post-punk. Milan Mladenović's dark lyrics and Margita Stefanović's keyboards read as a chronicle of a country coming apart.",
  "Fairuz":"A Lebanese singer whose voice became the symbol of Beirut. She sang the Rahbani brothers' songs about home, parting and daybreak — still played across the city every morning.",
  "Filhos de Gandhy":"An afoxé carnival block from Salvador, founded by dock workers in 1949. They march in white to ijexá rhythms, and the procession itself is the statement.",
  "Fruko y sus Tesos":"The Colombian orchestra of Julio Ernesto Estrada. They made salsa Colombian rather than imported, and gave it \"El Preso\", a song everyone knows.",
  "Gabriel Romero":"A Colombian singer whose version of \"La Piragua\" became a folk standard. His 1970s records are a school of tropical arrangement.",
  "Ginger Root":"Cameron Lew's project, playing at 1980s Japanese city pop with irony and affection. He calls his own style aggressive elevator soul.",
  "Googoosh":"An Iranian singer and actress, the symbol of pre-revolutionary pop culture. After 1979 she was silent for more than twenty years, and that silence became part of her story.",
  "Grupo Niche":"A Colombian salsa group from Cali founded by Jairo Varela. Their \"Cali Pachanguero\" is effectively the city's anthem.",
  "Harumi Miyako":"A Japanese enka singer with a strong, almost operatic voice. She sang about port towns and separation, and became one of the genre's central figures.",
  "Idoli":"A Belgrade new wave band with ironic lyrics and pop melodies. Their album \"Odbrana i poslednji dani\" still appears on lists of the best Yugoslav records.",
  "Ismaël Lô":"A Senegalese singer and guitarist they called the African Dylan. His \"Tajabone\" is known far beyond Senegal.",
  "J Balvin":"A Colombian artist from Medellín, among those who made reggaeton global without switching to English. He works with colour and image as deliberately as with sound.",
  "Kabza De Small":"A South African producer called the king of amapiano. His records set the template for the genre: log drum, keys and a great deal of air.",
  "Kiosk":"An Iranian band working from the diaspora. They play rock songs with satirical lyrics about life held between two countries.",
  "Kourosh Yaghmaei":"An Iranian musician who joined Persian modes to fuzz guitar. His \"Gol-e Yakh\" became one of the most recognisable Persian songs of the century.",
  "Larissa Luz":"A singer from Salvador working between Afro-Brazilian tradition and contemporary pop. Her lyrics address race and the body directly.",
  "Lena Kovačević":"A Serbian singer trained in jazz, working between pop music and Balkan material.",
  "Lepa Brena":"The biggest star of late Yugoslavia. Her career is its own chapter in how pop music held a disintegrating country together.",
  "Liberato":"An anonymous Neapolitan artist whose face is unknown. He sings in dialect over contemporary electronics, and the anonymity became part of the myth of the new Naples.",
  "Lord Kitchener":"A Trinidadian calypsonian who arrived in Britain on the Windrush and sang \"London Is the Place for Me\" on the gangway. His songs are a chronicle of Caribbean migration.",
  "Lord Shorty":"The Trinidadian musician who invented soca by joining calypso to the island's Indian rhythms. He later took the name Ras Shorty I and turned to spiritual music.",
  "Maanam":"A Polish new wave band with Kora on vocals. Their songs became the unofficial soundtrack of the Polish 1980s.",
  "Machel Montano":"A Trinidadian artist performing since childhood who largely defined modern soca. His carnival shows draw tens of thousands.",
  "Mahlathini and the Mahotella Queens":"A South African ensemble pairing Mahlathini's growling bass with a female vocal trio. Their mbaqanga filled township dance floors for decades.",
  "Malombo":"A South African group joining jazz to Venda rhythms and malombo drums. Their music was a way of speaking about African tradition during apartheid.",
  "Margareth Menezes":"A singer from Salvador who carried axé onto international stages. She joins Afro-Brazilian rhythm to pop delivery.",
  "Mario Merola":"The king of the Neapolitan sceneggiata, a form in which a song is staged as a small play. He sang about honour, prison and family.",
  "Mashrou' Leila":"A Lebanese band that began as a student project in Beirut. Their songs about love, freedom and the city made them a generation's voice, and a target for bans.",
  "Mighty Sparrow":"A Trinidadian calypsonian known as the genre's king. His lyrics combine humour, politics and exact observation.",
  "Mohammad-Reza Shajarian":"An Iranian master of classical vocal music and an authority for several generations. His \"Morgh-e Sahar\" was sung in the squares as a song of hope.",
  "Mohsen Namjoo":"An Iranian musician who set classical Persian poetry against blues and rock. For this he was called an innovator and a blasphemer in equal measure.",
  "Nelson Freitas":"A Cape Verdean singer working between kizomba and contemporary R&B. His songs play on every Lusophone dance floor.",
  "Nino D'Angelo":"A Neapolitan singer who began as a popular idol in a blond wig and later remade himself as a writer. His path is a story about a low genre earning respect.",
  "Novos Baianos":"A Brazilian collective who lived as a commune and played samba, rock and choro at once. Their \"Acabou Chorare\" is regularly named the best Brazilian album ever made.",
  "Nu Genea":"A Neapolitan duo joining disco, funk and Mediterranean song. Their records sound like a Naples summer seen from inside a club.",
  "Nuova Compagnia di Canto Popolare":"A Neapolitan ensemble that returned the old folk songs of Campania to the stage. They worked as researchers and as musicians at the same time.",
  "Olodum":"A carnival block from Salvador that invented samba-reggae. Their drums are heard at carnival and on records by Paul Simon and Michael Jackson.",
  "Orchestra Baobab":"A Dakar orchestra joining Cuban rumba to Wolof tradition. They played at the Baobab club and defined the sound of 1970s Senegal.",
  "Os Kiezos":"An Angolan ensemble central to the history of semba. Their 1970s recordings are the foundation of Luanda's dance tradition.",
  "Parviz Meshkatian":"An Iranian master of the santur and a composer. His work with Shajarian is considered a summit of twentieth-century Persian classical music.",
  "Paulo Flores":"An Angolan singer continuing the semba tradition in modern arrangements. His lyrics are a chronicle of post-war Luanda.",
  "Perfect":"A Polish rock band whose songs were sung like anthems in the 1980s. Anyone who grew up then knows \"Nie płacz Ewka\".",
  "Pino Daniele":"A Neapolitan musician who joined blues, jazz and Neapolitan song. He sang in dialect and made it a language of contemporary music.",
  "Puto Prata":"An Angolan kuduro artist among those who carried the genre from the outskirts of Luanda to the stages of Lisbon.",
  "Rambo Amadeus":"A Montenegrin musician and satirist who worked out of Belgrade. He mixes jazz, turbo-folk and stand-up, mocking all of it at once.",
  "Ramesh":"An Iranian singer of the 1970s with a low, instantly recognisable voice. She recorded songs poised between pop and Persian tradition.",
  "Renegades Steel Orchestra":"A Trinidadian steel band, among the strongest at carnival. Their arrangements of \"Pan in A Minor\" became a model for the island's orchestras.",
  "Repetitor":"A Belgrade trio playing post-punk loud and unadorned. They sing in Serbian about the city they grew up in, holding the stage with bass and drums alone.",
  "Republika":"A Polish band led by Grzegorz Ciechowski, joining cold wave to theatricality. Their black-and-white aesthetic was recognisable at a glance.",
  "Sabah":"A Lebanese singer and actress with a career spanning half a century. She appeared in dozens of films and recorded hundreds of songs, remaining a symbol of lightness.",
  "Sebem":"An Angolan DJ and dancer, one of those who gave kuduro its name and shape. He started at street parties in Luanda.",
  "Sergio Bruni":"A Neapolitan singer they called the voice of Naples. He collected and performed the city's classic songs as both archivist and artist.",
  "Shonen Knife":"An Osaka trio playing punk songs about food, cats and daily life. Kurt Cobain took them on tour, and they have played worldwide ever since.",
  "Sipho Mabuse":"A South African musician who joined mbaqanga to electronics and disco. His \"Burnout\" played on radio stations across the continent.",
  "Super Diamono":"A Senegalese band joining mbalax to soul and reggae. They were the voice of Dakar's urban youth.",
  "Trinidad All Stars":"One of Trinidad's oldest steel bands, founded in the 1930s. Their arrangements are a school for every orchestra on the island.",
  "Ultra Bidé":"A Japanese band from Osaka working at the border of punk and the avant-garde. They played hard and unpredictably long before that became a method.",
  "Wadih El Safi":"A Lebanese singer with a career of more than seventy years. His voice is treated as the standard in tarab, and his songs about the mountain village are known by heart.",
  "Waldemar Bastos":"An Angolan singer and guitarist who spent years in exile. His songs join semba, Portuguese song and Brazilian guitar.",
  "Yasei Collective":"A Japanese band sitting between jazz, funk and math rock. They play complicated music you can still dance to.",
  "Yola Semedo":"An Angolan singer who has performed since childhood. She joins semba and kizomba to contemporary production.",
  "Youssou N'Dour":"The Senegalese singer who made mbalax a world genre. Abroad his voice is known from \"7 Seconds\"; at home he is heard for the songs in Wolof.",
  "Yvonne Chaka Chaka":"A South African singer known as the Princess of Africa. Her \"Umqombothi\" is sung from Johannesburg to Nairobi.",
  "Zamilska":"A Polish producer building heavy industrial electronics. She works almost without vocals, on density of sound alone.",
  "Zbigniew Namysłowski":"A Polish saxophonist and one of the founders of the Polish jazz school. He set jazz against folk time signatures.",
  "Ziad Rahbani":"A Lebanese composer and playwright, son of Fairuz. He joined Arabic song to jazz and funk, and in his plays spoke about the war as songs would not.",
  "Étoile de Dakar":"The Dakar band that Youssou N'Dour came out of. They joined Cuban orchestration to mbalax and set the sound of the late-1970s city scene.",
  "Šarlo Akrobata":"A Belgrade trio that lasted under two years and left one album. It was enough to set the tone for the whole Yugoslav new wave.",

  "Amália Rodrigues":"The voice that carried fado out of Lisbon's back streets and onto the world's stages. From the 1950s to the '70s she defined what saudade sounds like — a longing for something that may never have existed. Portugal mourned her as a national figure.",
  "Cesária Évora":"Cape Verde's barefoot diva, who sang morna in Creole and made an island grief legible everywhere. She performed without shoes as a gesture toward the poor women of her country, and found international fame only in her fifties.",
  "Hermínia Silva":"A fadista and stage actress who sang Lisbon itself — its trams, its neighbourhoods, its saints' festivals. Her fado castiço is bright and theatrical where Amália's is tragic, and it still soundtracks the city's June street parties.",
  "António Variações":"Portugal's avant-pop eccentric, a barber from the north who arrived in 1980s Lisbon and spliced fado phrasing onto new wave. He recorded only two albums before dying young, and Portuguese pop has been quoting him ever since.",
  "Alfredo Marceneiro":"The carpenter who became fado's great classicist. He sang in a rough, unhurried voice built for the small taverns of Alfama rather than concert halls, and set the template that later fadistas either follow or deliberately break.",
  "Maria Teresa de Noronha":"An aristocrat who sang fado on radio for decades and rarely performed commercially. Her fado menor is restrained and precise — the courtly end of a genre born in the docks, and a reference point for singers who prize discipline over drama.",
  "Buraka Som Sistema":"The Lisbon collective that took Angolan kuduro, sped it up and pushed it through European club systems in the late 2000s. Their sound is the sound of a colonial history running backwards — the suburbs teaching the capital how to dance.",
  "Mariza":"Born in Mozambique, raised in Lisbon's Mouraria, she brought fado to arenas without hollowing it out. Her fado novo keeps the form's grief while borrowing arrangements from jazz and world stages.",
  "Da Weasel":"Portuguese hip hop's first crossover act, rapping in Portuguese when the market assumed rap had to be American. Across the 1990s and 2000s they made hip hop tuga a normal thing for a Lisbon teenager to hear on the radio.",
  "Dino d'Santiago":"A Cape Verdean-Portuguese singer who fuses morna and funaná with electronic production. His work is explicitly about a new Lisbon — African, young, and no longer asking permission to sound that way.",
  "Branko":"Producer and co-founder of Buraka Som Sistema, now running the Enchufada label as a switchboard for global bass. His records treat Lisbon as a port city where Angolan, Brazilian and Caribbean rhythms dock and mix.",
  "Batida":"The project of Pedro Coquenão, built from Angolan samples, field recordings and Lisbon club rhythms. It is dance music with an archive attached — semba and kuduro loops carrying the memory of where they came from.",
  "Françoise Hardy":"The cool, melancholic face of French yé-yé, and one of the few of that generation who wrote her own songs. Her records sound like Paris in the rain: understated, slightly withheld, impossible to date precisely.",
  "Serge Gainsbourg":"French provocateur and master melodist who moved through chanson, yé-yé, reggae and funk without ever losing his sneer. He built pop songs that scandalised the country and then outlived the scandal.",
  "Daft Punk":"The Parisian duo that defined French touch — house built from filtered disco samples, delivered from behind helmets. They turned anonymity into an image and made 1970s French records sound like the future.",
  "Stardust":"A one-off French touch supergroup with a single, eternal house record. 'Music Sounds Better with You' is three minutes of looped disco euphoria and remains the genre's shortest, cleanest argument.",
  "Mr. Oizo":"Quentin Dupieux's alias — deliberately broken electro built on stuttering, ugly-on-purpose basslines. He is also a film director, and his tracks have the same deadpan absurdism as his movies.",
  "Justice":"The Parisian duo who made French electro loud, distorted and rock-shaped. Where Daft Punk polished disco, Justice ran it through amplifiers until it clipped, and a generation of club records followed.",
  "Air":"Two men from Versailles who made French touch soft, analogue and cinematic. Their records lean on Moogs, Rhodes and space — closer to library music and film scores than to the dancefloor.",
  "Sébastien Tellier":"A French songwriter who treats chanson as an excuse for cosmic synth arrangements. Somewhere between a lounge crooner and a prog composer, always with a straight face.",
  "Christine and the Queens":"Héloïse Letissier's project, built on French chanson bones and American R&B choreography. The work is about shifting identity — voice, name and persona all treated as changeable.",
  "Rone":"A Parisian electronic producer whose tracks feel like scores for imagined films — melodic, atmospheric, built for headphones and large rooms alike. He works often with dance, theatre and cinema.",
  "L'Impératrice":"A Parisian band reviving French nu-disco with live bass, string pads and cool detachment. Their records sound like a 1978 discotheque rebuilt by people who studied it rather than lived it.",
  "Neu!":"The Düsseldorf duo that invented motorik — a straight, hypnotic beat that removes swing and rewards patience. Half a century of post-punk, ambient and electronic music has been built on their groove.",
  "Can":"Cologne experimentalists who rewired rock from the inside, editing long improvisations into taut grooves. Their rhythm section is one of the most sampled and imitated in European music.",
  "Basic Channel":"The Berlin duo who laid the foundations of dub techno — Jamaican echo chambers applied to a German drum machine. Their records are more space than sound, and they set the tone for the city's minimal decades.",
  "Maurizio":"A Basic Channel alias, and the point where Berlin techno became a study in reduction. The tracks strip everything but hiss, chord and pulse, and still fill a room.",
  "Apparat":"Sascha Ring's project, moving between microhouse, ambient and songwriting. He gave Berlin's electronic scene a melancholy, human voice — literally, once he started singing.",
  "Modeselektor":"Berlin's most cheerfully unruly electronic duo, mixing rave, hip hop and bass music without regard for scene etiquette. Their live shows are closer to a party than a performance.",
  "Ellen Allien":"Producer, DJ and founder of BPitch Control, one of Berlin's defining labels. Her music tracks the city's shift from post-wall euphoria to sleek, harder techno.",
  "Nils Frahm":"A Berlin pianist and producer who mics felt pianos so closely you hear the mechanism. His work sits between neoclassical composition and club culture, and he built his own studio in a former GDR broadcasting complex to do it.",
  "Ben Klock":"A resident DJ whose long, patient sets helped define the sound of Berlin's most famous club. His records are stripped, physical techno made for rooms with no clocks.",
  "Marcel Dettmann":"A Berlin techno producer and DJ whose sets are hard, dry and rhythm-first. He is one of the architects of the city's post-2000 sound, where texture matters more than melody.",
  "Fela Kuti":"The founder of Afrobeat and a permanent thorn in the side of Nigeria's military governments. He fused highlife, jazz and James Brown funk into twenty-minute grooves used explicitly as political weapons.",
  "Prince Nico Mbarga":"A Nigerian-Cameroonian highlife musician whose 'Sweet Mother' became one of the best-selling records in African history. His guitar style is light and circular — highlife at its most affectionate.",
  "BLO":"A Nigerian power trio of the 1970s, mixing rock, funk and Afro rhythms. They played with the volume of Western rock bands and the syncopation of Lagos.",
  "William Onyeabor":"A Nigerian synth-funk mystery who pressed his own records, then walked away from music entirely. His machine-driven grooves went unheard for decades before being reissued to a startled audience.",
  "Steve Monite":"A Nigerian boogie artist of the 1980s whose 'Only You' resurfaced through reissue culture and became a global dancefloor staple decades late. Afro-disco at its most weightless.",
  "Wizkid":"One of the artists who carried Afrobeats out of Lagos and into global pop. His delivery is relaxed almost to the point of whispering, which turned out to be the sound of the export version.",
  "Davido":"A Nigerian Afropop star whose records are built for stadium singalongs. He is part of the generation that made Lagos a pop capital rather than a regional scene.",
  "P-Square":"Twin brothers whose slick, R&B-shaped Nigerian pop dominated the 2000s and 2010s across the continent. They proved a Lagos act could out-produce imported American radio.",
  "Burna Boy":"A Nigerian artist who calls his sound Afrofusion — Afrobeat, dancehall and rap held together by his grandfather's connection to Fela Kuti's world. He treats the diaspora as a single audience.",
  "Tems":"A Nigerian singer and producer whose smoky low register reset what Afrobeats vocals could sound like. She emerged from the alté scene, Lagos's art-school wing.",
  "Asake":"A Lagos artist who folds fuji chant and amapiano log drums into Afrobeats. His records sound like a street procession that happens to have a producer.",
  "Mulatu Astatke":"The father of Ethio-jazz, who studied in London and New York and brought vibraphone and Latin jazz back to Addis Ababa. He fitted them to Ethiopian pentatonic scales, and the result sounds like nothing else on either continent.",
  "Mariya Takeuchi":"A Japanese singer-songwriter whose 'Plastic Love' became the accidental anthem of city pop's internet revival. The song is upbeat and heartbroken at the same time, which is the genre in one line.",
  "Miki Matsubara":"A Japanese singer whose 'Stay With Me' found a second life decades later through short-video culture. Her disco-inflected city pop is bright, brisk and unmistakably late-'70s Tokyo.",
  "Happy End":"The band that proved rock could be sung in Japanese without sounding wrong, an argument the country was genuinely having in 1970. Their folk rock is gentle, literary and full of a Tokyo being demolished and rebuilt around them.",
  "Cornelius":"Keigo Oyamada's project and a cornerstone of Shibuya-kei — pop assembled from records, with the seams left visible. His albums are collages that somehow still sound like songs.",
  "Susumu Yokota":"A Japanese producer who moved from techno into ambient collage, layering samples of choirs, folk and field recordings. His records are dreamlike rather than atmospheric — closer to sleep than to background.",
  "Boom Boom Satellites":"A Japanese duo welding big beat and electronic rock to live drums. Their music was built for scale, and it soundtracked a decade of Japanese film and anime.",
  "Perfume":"A Japanese trio whose technopop is heavily processed, choreographed to the frame and produced by Yasutaka Nakata. They made auto-tune an aesthetic rather than a repair tool.",
  "Kyary Pamyu Pamyu":"A Harajuku pop star whose kawaii records are sugary on the surface and structurally strange underneath. She turned a Tokyo street style into an export.",
  "Sakanaction":"A Japanese band that welds dance production to rock instrumentation and literate Japanese lyrics. Their live shows treat the stage as a club and the band as a set of synths.",
  "Sanullim":"A Korean trio of brothers who invented their own psychedelic rock in the 1970s, largely cut off from Western scenes. The isolation shows — the guitar tones and song shapes are unlike anything abroad.",
  "Han Dae-soo":"A Korean folk singer who returned from New York with long hair and protest songs, and was promptly banned. His records became underground currency during the dictatorship years.",
  "Seo Taiji and Boys":"The group that broke Korean pop open in 1992 by putting rap, metal and new jack swing on national television. Almost every structural feature of modern K-pop traces back to them.",
  "Deux":"A Korean duo who brought new jack swing and hip hop dance to the early-'90s mainstream. Their records still get sampled by artists who were born after they disbanded.",
  "BIGBANG":"The group that made K-pop swagger rather than sweetness, writing and producing much of their own material. They defined the sound of the genre's first global decade.",
  "2NE1":"A Seoul quartet whose K-hip-hop edge and street styling stood deliberately apart from girl-group convention. They were loud in a market that rewarded polish.",
  "NewJeans":"A Seoul group built on light, retro-leaning production — Jersey club, UK garage, 2000s R&B — with almost no vocal bombast. They made restraint sound like a novelty.",
  "LE SSERAFIM":"A Korean dance-pop group whose records are tight, percussive and built around confidence rather than cuteness. The choreography is the argument.",
  "aespa":"A Seoul group whose hyperpop-adjacent production is aggressive and metallic, wrapped in a fictional universe of virtual counterparts. Pop as world-building.",
  "Asha Bhosle":"One of the most recorded voices in history, singing playback for Indian cinema across seven decades. Her range runs from cabaret numbers to devotional song, often in the same year.",
  "R.D. Burman":"The composer who dragged Bollywood scores into funk, disco and psychedelia, using found objects and studio tricks as instruments. His arrangements are why 1970s filmi records still get sampled.",
  "A. R. Rahman":"The composer who rebuilt Indian film music around synthesis, sampling and studio craft from his Chennai home studio, then took it to Hollywood. His scores mix Sufi devotional forms with electronics.",
  "Shankar–Ehsaan–Loy":"A Mumbai composing trio whose soundtracks balance rock instrumentation with classical Indian arrangement. They scored much of the 2000s Bollywood mainstream.",
  "Vishal–Shekhar":"A Bollywood composing duo whose pop-forward soundtracks defined multiplex-era Hindi cinema. Their songs are engineered for radio life outside the film.",
  "Isaac Hayes":"The Memphis-born writer and arranger who turned soul into widescreen cinema, with orchestras, long spoken intros and a hard funk core underneath. His film work made the wah-wah guitar a narrative device.",
  "James Brown":"The man who reorganised popular music around the first beat of the bar. Everything after him — funk, disco, hip hop, house — is downstream of the rhythmic decision he made in the mid-1960s.",
  "Grandmaster Flash":"A Bronx DJ who worked out, on hardware he modified himself, how to hold a break forever. His cutting and back-spinning turned the turntable into an instrument and hip hop into a technique.",
  "Afrika Bambaataa":"The Bronx DJ who spliced Kraftwerk to funk drums and produced electro. He also framed hip hop as a culture with rules and a mission rather than just a party.",
  "Incredible Bongo Band":"A studio project whose 'Apache' break became one of the most sampled passages in recorded music. The band barely existed as a band; the drum break outlived everything.",
  "Miles Davis":"A trumpeter who reinvented jazz roughly every five years and took the rest of the music with him each time. His modal records slowed harmony down until space became the subject.",
  "Thelonious Monk":"A pianist whose sense of rhythm and dissonance sounded like a mistake until it became the standard. His compositions are now jazz's common language, and they still trip people up.",
  "Charles Mingus":"A bassist and composer who wrote large, unruly pieces full of gospel, blues and open political anger. His bands were famously volatile, which was partly the point.",
  "The Velvet Underground":"A New York band that sold very few records and changed everything anyway. Their art rock brought drone, noise and unglamorous subject matter into pop songs.",
  "The Ronettes":"A New York girl group whose records were built into towering walls of sound. Ronnie Spector's voice cut through all of it — tough, wounded and instantly recognisable.",
  "John Coltrane":"A saxophonist who pushed jazz from harmonic complexity into spiritual search. His late work is less about virtuosity than about sustained, exhausting devotion.",
  "LCD Soundsystem":"James Murphy's project, welding dance-punk to disco with a middle-aged man's self-awareness. The band made anxiety about being uncool into legitimate dancefloor material.",
  "The Strokes":"The band that made New York guitar music fashionable again in 2001 — tight, treble-heavy songs delivered with studied indifference. A decade of imitators followed within months.",
  "Interpol":"A New York band that took post-punk's cold architecture and rebuilt it downtown. Two guitars, high bass lines and a baritone voice, all in charcoal grey.",
  "Vampire Weekend":"A New York band that borrowed West African guitar figures and chamber-pop arrangements for songs about privilege and doubt. The result is brighter than its subject matter.",
  "Blood Orange":"Dev Hynes's project — alt-R&B assembled from 1980s synths, saxophone and spoken interludes. The records read as essays on Blackness, queerness and city loneliness.",
  "A$AP Rocky":"A Harlem rapper who imported Houston's screwed tempos into New York and dressed the result in high fashion. His records treat production as image-making.",
  "The Temptations":"Motown's most versatile vocal group, moving from sweet ballads to psychedelic soul as the decade darkened. Five voices, each capable of carrying the lead.",
  "Martha and the Vandellas":"A Detroit group whose records were harder and hotter than the Motown norm. 'Dancing in the Street' escaped its label and became something else entirely in the summer of 1964.",
  "The Supremes":"The most commercially successful act Motown produced, and the proof of the label's crossover strategy. Their records are pop engineering of the highest order.",
  "Derrick May":"One of the Belleville Three who invented Detroit techno, describing it as George Clinton and Kraftwerk stuck in an elevator. His tracks are melancholy machines.",
  "Inner City":"A Detroit project pairing techno production with full soul vocals, which is how techno reached daytime radio. The songs are euphoric without being weightless.",
  "Cybotron":"Juan Atkins's early project, where electro and science fiction met in a post-industrial Detroit. The records imagine the city as a machine that outlived its workers.",
  "Danny Brown":"A Detroit rapper whose voice and structures are as abrasive as his subject matter is bleak. He treats hedonism and depression as the same story.",
  "Kyle Hall":"A young Detroit producer whose house is raw, hand-played and deliberately unpolished. He belongs to the generation that inherited the city's machines and roughened them up again.",
  "Moodymann":"A Detroit producer who runs soul, disco and gospel samples through deep house, and guards his own mystique carefully. His records feel like a party you were let into by mistake.",
  "Pérez Prado":"The bandleader who packaged mambo for the world, with brass stabs and his own grunts as punctuation. Cuban in origin, Mexican by career, global by result.",
  "Antonio Arcaño":"A Havana flautist and bandleader whose orchestra pushed danzón toward the rhythmic breaks that would become mambo. The changes happened in his rhythm section.",
  "Orquesta Aragón":"A charanga orchestra of violins and flute that has been playing Cuban dance music since the 1930s. Elegant, unhurried and impossible to sit through.",
  "Buena Vista Social Club":"A group of veteran Cuban musicians brought back into a studio in 1996, most of them long retired. The record made son a global phenomenon and gave its players a second career in their seventies.",
  "Ibrahim Ferrer":"A Cuban bolero singer who was shining shoes when he was called back to record. His voice is light and unforced, carrying songs that are mostly about loss.",
  "Os Mutantes":"The Tropicália band that treated pop as a laboratory, building their own effects when equipment was unavailable. Their records are joyful and slightly deranged.",
  "Caetano Veloso":"A central figure of Tropicália, writing songs that argue with Brazil while loving it. He was exiled for the trouble and returned to become an institution.",
  "Jorge Ben":"The Rio songwriter whose guitar swing sits between samba and rock. His grooves have been borrowed by everyone from Brazilian rockers to American hip hop producers.",
  "Gilberto Gil":"A Tropicália founder who later became Brazil's culture minister. His songwriting moves between baião, reggae and MPB without ever losing its Bahian pulse.",
  "CSS":"A São Paulo band whose indie dance records were funny, cheap-sounding and joyful. They came out of the city's art and internet scene in the mid-2000s.",
  "Bonde do Rolê":"A Brazilian group who took baile funk's rhythm and rock's noise and mixed them with deliberate crudeness. Their records are loud, short and unserious.",
  "Céu":"A São Paulo singer whose MPB is folded into dub, hip hop and electronics. Her arrangements are spacious in a way that owes as much to Jamaica as to Brazil.",
  "Burning Spear":"Winston Rodney's project, and roots reggae at its most sermonic. His songs are about Marcus Garvey, memory and repatriation, delivered over horns and a slow, immovable groove.",
  "Augustus Pablo":"The melodica player who gave dub its most haunting lead voice. His records are built from space, echo and a small toy instrument used with total seriousness.",
  "Bob Marley & The Wailers":"The group that carried reggae from Trench Town to the world without softening what the songs were about. Their records are protest, devotion and love songs at once.",
  "Desmond Dekker":"The Jamaican singer whose 'Israelites' became one of the first reggae-adjacent international hits. His ska and rocksteady records document Kingston's rude-boy years from the inside.",
  "Derrick Morgan":"A foundational Jamaican singer who moved with the music from ska into rocksteady. He recorded prolifically enough that his catalogue works as a timeline of the island's tempo slowing down.",
  "Toots and the Maytals":"The band whose 1968 single put the word 'reggae' on a record for the first time. Toots Hibbert sang gospel and soul with a Kingston accent, and the genre took its name from him.",
  "Sean Paul":"The Jamaican artist who made dancehall a fixture on global pop radio in the 2000s. His delivery is rhythmic rather than melodic, and it survives every translation.",
  "Elephant Man":"A dancehall entertainer whose bashment records are built for the dance itself — call, response and instruction. Loud, cartoonish and precisely engineered.",
  "Sizzla":"A prolific Rastafarian singer whose roots dancehall combines militant lyrics with a light, singing delivery. He has recorded more albums than most artists record songs.",
  "Chronixx":"A leading voice of the reggae revival, returning to roots instrumentation and consciousness after decades of digital dancehall. His records are warm, live and deliberately old-fashioned.",
  "Protoje":"A Jamaican artist whose modern roots blend reggae with hip hop phrasing and rock textures. He functions as a hub for the island's younger conscious scene.",
  "Jah9":"A Jamaican singer and yoga teacher whose jazz-inflected roots reggae is slow and meditative. She calls her approach jazz on dub, which is accurate.",
  "Koffee":"A Jamaican artist who broke through as a teenager with bright, gospel-touched reggae. Her records are optimistic in a genre that rarely allows it.",
  "Popcaan":"A dancehall star whose melodic, atmospheric records pushed the genre toward pop without leaving Kingston's sound systems behind.",
  "Lila Iké":"A Jamaican singer whose reggae soul is intimate and unhurried, closer to R&B songwriting than to sound-system culture.",
  "The Kinks":"A London band whose songs are closer to short stories about English life than to rock and roll. Ray Davies wrote about suburbs, class and river light while his brother played some of the first distorted guitar on record.",
  "The Rolling Stones":"A London blues band that turned into the template for the touring rock group. Their mid-'60s records are darker and stranger than their reputation suggests.",
  "Dusty Springfield":"A London singer who took American soul seriously enough to record in Memphis. Her voice is breathy and enormous at once, and she fought her label to release Black artists in Britain.",
  "The Clash":"The London punk band that refused to stay punk, absorbing reggae, dub, rockabilly and hip hop within four years. Their records treat the city as a political map.",
  "The Jam":"A mod revival band whose songs are furious, tightly wound vignettes of English life. Paul Weller wrote about commuter trains and tube stations as if they were battlefields.",
  "David Bowie":"A London artist whose method was reinvention — glam, soul, Berlin electronics, pop — each time convincingly. He made changing yourself an artistic discipline rather than a marketing move.",
  "Kate Bush":"An English songwriter who produced her own records when women were rarely allowed near the desk. Her art pop is theatrical, literary and structurally unpredictable.",
  "Sade":"A London band fronted by Sade Adu, playing sophisti-pop with jazz restraint. Their records are famously smooth and quietly devastating underneath.",
  "Soul II Soul":"A London sound system turned recording collective, built on a slow, heavy breakbeat and gospel-scale vocals. They made a distinctly British Black pop that owed nothing to America.",
  "Blur":"A London band who spent the '90s writing about English suburbia with affection and contempt in equal measure. Their Britpop period is a character study of a country talking itself up.",
  "Goldie":"A London producer who gave drum and bass its ambition, stretching the genre into long-form composition. His work came out of graffiti culture and kept its scale.",
  "Underworld":"A British group whose progressive house records are built on repetition and half-spoken lyrics. Their live sets treat a track as something that grows rather than plays.",
  "Dizzee Rascal":"The east London teenager whose debut invented grime's public face — brittle synths, 140 bpm, and a voice with no interest in sounding American. He won the Mercury Prize at nineteen.",
  "Wiley":"Grime's chief architect, whose eskibeat instrumentals gave the genre its cold, sparse blueprint. He built a scene by giving away beats and starting arguments.",
  "Amy Winehouse":"A north London singer who wrote jazz-shaped confessions and delivered them with a '60s girl-group swing. Her records are funny and devastating in the same line.",
  "Little Simz":"A north London rapper whose albums are structured like films, with orchestral arrangements and recurring characters. She writes about family, doubt and the industry with equal precision.",
  "Sault":"A London collective who release records with almost no promotion, no interviews and sometimes for free. The music is soul, funk and post-punk fused into something urgent about Black British life.",
  "Fred again..":"A London producer who builds house tracks from voice notes, overheard conversation and diary entries. The result is dance music that behaves like a journal.",
  "Joy Division":"A Manchester band who turned post-industrial dread into something spacious and beautiful. Their two albums remain the reference point for post-punk's cold end.",
  "New Order":"What Joy Division became — a band that put a drum machine where the grief was and accidentally invented a bridge between rock and the dancefloor.",
  "The Smiths":"A Manchester band whose jangling guitars and mordant lyrics defined British indie for a generation. Johnny Marr's playing is the reason the misery is danceable.",
  "Oasis":"The Manchester band that made Britpop enormous, writing anthems designed for football grounds. Their appeal was working-class confidence delivered at maximum volume.",
  "Happy Mondays":"The Madchester band who welded loose funk grooves to indie rock and dance culture. They sounded like a party that had lost track of what day it was.",
  "The Chemical Brothers":"A duo formed in Manchester who took hip hop breaks, psychedelia and rave and made big beat. Their records are built for large rooms and long build-ups.",
  "Doves":"A Manchester band whose indie rock is expansive and weather-beaten, with a rhythm section that came out of dance music. Their songs are about distance and northern light.",
  "Elbow":"A Manchester band whose alt rock leans on Guy Garvey's warm, conversational lyrics. They write big songs about small kindnesses.",
  "Badly Drawn Boy":"Damon Gough's project — folk pop assembled from fragments, tape hiss and orchestral asides. His records feel handmade even when they are lavish.",
  "Muddy Waters":"The Mississippi bluesman who plugged in when he reached Chicago and made the blues loud enough for a bar. Nearly all rock guitar descends from what he did at Chess.",
  "Howlin' Wolf":"A Chicago bluesman with a voice like a diesel engine and a stage presence that terrified audiences. His records are the rawest thing the electric blues produced.",
  "Bo Diddley":"The Chicago guitarist who contributed a rhythm so distinctive it carries his name. He built his own rectangular guitars and made rhythm the point of the song.",
  "The Impressions":"A Chicago vocal group whose Curtis Mayfield-led records carried the civil rights movement's soundtrack. Gospel harmony turned into political message without ever preaching.",
  "Etta James":"A singer who moved between blues, soul and rhythm and blues with equal authority. Her Chess recordings are the standard against which torch singing is measured.",
  "Buddy Guy":"A Chicago guitarist whose wild, dynamic playing frightened his own label into holding his records back. Everyone who came after him copied what they eventually released.",
  "Frankie Knuckles":"The DJ who gave house music its name by playing it in a Chicago club called the Warehouse. He rebuilt disco with drum machines for a crowd that had been abandoned by the mainstream.",
  "Marshall Jefferson":"A Chicago producer whose 'Move Your Body' put piano into house music and set the genre's emotional template. He was working at the post office at the time.",
  "Phuture":"The Chicago trio who discovered acid house by misusing a bass machine designed for something else entirely. That squelching sound reorganised European nightlife.",
  "Chance the Rapper":"A Chicago rapper who built a career on free mixtapes, gospel choirs and refusing to sign. His records are joyful in a scene that rarely rewards it.",
  "Chief Keef":"A teenager from Chicago's South Side whose drill records reset rap's mood toward blank menace. The style he made at sixteen is now global.",
  "Jamila Woods":"A Chicago poet and singer whose neo-soul records are explicitly about Black womanhood, the city and self-preservation. Each song on one album is named after a figure she draws strength from.",
  "Noname":"A Chicago rapper whose jazz rap is quiet, fast and dense with argument. She half-speaks her verses, which makes the politics land harder.",
  "Nnamdï":"A Chicago multi-instrumentalist who plays nearly everything on his records and refuses to settle into a genre. Art pop, math rock and rap in the same three minutes.",
  "Fats Domino":"The New Orleans pianist whose rolling triplets sold as many records as anyone in the 1950s. His rhythm and blues is gentle where rock and roll was aggressive.",
  "Professor Longhair":"The pianist who put rumba into New Orleans piano and defined the city's rhythmic accent. Almost every local player since has copied his left hand.",
  "Little Richard":"The performer who recorded his defining sides in a New Orleans studio with local session players. He sang rock and roll at a pitch and speed nobody had attempted.",
  "The Meters":"The house band who defined New Orleans funk with almost nothing — a guitar figure, a bass line, and drums that leave gaps everywhere. Those gaps became sample material for decades.",
  "Dr. John":"Mac Rebennack's project, mixing New Orleans piano, voodoo theatre and swamp funk. He arrived in a feathered headdress and stayed for fifty years.",
  "Allen Toussaint":"The producer, writer and pianist behind much of New Orleans soul. He wrote hits for other people so consistently that his own records are still underrated.",
  "Juvenile":"A New Orleans rapper whose bounce-inflected records made the city's rhythm audible nationally. His delivery is pure local accent.",
  "Master P":"The founder of No Limit, who built a New Orleans rap empire by owning the distribution as well as the music. Business strategy as artistic statement.",
  "Rebirth Brass Band":"A New Orleans brass band that carried the second-line tradition forward by absorbing funk and hip hop into it. They still play the street parades they came from.",
  "Trombone Shorty":"A New Orleans bandleader raised in Tremé who fuses brass band tradition with rock and funk. He has been performing since childhood and plays like it.",
  "Tank and the Bangas":"A New Orleans band whose soul fusion runs through spoken word, funk and children's-story surrealism. Tarriona Ball narrates as much as she sings.",
  "Big Freedia":"The queen of New Orleans bounce, whose call-and-response records are built entirely for movement. She took a hyper-local queer club form to national pop.",
  "Aníbal Troilo":"A bandoneón player and bandleader who kept tango danceable while the music grew more sophisticated around him. His orchestra was the finishing school for a generation of Buenos Aires musicians.",
  "Astor Piazzolla":"The bandoneonist who took tango away from the dancefloor and into the concert hall, and was hated for it at home for years. Nuevo tango absorbed jazz harmony and classical form without losing the instrument's grief.",
  "Osvaldo Pugliese":"A pianist whose orchestra played tango with a heavy, dragging pulse that dancers still treat as the hardest test. He ran the band as a cooperative and was jailed repeatedly for his politics.",
  "Sui Generis":"The duo that gave Argentine rock nacional its folk-shaped early voice. Their songs were poetic enough to survive censorship and popular enough to fill stadiums.",
  "Serú Girán":"An Argentine supergroup whose prog-tinged songwriting was aimed squarely at life under the dictatorship. The arrangements are complex; the message was not.",
  "Luis Alberto Spinetta":"Argentina's most revered rock songwriter, whose lyrics read as poetry and whose chords rarely go where expected. He founded several defining bands and never repeated himself.",
  "Soda Stereo":"The Buenos Aires trio that made rock en español a continental language. Their sound moved from new wave brightness to dense, layered rock across a decade.",
  "Los Fabulosos Cadillacs":"An Argentine band that ran ska, rock and Latin brass through a socially sharp lens. Their live shows are closer to a carnival than a rock concert.",
  "Charly García":"A central figure of Argentine rock — pianist, provocateur and songwriter behind several of its defining bands. His solo records are pop with the wiring exposed.",
  "Bizarrap":"An Argentine producer whose numbered studio sessions turned a YouTube format into a global chart machine. Each track is a portrait of the guest artist as much as a beat.",
  "Nathy Peluso":"An Argentine artist who moves between salsa, rap and soul with theatrical force. Her records treat genre as costume, changed at will.",
  "Wos":"A Buenos Aires rapper who came out of freestyle battle culture and turned it into album-length writing. His delivery still carries the speed of the plaza.",
  "Pedro Infante":"A singer and film star who became Mexico's most beloved popular figure. His rancheras are the emotional register of Mexican cinema's golden age.",
  "Agustín Lara":"A composer and pianist whose boleros are performed across the Spanish-speaking world. He wrote songs about cities he had never visited, convincingly enough that they adopted him.",
  "Toña la Negra":"A Veracruz-born singer whose contralto carried Lara's boleros into tropical territory. She was one of the great Afro-Mexican voices of the era.",
  "José José":"Mexico's 'Prince of Song', whose baladas are technically formidable and emotionally unguarded. His life became as public a story as his records.",
  "Three Souls in My Mind":"A Mexico City band who kept rock alive in Spanish through the years when the state effectively banned it. Their records are blunt, loud and working-class.",
  "Los Dug Dug's":"A Mexican psych rock band whose records mixed English and Spanish and heavy fuzz. They were part of the scene that Avándaro's festival both created and doomed.",
  "Café Tacvba":"A Mexico City band who treat Mexican folk forms, punk and electronics as a single available palette. Each album is a different argument about what Mexican rock can be.",
  "Caifanes":"A Mexico City band whose dark, new wave-inflected rock carried Mexican imagery and instrumentation. They gave rock en español its gothic wing.",
  "Molotov":"A Mexico City band mixing rap and rock with deliberately obscene, politically pointed lyrics in Spanglish. They have been censored, sued and continuously popular.",
  "Girl Ultra":"A Mexico City singer whose R&B is soft, nocturnal and sung in Spanish. She is part of a generation reclaiming the genre from English-language default.",
  "Sonido Gallo Negro":"A Mexico City band playing psychedelic cumbia on theremin, organ and reverb. The result sounds like a lost soundtrack to a film that was never shot.",
  "Little Jesus":"A Mexico City indie pop band whose songs are bright, guitar-led and full of romantic disappointment. Their records sound like the city's younger, greener neighbourhoods.",
  "Le Grand Kallé":"The Congolese bandleader whose 'Indépendance Cha Cha' became the anthem of African decolonisation in 1960. His African Jazz turned Cuban rumba into something distinctly Congolese.",
  "Franco":"Guitarist, bandleader and the towering figure of Congolese rumba, who led OK Jazz for three decades. His guitar lines are conversational, and his songs range from satire to state praise.",
  "Tabu Ley Rochereau":"A Congolese singer and composer who modernised rumba into soukous, with a light, high voice and an ear for pop structure. He wrote thousands of songs.",
  "Papa Wemba":"A Congolese singer who fused rumba with rock and became the figurehead of the sapeur movement. His voice is one of the most recognisable in African music.",
  "Verckys":"A Congolese saxophonist and producer who put James Brown's funk into Kinshasa dance music. He later ran a label that shaped the city's 1970s output.",
  "Zaiko Langa Langa":"The Kinshasa band that stripped rumba of horns, sped it up and gave it to the young. Almost every subsequent Congolese star passed through their ranks.",
  "Kanda Bongo Man":"A Congolese singer whose kwassa kwassa made soukous fast, guitar-led and instantly danceable across Africa and Europe.",
  "Pepe Kalle":"A Congolese singer with an enormous voice and stage presence to match, central to the ndombolo era. His band was one of Kinshasa's biggest live draws.",
  "Mbongwana Star":"A Kinshasa group who put the city's rumba lineage through distortion, drum machines and noise. The result is defiantly unpicturesque.",
  "Kokoko!":"A Kinshasa collective building instruments out of scrap and playing electronic dance music on them. Necessity turned into an aesthetic argument.",
  "Fulu Miziki":"A Kinshasa Afro-punk collective whose instruments and costumes are made entirely from waste. The performance is ecological protest and party at once.",
  "Rail Band":"The house band of Bamako's railway hotel, and the crucible for Malian modern music. They set Mande epic poetry to electric instruments.",
  "Salif Keita":"A Malian singer of noble descent who was rejected for being albino and became a griot anyway. His voice is high, piercing and unmistakable.",
  "Boubacar Traoré":"A Malian guitarist whose songs blend Mande melody with something close to the Mississippi blues. He worked as a labourer for years between periods of fame.",
  "Oumou Sangaré":"A Malian singer from the Wassoulou region whose songs argue openly about polygamy, arranged marriage and women's independence. She is also a businesswoman and hotelier.",
  "Toumani Diabaté":"A Malian kora player from a long griot line whose technique redefined the instrument's possibilities. He collaborated across flamenco, blues and orchestral music.",
  "Ali Farka Touré":"A Malian guitarist whose playing revealed the shared root system between West African music and the American blues. He farmed rice between recordings.",
  "Songhoy Blues":"A Malian band formed by musicians displaced when music was banned in the north. Their desert rock is loud, urgent and explicitly about return.",
  "Fatoumata Diawara":"A Malian singer and actress whose Wassoulou-rooted songs are wrapped in contemporary production. She sings about migration, tradition and choice.",
  "Bassekou Kouyaté":"A Malian ngoni player who amplified an ancient lute and gave it a wah pedal. His band turns griot music into something that behaves like a rock group.",
  "Rokia Koné":"A Malian singer known as the Rose of Bamako, whose Mande pop pairs traditional melody with electronic production.",
  "Vieux Farka Touré":"A Malian guitarist who took up his father's instrument against his wishes and pushed the desert sound toward rock. The lineage is audible; the volume is not inherited.",
  "Erkin Koray":"The father of Anadolu rock, who put a fuzz pedal on Turkish modal melodies in the late 1960s. He also built his own electric saz.",
  "Barış Manço":"A Turkish musician and television presenter whose Anatolian pop reached every household. He wrote children's songs and psychedelic epics with the same conviction.",
  "Selda Bağcan":"A Turkish singer whose protest folk got her imprisoned repeatedly. Her records pair traditional saz with fuzz bass and unambiguous political anger.",
  "Sezen Aksu":"The dominant figure in modern Turkish pop, as a songwriter for others as much as a performer. Several generations of Turkish singers exist because she wrote for them.",
  "Tarkan":"A Turkish pop star whose records crossed into European charts in the late 1990s. The production is dance pop; the melodic phrasing stays Turkish.",
  "Yeni Türkü":"A Turkish group who set literary lyrics to Anatolian and Mediterranean folk forms. Their songs became standards of the country's thoughtful pop.",
  "Gaye Su Akyol":"An Istanbul singer whose psychedelic Anatolian rock is theatrical, sci-fi tinged and politically pointed. She calls her world a fantastic parallel Turkey.",
  "Islandman":"An Istanbul project blending electronic production with Anatolian folk instruments and field recordings. The live band plays it as trance rather than fusion.",
  "Büyük Ev Ablukada":"An Istanbul band whose alt rock is jittery, wordy and full of Turkish irony. They emerged from the city's independent scene of the 2010s.",
  "Umm Kulthum":"The Star of the East, whose monthly radio concerts stopped traffic across the Arab world. Single songs ran for an hour, built on repetition and the crowd's response.",
  "Abdel Halim Hafez":"An Egyptian singer and film star whose romantic songs defined the Nasser era's mood. His voice was light where Umm Kulthum's was monumental.",
  "Farid al-Atrash":"A Syrian-Egyptian composer, oud virtuoso and film star whose tarab compositions remain standards. He performed his own instrumental solos on screen.",
  "Ahmed Adaweyah":"The singer who brought shaabi — working-class Cairo street music — onto cassette and into every taxi. The establishment disliked him; the city did not.",
  "Mohamed Mounir":"An Egyptian singer of Nubian background whose pop absorbs Nubian rhythm, jazz and reggae. He is called simply El King in Egypt.",
  "Ali Hassan Kuban":"A Nubian musician who relocated to Cairo and put brass and electric instruments behind Nubian wedding music. The result travels as funk.",
  "Sadat":"A Cairo artist central to mahraganat, the auto-tuned street electronic music of the city's informal neighbourhoods. Banned by the musicians' syndicate, played everywhere regardless.",
  "Cairokee":"A Cairo rock band whose songs became associated with the 2011 uprising. Their alt rock is melodic and their lyrics keep getting them censored.",
  "Oka Wi Ortega":"An Egyptian duo who pushed electro shaabi from wedding parties into film soundtracks and charts. The sound is cheap, fast and joyful by design.",
  "Abyusif":"A Cairo rapper with a deadpan flow and dark production. He is one of the defining voices of Egypt's independent rap wave.",
  "Dina El Wedidi":"An Egyptian singer who reworks folk repertoire with contemporary arrangement. She apprenticed with a Nubian master and treats tradition as living material.",
  "Molotof":"An Egyptian producer merging trap with shaabi melodies and mahraganat energy. His records are built for headphones and street speakers alike.",
  "João Gilberto":"The guitarist and singer who invented the bossa nova beat by breaking samba's rhythm across his fingers. He sang almost under his breath, and the world leaned in.",
  "Nara Leão":"The 'muse of bossa nova' who then abandoned it for protest song, arguing that the music had grown too comfortable. Her voice is small, clear and unsentimental.",
  "Tim Maia":"The Rio singer who brought American soul home and made it Brazilian, in a career full of scandal, cult religion and enormous records. His voice could carry any of it.",
  "Tom Jobim":"The composer at bossa nova's centre, whose harmonies made Brazilian song part of the international jazz repertoire. He wrote about water, longing and Rio's light.",
  "Fernanda Abreu":"A Rio singer who fused funk carioca with pop and rock, mapping the city's favela and beach cultures onto the same record.",
  "Planet Hemp":"A Rio band whose rap rock argued loudly for drug policy reform and against police violence. They were arrested for the trouble.",
  "O Rappa":"A Rio band mixing reggae, rock and rap with lyrics about police brutality and life in the periphery. Their songs are anthems in Brazil and almost unknown outside it.",
  "Anitta":"The Rio artist who took funk carioca into global pop, recording in Portuguese, English and Spanish. She is as much a strategist as a performer.",
  "Ludmilla":"A Rio singer who moved from funk carioca to pop and pagode, and became one of Brazil's biggest live draws.",
  "Bala Desejo":"A Rio quartet reviving Tropicália's harmonic playfulness with modern production. Their record sounds like four friends in a room, because it was.",
  "Sroeng Santi":"A Thai musician who rebuilt heavy funk and rock around luk thung melodies in the 1970s. His records were rediscovered by collectors decades later.",
  "Dao Bandon":"A luk thung singer whose songs speak for rural migrants in Bangkok. The genre is Thailand's country music, and he is one of its lasting voices.",
  "Phum Viphurit":"A Bangkok singer whose bedroom pop is warm, guitar-led and sung in English. His songs travelled through streaming before he played a large stage.",
  "Milli":"A Thai rapper who raps in Thai with speed and political bite, and became a national talking point for eating mango sticky rice on a festival stage.",
  "Paradise Bangkok Molam International Band":"A Thai group reviving molam — the khaen-driven music of Isan — with dub and psychedelic production. The traditional instrument keeps the lead.",
  "Duke Ellington":"The bandleader who treated the jazz orchestra as a composer's instrument, writing for the specific players in front of him. His Cotton Club years in Harlem produced a body of work that outgrew dance music entirely.",
  "Cab Calloway":"A Harlem showman whose call-and-response scatting turned a nightclub into a chorus. His zoot suit and hi-de-ho became shorthand for the era long after the songs themselves.",
  "Billie Holiday":"She sang behind the beat and made small phrases carry enormous weight. Her voice had little range and total authority, and she recorded some of the century's most uncomfortable songs without raising it.",
  "Charlie Parker":"The alto saxophonist who rewired jazz harmony at speed, and made bebop a language rather than a style. Musicians spent decades transcribing what he improvised in single takes.",
  "Dizzy Gillespie":"Trumpeter, bandleader and the public face of bebop, with a bent horn and puffed cheeks that made him instantly recognisable. He also pulled Afro-Cuban rhythm into American jazz and kept it there.",
  "Big Bill Broonzy":"A guitarist who moved from Mississippi to Chicago and became the city's most recorded bluesman of the 1930s. He could play country blues one night and lead a small band the next.",
  "Memphis Minnie":"A guitarist and singer who outplayed the men she recorded with and wrote her own material for three decades. In Chicago she was a fixture of the blues clubs long before the music went electric.",
  "Sonny Boy Williamson I":"The player who made the harmonica a lead instrument in Chicago blues rather than a novelty. His phrasing was copied so widely that a second musician later took his name.",
  "Roy Brown":"A New Orleans singer whose gospel-trained shout gave jump blues its urgency. The song he wrote and recorded in 1947 was picked up by rock and roll almost immediately.",
  "Dave Bartholomew":"Trumpeter, bandleader and the arranger behind much of the New Orleans sound. He wrote and produced the records that carried the city's rhythm into the national charts.",
  "Antonio Machín":"A Cuban singer who took son to Europe and stayed there, becoming a star in Spain. His 1930 recording of a Havana street vendor's cry was the first Cuban record to travel worldwide.",
  "Orquesta Casino de la Playa":"A Havana big band of the late 1930s that put Afro-Cuban rhythm into a dance orchestra format. Several musicians who defined later Cuban music passed through its ranks.",
  "Trío Matamoros":"A Santiago trio whose songs became the standard repertoire of Cuban son. They wrote melodies simple enough to survive any arrangement, and every generation since has recorded them.",
  "Arsenio Rodríguez":"The blind tres player who rebuilt the son ensemble around congas and a piano, and called back to its African roots. What he assembled in the 1940s is the direct ancestor of salsa.",
  "Celina y Reutilio":"A husband-and-wife duo who sang the guajiro music of the Cuban countryside and brought Santería devotion into popular song. Their voices in parallel are one of the island's most recognisable sounds.",
  "Carlos Gardel":"The voice that turned tango into a song form and Buenos Aires into a myth. He died at the height of his fame in 1935, which fixed him permanently as the genre's defining figure.",
  "Juan d'Arienzo":"The bandleader who dragged tango back to the dance floor by speeding it up and hammering the beat. Dancers called him the king of the rhythm, and orchestras spent years chasing his tempo.",
  "Francisco Canaro":"A prolific bandleader who recorded tango for half a century and shaped how the orchestra sounded on record. His arrangements were elegant, danceable and made for a room full of people.",
  "Ángel D'Agostino":"A pianist and bandleader whose orchestra, with the singer Ángel Vargas, captured the Buenos Aires street corner in song. Their partnership is one of tango's great pairings.",
  "Alberto Castillo":"A singer who was also a practising doctor, and who sang milonga with the accent and swagger of the neighbourhoods. He put the city's working-class dance halls on record.",
  "Django Reinhardt":"A Romani guitarist who rebuilt his technique around two working fingers after a fire, and invented a European jazz that owed nothing to America. His quintet played swing with strings instead of horns.",
  "Édith Piaf":"A street singer from Belleville whose voice was too large for her body and carried grief without decoration. She defined the chanson réaliste and then outgrew the genre entirely.",
  "Charles Trenet":"The singing madman, who wrote chansons with the swing of jazz and the imagery of poetry. His songs sound light and are built with great precision.",
  "Noel Rosa":"A Rio songwriter who took samba out of the hills and into the middle-class parlour without softening it. He died at 26 having written a repertoire the city still sings.",
  "Carmen Miranda":"A Portuguese-born singer who became Brazil's biggest star before Hollywood turned her into a fruit-hatted caricature. Her early Rio recordings show a sharp, fast-talking samba singer.",
  "Francisco Alves":"The King of the Voice, Brazil's most popular singer of the 1930s. He recorded the songs of the era's best writers and gave samba its first mass audience.",
  "Ataulfo Alves":"A samba composer and singer whose songs were built from everyday grievances and small comforts. His carnival hits are still sung in Rio every February.",
  "Dorival Caymmi":"A Bahian songwriter who wrote about the sea, fishermen and slowness, and moved to Rio without losing any of it. His songs are so plain they sound like folklore rather than authored work.",
  "Herivelto Martins":"A composer and performer who documented the Rio that was being demolished around him. His carnival sambas mourned neighbourhoods while people danced to them.",
  "Marlene Dietrich":"A Berlin actress and singer whose voice was low, dry and deliberately unimpressed. She left Germany when the Nazis took power and refused every offer to return.",
  "Comedian Harmonists":"A Berlin vocal sextet whose close harmony was technically astonishing and enormously popular. The Nazi regime broke the group up because three of its members were Jewish.",
  "Lale Andersen":"A German singer whose 1939 recording of a soldier's song became the most famous ballad of the war, played on both sides of the front. Her relationship with the regime that broadcast it was hostile.",
  "Roaring Lion":"A Trinidadian calypsonian with a gift for melody and a career that ran for six decades. He was among the first to record calypso in New York and give it an audience beyond the island.",
  "Attila the Hun":"A calypsonian who turned the form into political journalism, singing about scandals, disasters and colonial officials. He later served in Trinidad's legislature.",
  "Growling Tiger":"A calypsonian known for songs about poverty and power, delivered in a low, deliberate voice. His 1935 verse about money and status is still quoted in Trinidad.",
  "Ichiro Fujiyama":"A classically trained tenor who became a star of Japanese popular song and kept singing across the war and after it. His voice bridged the ryūkōka era and the postwar rebuild.",
  "Noriko Awaya":"Called the queen of the blues in Japan, she brought a torch-song heaviness to 1930s kayōkyoku. She trained as an opera singer and used that weight on popular material.",
  "Katsutaro Kouta":"A geisha who became one of the first great recording stars of Japanese popular music. Her ondo records sold in numbers nobody in the industry had seen before.",
  "Michiko Namiki":"The singer of the first hit released in Japan after the war, a song about an apple that people heard as permission to feel something ordinary again.",
  "Shizuko Kasagi":"The boogie-woogie queen of postwar Japan, who sang with a physical energy that startled audiences used to restraint. Her records are the sound of Tokyo's recovery.",
  "Lee Nan-young":"A Korean singer whose 1935 recording became an unofficial anthem of loss under colonial rule. It is still one of the most recognisable songs in the country.",
  "Kim Jeong-gu":"A Korean singer of the late colonial era whose ballad about a border river became a standard. The song's grief was understood by everyone who heard it.",
  "Al Bowlly":"A crooner born in Mozambique who became the voice of London's dance bands, singing softly into the new microphones. He was killed by a bomb in his flat during the Blitz.",
  "Henry Hall":"The bandleader of the BBC Dance Orchestra, whose broadcasts made him a household name across Britain. His most famous record was aimed at children and outlived everything else he did.",
  "Ambrose and His Orchestra":"The most polished of London's hotel dance bands, led by the violinist Bert Ambrose. They played for high society and recorded jazz-inflected arrangements that still hold up.",
  "Vera Lynn":"The Forces' Sweetheart, whose wartime songs promised return and reunion to people who had no guarantee of either. She sang for troops in Burma and stayed a national figure for seventy years.",
  "Anne Shelton":"A British singer who recorded the English version of the song both armies were already humming. She broadcast to the forces throughout the war while still in her teens.",
  "Ted Heath and His Music":"Britain's finest big band, formed at the end of the war by a trombonist who wanted American precision with British players. They filled the London Palladium for years.",
  "Lucha Reyes":"The singer who made ranchera a woman's music, using a raw, broken voice that came from damage to her vocal cords. Everything the genre later did with defiance starts with her.",
  "Asmahan":"A Syrian-born singer and actress in Cairo whose voice rivalled Umm Kulthum's, trained in both Arabic tarab and European technique. She died in a car accident at 26, and the rumours have never stopped.",
  "Mohammed Abdel Wahab":"Composer, singer and the modernist of Arabic music, who brought Western orchestration into the Egyptian song without abandoning the maqam. He wrote for everyone, including Umm Kulthum.",
  "Noor Jehan":"A singer and actress who was the biggest star of 1940s Bombay cinema before moving to Pakistan after partition. Her voice defined the film ghazal on both sides of the border.",
  "Lata Mangeshkar":"The playback singer whose voice carried Indian film music for more than half a century. Her 1949 breakthrough is the moment the modern Bollywood song begins.",
  "Shamshad Begum":"A playback singer with a full, nasal tone quite unlike the sweetness that later dominated. She sang thousands of songs and made the ones with humour in them her own.",
  /* ── 2026-09-19: добивка тонких декад (data/add-2026-09-19.json). Факты — из источников,
     собранных при подборе кандидатов; алиасы Apple-имён копируют готовые биографии. */
  "Hanka Ordonówna":"A Warsaw cabaret singer and actress, the star of the Qui Pro Quo revue. She sang Miłość ci wszystko wybaczy in the 1933 film Szpieg w masce, and it became the sound of prewar Warsaw.",
  "Mieczyslaw Fogg":"A Warsaw baritone and one of the most recorded Polish singers of the 1930s. He was the first to sing Jerzy Petersburski's tango To ostatnia niedziela in 1935.",
  "Eugeniusz Bodo":"The most popular actor and singer of prewar Polish cinema, charming and self-mocking on screen. Już taki jestem zimny drań comes from the 1938 film Robert i Bertrand. He died in a Soviet labour camp in 1943.",
  "Devika Rani & Ashok Kumar":"Devika Rani co-founded the Bombay Talkies studio; Ashok Kumar was its new leading man. Their duet Main Ban Ki Chidiya comes from Achhut Kanya (1936), one of the first Hindi talkies to take on caste.",
  "Saraswati Devi":"The house composer of Bombay Talkies, born Khorshed Minocher-Homji, and one of the first women to score Indian films. She wrote the music for Achhut Kanya in 1936.",
  "Devika Rani":"Co-founder and star of Bombay Talkies, called the first lady of the Indian screen. She sang her own songs in the studio's talkies of the late 1930s, from Achhut Kanya to Izzat.",
  "Sidney Bechet & His New Orleans Feetwarmers":"Sidney Bechet was born in New Orleans and became one of jazz's first great soloists on soprano saxophone and clarinet. His New Orleans Feetwarmers recorded Maple Leaf Rag in 1932.",
  "Louis Prima & His New Orleans Gang":"A trumpeter and singer from New Orleans who led his New Orleans Gang on Brunswick records from 1934. He wrote Sing, Sing, Sing, which Benny Goodman made into the swing era's anthem.",
  "Jelly Roll Morton":"A New Orleans pianist and composer, jazz's first great arranger, who liked to claim he had invented the music. Winin' Boy Blues comes from his late sessions of 1938–39.",
  "Gracie Fields":"A singer and comic actress from Rochdale in Lancashire, and the highest-paid film star in Britain in the 1930s. Sing As We Go is the title song of her 1934 film about mill workers.",
  "George Formby":"A comedian from Wigan who played a ukulele-banjo and sang cheeky music-hall songs in a broad Lancashire voice. When I'm Cleaning Windows (1936) was banned by the BBC and became one of his biggest hits.",
  "Jack Hylton":"A bandleader from Bolton in Lancashire who led the best-selling British dance band of the 1920s and 1930s.",
  "María Luisa Landín":"A bolero singer born in 1921 in Tepito, Mexico City, who started on the city's radio stations. Her 1949 recording of Pedro Flores's Amor perdido became her signature song.",
  "John Lee Hooker":"A Mississippi-born bluesman who settled in Detroit and played its postwar house parties. Boogie Chillen', recorded there in 1948, went to number one on the R&B chart and built a career on one hypnotic chord.",
  "Todd Rhodes":"A pianist who played with McKinney's Cotton Pickers and then led his own orchestra in Detroit. Blues for the Red Boy reached number four on the R&B chart in 1948.",
  "T.J. Fowler":"A Detroit pianist and bandleader who began recording in 1948 for the city's small labels, playing the jump blues that bridged swing and rhythm and blues.",
  "Mark Bernes, Александр Иванов-Крамской & Ансамбль п/у Александра Цфасмана":"Mark Bernes, an actor who sang almost in a whisper, performed Тёмная ночь in the 1943 film Two Soldiers. On the record he is accompanied by guitarist Alexander Ivanov-Kramskoy and Alexander Tsfasman's orchestra.",
  "Georgiy Vinogradov":"A Soviet lyric tenor, soloist of All-Union Radio from 1937 and of the Alexandrov Army Ensemble from 1943. His version of В лесу прифронтовом became one of the best-known wartime songs.",
  "Zarah Leander":"A Swedish singer and actress with a deep contralto who became the biggest star of the Berlin film studio UFA. Her songs from the 1942 film Die große Liebe were wartime escapism made by the Nazi state's film industry.",
  "Ilse Werner":"An actress, singer and virtuoso whistler who starred in UFA films. Wir machen Musik is the title song of Helmut Käutner's 1942 musical.",
  "Evelyn Künneke":"A Berlin-born singer whose early-1940s hit Sing, Nachtigall, sing brought a trace of swing into wartime German schlager.",
  "Juliette Gréco":"The muse of Saint-Germain-des-Prés, dressed in black, who sang the poets of the Left Bank. Si tu t'imagines sets a poem by Raymond Queneau.",
  "Georges Brassens":"A singer-songwriter with a pipe, a guitar and a gruff tenderness, who made his debut in Patachou's Paris cabaret in 1952. Le gorille, from the same year, was too rude for French radio.",
  "Sidney Bechet":"A New Orleans-born clarinettist and soprano saxophonist who settled in France in 1950 and became a national star there. He recorded Petite fleur in Paris in 1952.",
  "Elizeth Cardoso":"A Rio singer whose 1958 album Canção do Amor Demais, with songs by Tom Jobim and Vinicius de Moraes, is often called the first bossa nova record.",
  "Jacob do Bandolim":"A Rio mandolinist and composer who guarded choro's classical rigour at a time when it was falling out of fashion. Noites Cariocas is one of his standards.",
  "Lonnie Donegan":"The king of skiffle. His 1955 Rock Island Line reached the top ten in Britain and America and sent a generation of teenagers, the future Beatles among them, to buy cheap guitars.",
  "Humphrey Lyttelton":"An English trumpeter and leader of a trad jazz band. Bad Penny Blues (1956), produced by Joe Meek, reached the British top twenty.",
  "Cliff Richard & The Drifters":"Move It (1958), Cliff Richard's debut single, is often called the first real British rock and roll record. His backing band The Drifters later became The Shadows.",
  "Hibari Misora":"The greatest star of postwar Japanese popular song, a child prodigy who grew into its queen. Ringo Oiwake (1952) was one of her best-selling records.",
  "Frank Nagai":"A Japanese singer with a deep, velvety voice, the star of mood kayō, the city ballads of Tokyo nightlife. Yūrakuchō de Aimashō (1957) was his biggest hit.",
  "Eri Chiemi":"A Japanese singer and actress who debuted in 1952 with a Japanese version of Tennessee Waltz. With Hibari Misora and Izumi Yukimura she formed the Sannin Musume, the three girls of 1950s pop.",
  "Geeta Dutt":"A Bombay playback singer with a smoky, knowing voice. Babuji Dheere Chalna comes from Guru Dutt's film Aar Paar (1954), with music by O. P. Nayyar.",
  "Kishore Kumar":"An Indian playback singer and comic actor who brought yodels and rock and roll into Bombay film songs. Eena Meena Deeka comes from the film Aasha (1957).",
  "Talat Mahmood":"An Indian singer with a trembling, velvet voice who was the master of the film ghazal. Jalte Hain Jiske Liye comes from Bimal Roy's Sujata (1959), with music by S. D. Burman.",
  "Aretha Franklin":"The Queen of Soul grew up in Detroit, where her father was pastor of New Bethel Baptist Church. Her first recordings were gospel songs made there in 1956, when she was fourteen.",
  "Barrett Strong":"A Detroit singer whose Money (That's What I Want) was the first hit for Tamla, the label that became Motown. He later co-wrote some of the label's greatest songs with Norman Whitfield.",
  "Count Lasher":"A Jamaican mento singer who recorded in Kingston in the 1950s for Stanley Motta and Ken Khouri, singing the island's rural calypso with a sly sense of humour.",
  "Laurel Aitken":"A Cuban-born Jamaican singer called the godfather of ska. Boogie in My Bones (1958) was one of Chris Blackwell's first productions and an early Jamaican take on American R&B.",
  "Clue J & The Blues Blasters":"The Kingston band of bassist Cluett Johnson. Their 1959 Shufflin' Jug, made for Coxsone Dodd, is often named among the first ska records.",
  "Spokes Mashiyane":"A South African pennywhistle player and the star of kwela, the street music of 1950s Johannesburg townships, who recorded there for Trutone and Gallo.",
  "Dorothy Masuka":"A singer and songwriter born in Bulawayo who became a star of Johannesburg's 1950s jazz scene. She wrote Pata Pata, later a world hit for Miriam Makeba.",
  "Miriam Makeba & The Skylarks":"The Skylarks were a Johannesburg women's vocal group that Miriam Makeba led from 1956 to 1959, recording close-harmony township songs for Gallo.",
  "Giacomo Rondinella":"A Neapolitan singer and actor who was the first to record Totò's Malafemmena in 1951.",
  "Renato Carosone":"A Neapolitan pianist and bandleader who mixed Neapolitan song with swing and a comedian's timing. Tu vuò fà l'americano (1956) mocks Neapolitans imitating Americans.",
  "Aurelio Fierro":"A Neapolitan singer who won the 1956 Festival di Napoli with Guaglione.",
  "Os Demônios da Garoa":"A São Paulo samba group who in 1955 made Adoniran Barbosa's Saudosa Maloca, a song about a demolished shack, into a city anthem.",
  "Inezita Barroso, Ochelsis Laureano & Raul Torres":"Inezita Barroso was a São Paulo singer and researcher of caipira, the country music of the Brazilian interior. Moda da Pinga was her biggest hit of the 1950s.",
  "Celly Campello":"A singer from São Paulo state whose Portuguese version of Stupid Cupid (1959) became Brazil's first big rock and roll hit.",
  "Slum Village":"A Detroit hip hop group formed by J Dilla, T3 and Baatin. Their album Fantastic, Vol. 2 (2000) set the tone for soulful, off-kilter Midwest hip hop.",
  "The White Stripes":"A Detroit duo of Jack White and Meg White, dressed only in red, white and black. White Blood Cells (2001) led the garage rock revival.",
  "Drexciya":"A Detroit electro duo, James Stinson and Gerald Donald, who stayed faceless and built a mythology of an underwater nation. Grava 4 came out in 2002, shortly before Stinson's death.",
  "Zola":"Bonginkosi Dlamini, a kwaito artist, poet and actor from Soweto. His 2000 album Umdlwembe and his role in the Oscar-winning film Tsotsi made him a voice of the township.",
  "Mafikizolo":"A Johannesburg Afro-pop group, Theo Kgosinkwe and Nhlanhla Nciza, whose 2003 album Kwela brought back the sound of 1950s Sophiatown.",
  "Skwatta Kamp":"A Gauteng hip hop crew whose 2003 album Mkhukhu Funkshen helped make South African rap a commercial force.",
  "Tati Quebra Barraco & DJ Marlboro":"Tati Quebra Barraco, an MC from Rio's Cidade de Deus, was one of the first women stars of funk carioca. DJ Marlboro is one of the producers who built the genre.",
  "Marcelo D2":"A Rio rapper and former frontman of Planet Hemp. His album À Procura da Batida Perfeita (2003) fused samba and hip hop.",
  "Los Hermanos":"A Rio rock band led by Marcelo Camelo and Rodrigo Amarante. Ventura (2003) is often ranked among the most important Brazilian rock albums of the decade.",
  "Amadou & Mariam":"A blind Malian couple, Amadou Bagayoko and Mariam Doumbia, who met at Bamako's Institute for the Young Blind. Dimanche à Bamako (2004), produced by Manu Chao, made them world stars.",
  "Toumani Diabaté's Symmetric Orchestra":"The Bamako big band of kora player Toumani Diabaté, mixing griot music from across West Africa. Their 2006 album is named after Boulevard de l'Indépendance, a Bamako avenue.",
  "Ali Farka Touré & Toumani Diabate":"Mali's guitar master and its greatest kora player recorded In the Heart of the Moon (2005) together at the Hotel Mandé in Bamako, and won a Grammy for it.",
  "Lupe Fiasco":"A rapper from Chicago's West Side. Kick, Push, from his 2006 debut Food & Liquor, turned a skateboarding story into a song about outsiders.",
  "Wilco":"A Chicago band led by Jeff Tweedy. Yankee Hotel Foxtrot (2002) was recorded in their Chicago loft, rejected by their label, and became a landmark.",
  "Tortoise":"A Chicago band at the centre of American post-rock, on the local Thrill Jockey label. Standards came out in 2001.",
  "BaBa ZuLa & Mad Professor":"BaBa ZuLa are an Istanbul psychedelic band of electric saz, percussion and dub. Their 2001 album Duble Oryantal was mixed by British dub producer Mad Professor.",
  "Duman":"An Istanbul rock band formed in 1999 by Kaan Tangöze, one of the leading Turkish rock bands of the 2000s.",
  "Laço Tayfa":"The ensemble of Istanbul clarinettist Hüsnü Şenlendirici, fusing the Roman music of the city's Romani quarters with jazz and funk.",
  "Chang Kiha":"A Seoul indie musician who delivered everyday frustration in a deadpan voice. His 2008 single Cheap Coffee became a symbol of the Hongdae indie scene.",
  "Epik High":"A Seoul hip hop trio of Tablo, Mithra Jin and DJ Tukutz. Fly, from Swan Songs (2005), was one of their breakthrough songs.",
  "Clazziquai":"A Seoul electronic project of DJ Clazzi, Alex and Horan, blending lounge, house and bossa nova. Their debut album Instant Pig came out in 2004.",
  "Mohamed Abdel Wahab":"Composer, singer and the modernist of Arabic music, who brought Western orchestration into the Egyptian song without abandoning the maqam. He wrote for everyone, including Umm Kulthum.",
  "Pérez Prado and His Orchestra":"The bandleader who packaged mambo for the world, with brass stabs and his own grunts as punctuation. Cuban in origin, Mexican by career, global by result.",
};


const DUR=162, RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastPlace=null;
const placeById=id=>PLACES.find(p=>p.id===id);
/* ---- профиль ATLAS (мок — без сторонних интеграций) ----
   Идентичность = свой аккаунт ATLAS. Вход симулируется (без OAuth); реальные интеграции с
   музыкальными сервисами — только при боевой реализации. Воспроизведение — визуальный мок. */
const PROFILE_KEY = 'atlas_profile';

let state={place:null,dec:null,playing:false,saved:[],haptics:true,dataSaver:false,email:localStorage.getItem('atlas_email')||'',authWith:localStorage.getItem('atlas_auth')||'',hist:[],hi:-1,shuffleLiked:false,signedIn:localStorage.getItem(PROFILE_KEY)==='1'};
/* [F] Ellipse 64 живёт на opacity .3 — «нет архива» приглушает до .18.
   Цвет свечения ведёт за собой место: у каждой точки в данных свой hue, и при
   смене заброса подсветка переливается к нему (2026-08-23, решение Николая).
   Канон #FFCC9D — это hsl(27 100% 80%), поэтому светлоту и насыщенность держим
   рядом с ним и крутим только тон: подсветка остаётся «тёплым светом места»,
   а не превращается в цветомузыку. */
function glowColor(hue, light){
  /* Чистый hue места давал карнавал (сиреневый Детройт, салатовый Кингстон) и рвал
     ночную эстетику. Поэтому цвет места лишь ПОДКРАШИВАЕТ канонический #FFCC9D:
     смешиваем 45% места с 55% амбера — свет остаётся тёплым, но место узнаётся. */
  /* Насыщенность и доля места подняты 2026-08-25 (решение Николая: «сделай больше
     цветов, сейчас не сильно заметно»). Было .62 / 45% — разброс между треками
     всего 38 из 255, глазом почти не читалось. Стало .80 / 60%: разброс 61, то
     есть примерно вдвое. Это осознанный шаг обратно в сторону «карнавала»,
     от которого уходили 2026-08-23; ночь держится тем, что свечение всё равно
     лежит с плотностью .3 поверх фона — цвет остаётся подсветкой, не заливкой. */
  const h=(((hue%360)+360)%360)/360, sat=.92, lig=(typeof light==='number'?light:.74);
  const q=lig<.5?lig*(1+sat):lig+sat-lig*sat, pp=2*lig-q;
  const ch=t=>{ t=(t+1)%1;
    if(t<1/6) return pp+(q-pp)*6*t;
    if(t<1/2) return q;
    if(t<2/3) return pp+(q-pp)*(2/3-t)*6;
    return pp; };
  const place=[ch(h+1/3)*255, ch(h)*255, ch(h-1/3)*255];
  const amber=[255,204,157], k=.78;
  const mix=place.map((c,i)=>Math.round(c*k+amber[i]*(1-k)));
  return 'rgb('+mix[0]+','+mix[1]+','+mix[2]+')';
}
/* Оттенок находки: МЕСТО задаёт основной цвет, ЖАНР сдвигает его внутри места.
   До 2026-08-25 свет менялся только при смене места — переключение трека внутри
   одной эпохи ничего не давало. Теперь у каждой находки свой оттенок.
   Сдвиг берётся от жанра, а не от случайного числа: свет идёт за стилем, и это
   тот же жанр, что виден чипом в шапке. Диапазон ±22° подобран так, чтобы оттенок
   читался как другой, но Гавана осталась золотой, а Берлин — прохладным. */
function trackTint(place, track){
  if(!track || !track.g) return {hue:place.hue, light:.74};
  let n=0; for(let i=0;i<track.g.length;i++) n=(n*31+track.g.charCodeAt(i))>>>0;
  /* Две составляющие, потому что одной мало. Сдвиг ТОНА ±22° работает по местам
     неодинаково: Кингстон на нём почти не двигается, а Берлин уже уезжает из
     зеленовато-серого в розоватый — расширять диапазон значит ломать узнаваемость
     мест. Поэтому добавлена ЯРКОСТЬ ±0.05: она читается одинаково везде и не
     трогает то, каким цветом место опознаётся. */
  /* >>> , а не >>: со знаковым сдвигом половина хешей давала отрицательный
     остаток, и яркость уходила до .53 вместо задуманного коридора .67–.81 */
  return {hue: place.hue + ((n%57)-28), light: .74 + (((n>>>8)%15)-7)/100};
}
/* ── ПОРТРЕТЫ АРТИСТОВ (2026-08-30) ────────────────────────────────
   Настоящие фото из Deezer, разрезолвленные ОФЛАЙН и просмотренные глазами.
   ⚠️ Почему глазами: «картинка артиста» у Deezer сплошь и рядом оказывается
   КОНВЕРТОМ ПЛАСТИНКИ, а не портретом (у всех 1000×1000, метаданных о типе
   нет — отличить программно нечем). Из 400 найденных 94 оказались обложками
   и заглушками и отбракованы вручную; осталось 306 настоящих портретов.
   ⚠️ Сверка по имени строгая: поиск легко отдаёт похожего чужого («Srueng
   Santi» вместо «Sroeng Santi»). Чужой трек — досадно, чужое ЛИЦО — стыдно.
   У кого портрета нет — остаётся вырез карты по координатам места: это было
   честное решение 2026-08-25 и стало запасным вариантом, а не единственным. */
const ARTIST_PICS = {};   /* заполняется из assets/data/artist-pics.json — см. fillFromJson ниже */
/* ── ФИЛЬТР ВРЕМЕНИ (2026-08-25) ──────────────────────────────────────
   Решение Николая: состояния «атмосфера / не архив» больше нет — не потому,
   что его убрали с экрана, а потому что в него нельзя попасть. Правило
   двустороннее: выбранная эпоха ГАСИТ города без записей, выбранный город
   ОГРАНИЧИВАЕТ шкалу своими эпохами. Пара место×эпоха всегда валидна.
   Этим отменена «честная атмосфера» из PRD и HANDOFF. */
function hasArchive(p,dec){ return !!(p && p.eras && p.eras[dec] && p.eras[dec].length); }
/* эпоха под прицелом ПРЯМО СЕЙЧАС, а не последняя проигранная: глобус должен
   гаснуть во время прокрутки шкалы, а не после неё.
   try — шкала объявлена ниже по файлу, а глобус стартует раньше. */
function liveDec(){ try{ return DEC[clampIdx(Math.round(idxFromTx(tx)))]; }
  catch(_){ return (state&&state.dec)||DEC[0]; } }
/* ближайшая к текущей позиции эпоха, которая у места есть */
function nearestDec(p, from){
  if(hasArchive(p,from)) return from;
  const i=DEC.indexOf(from); let best=null,bd=99;
  DEC.forEach((d,k)=>{ if(!hasArchive(p,d))return; const dd=Math.abs(k-i); if(dd<bd){bd=dd;best=d;} });
  return best||DEC[0];
}
/* Формат эпохи — ОДИН на весь продукт: шкала, шапка трека, Liked, Stats,
   карточка артиста, меню строки. Меняется здесь, а не по месту.
   ⚠️ Полная запись без апострофа: `1960s`, а НЕ `1960's`. Апостроф перед s
   означает притяжательность («принадлежащий 1960 году») и в десятилетиях
   является ошибкой (Chicago, AP). Так писала NYT по своему старому стилю —
   это единственное оправдание, и оно не наше.
   ⚠️ Сокращённая запись `’60s` (2026-08-26) этим отменена: там апостроф
   был законен, он заменял отброшенные «19». Решение Николая 2026-09-04. */
function decShort(dec){ return dec==='NOW' ? 'NOW' : dec+'s'; }
