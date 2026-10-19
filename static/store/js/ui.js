// ---------------------------------------------------------------------------
// ui.js — 悬浮控制面板 / 工具栏 / 快捷键
// ---------------------------------------------------------------------------
const TIME_SHORT = { day: 'DAY', sunset: 'DUSK', night: 'NIGHT' };
const WEATHER_SHORT = { sunny: 'SUNNY', rainy: 'RAIN', storm: 'THUNDER', snow: 'SNOW', heavy: 'HEAVY RAIN' };

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
      if (hint) hint.classList.add('is-hidden');
    },
  };
}
