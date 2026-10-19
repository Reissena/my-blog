// ---------------------------------------------------------------------------
// ui.js — 悬浮控制面板 / 工具栏 / 快捷键
// ---------------------------------------------------------------------------
const TIME_SHORT = { day: 'DAY', sunset: 'DUSK', night: 'NIGHT' };
const WEATHER_SHORT = { sunny: 'SUNNY', rainy: 'RAIN', storm: 'THUNDER', snow: 'SNOW', heavy: 'HEAVY RAIN' };
/* 收起后那条竖把手上显示的天气图标（跟着当前天气走） */
const WEATHER_EMOJI = { sunny: '☀️', rainy: '🌧️', storm: '⛈️', snow: '❄️', heavy: '🌪️' };

/* ---------------------------------------------------------------------------
   左侧「WEATHER & TIME」面板：闲置 5 秒自动向左收起，左边缘留一条竖把手
   ---------------------------------------------------------------------------
   · 收起走的是 transform（CSS 里 .weather-panel.is-collapsed），不是 display:none ——
     要的是「滑走」而不是「消失」，滑动过程中它还得画得出来。
   · 收起后 CSS 给了 pointer-events:none，那片区域让给 canvas：
     OrbitControls 只监听 canvas，所以面板不吃事件，拖场景就照常。
   · pointerdown 的 stopPropagation 只挂在面板自己身上，**绝不挂 document** ——
     挂 document 就等于把整屏的手势都吞了，场景再也拖不动。
   · 到点时如果鼠标还压在面板上（或键盘焦点在里面）就再等一轮：
     不然正在调天气的人会遇到「手还没离开就被收走」。
   · 触摸屏不认 :hover 判断（点一下之后 hover 会一直粘着，面板就永远收不起来），
     所以只有真正能悬停的设备才走 hover 那一支。
   --------------------------------------------------------------------------- */
function initWeatherDock() {
  const panel = document.getElementById('weatherPanel');
  const handle = document.getElementById('weatherHandle');
  if (!panel || !handle) return;

  const IDLE_MS = 5000;
  const isNarrow = window.matchMedia('(max-width: 640px)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  let timer = 0;

  const clearTimer = () => { if (timer) { clearTimeout(timer); timer = 0; } };

  function setOpen(open) {
    panel.classList.toggle('is-collapsed', !open);
    handle.classList.toggle('is-hidden', open);
    handle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function collapse() {
    clearTimer();
    setOpen(false);
  }

  function open() {
    setOpen(true);
    clearTimer();
    arm();
  }

  function arm() {
    clearTimer();
    timer = setTimeout(() => {
      timer = 0;
      let focusInside = false;
      try {
        const el = document.activeElement;
        focusInside = !!(el && el !== document.body && panel.contains(el)
          && el.matches && el.matches(':focus-visible'));
      } catch (e) { focusInside = false; }
      if ((canHover.matches && panel.matches(':hover')) || focusInside) { arm(); return; }
      collapse();
    }, IDLE_MS);
  }

  // 鼠标 / 键盘进面板 → 停表；离开 → 重新计 5 秒
  panel.addEventListener('pointerenter', clearTimer);
  panel.addEventListener('focusin', clearTimer);
  panel.addEventListener('pointerleave', arm);
  panel.addEventListener('focusout', (e) => { if (!panel.contains(e.relatedTarget)) arm(); });
  // 只拦面板自己的手势（别漏到别处），也不让面板上的按下被当成拖场景
  panel.addEventListener('pointerdown', (e) => { e.stopPropagation(); clearTimer(); });
  panel.addEventListener('click', () => arm());

  // 把手：鼠标移上去 / 点一下就滑出来（触摸设备没有 hover，靠 click）
  handle.addEventListener('pointerenter', open);
  handle.addEventListener('pointerdown', (e) => e.stopPropagation());
  handle.addEventListener('click', (e) => { e.stopPropagation(); open(); });

  // 窄屏进站就是收着的：先把画面让给场景
  if (isNarrow.matches) { clearTimer(); setOpen(false); armWhenSceneReady(); return; }
  setOpen(true);
  armWhenSceneReady();

  // ⚠️ 别在 initUI 里直接 arm()：那时进站遮罩还盖着，5 秒全耗在加载画面上，
  //    场景一亮出来面板就已经被收走了（弱机上实测就是这样）。
  //    等 #boot 加上 .hidden（= 场景真的可交互了）再开始计时。
  function armWhenSceneReady() {
    if (window.__APP_READY__) { arm(); return; }
    const boot = document.getElementById('boot');
    if (!boot) { arm(); return; }
    const mo = new MutationObserver(() => {
      if (boot.classList.contains('hidden')) { mo.disconnect(); arm(); }
    });
    mo.observe(boot, { attributes: true, attributeFilter: ['class'] });
    setTimeout(() => { mo.disconnect(); if (!timer && !panel.classList.contains('is-collapsed')) arm(); }, 20000);
  }
}

export function initUI(handlers) {
  const weatherBtns = Array.from(document.querySelectorAll('[data-weather]'));
  const timeBtns = Array.from(document.querySelectorAll('[data-time]'));
  const btnReset = document.getElementById('btn-reset');
  const btnOrbit = document.getElementById('btn-orbit');
  const btnNight = document.getElementById('btn-night');
  const btnShop = document.getElementById('btn-shop');
  const btnSound = document.getElementById('btn-sound');
  const btnCar = document.getElementById('btn-car');
  const liveTag = document.getElementById('liveTag');
  const hint = document.getElementById('hint');
  const handleIcon = document.getElementById('handleWeatherIcon');

  // 左侧天气面板的「闲置 5 秒收起」+ 把手（见文件顶部注释）
  initWeatherDock();

  weatherBtns.forEach((b) => b.addEventListener('click', () => handlers.onWeather(b.dataset.weather)));
  timeBtns.forEach((b) => b.addEventListener('click', () => handlers.onTime(b.dataset.time)));
  btnReset.addEventListener('click', () => handlers.onReset());
  btnOrbit.addEventListener('click', () => handlers.onAutoRotate());
  btnNight.addEventListener('click', () => handlers.onNightMode());
  btnShop.addEventListener('click', () => handlers.onShopLights());
  btnSound.addEventListener('click', () => handlers.onSound());
  if (btnCar) btnCar.addEventListener('click', () => handlers.onCarMotion());

  let hintTimer = setTimeout(() => hint.classList.add('is-hidden'), 9000);
  const hideHint = () => {
    hint.classList.add('is-hidden');
    clearTimeout(hintTimer);
  };
  const canvas = document.getElementById('scene');
  canvas.addEventListener('pointerdown', hideHint, { once: true });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') handlers.onReset();
    else if (k === ' ') { e.preventDefault(); handlers.onAutoRotate(); }
    else if (k === 'l') handlers.onShopLights();
    else if (k === 'c') handlers.onCarMotion();
    else if (k === '1') handlers.onWeather('sunny');
    else if (k === '2') handlers.onWeather('rainy');
    else if (k === '3') handlers.onWeather('storm');
    else if (k === '4') handlers.onWeather('snow');
    else if (k === '5') handlers.onWeather('heavy');
    else if (k === 'q') handlers.onTime('day');
    else if (k === 'w') handlers.onTime('sunset');
    else if (k === 'e') handlers.onTime('night');
  });

  return {
    sync(state) {
      weatherBtns.forEach((b) => {
        const on = b.dataset.weather === state.weather;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      timeBtns.forEach((b) => {
        const on = b.dataset.time === state.time;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const isNightMode = state.weather === 'rainy' && state.time === 'night';
      btnNight.setAttribute('aria-pressed', isNightMode ? 'true' : 'false');
      btnOrbit.setAttribute('aria-pressed', state.autoRotate ? 'true' : 'false');
      btnShop.setAttribute('aria-pressed', state.shopLights ? 'true' : 'false');
      btnSound.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
      if (btnCar) btnCar.setAttribute('aria-pressed', state.carMotion ? 'true' : 'false');
      liveTag.textContent = TIME_SHORT[state.time] + ' · ' + WEATHER_SHORT[state.weather];
      // 收起状态只有这条把手露在外面，所以图标要跟着当前天气变
      if (handleIcon) handleIcon.textContent = WEATHER_EMOJI[state.weather] || '🌦️';
      if (hint) hint.classList.add('is-hidden');
    },
  };
}
