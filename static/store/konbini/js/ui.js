// ---------------------------------------------------------------------------
// ui.js — small control panel: time / weather / lamp / sakura
// ---------------------------------------------------------------------------
export function createHud(initial, onChange) {
  const root = document.getElementById('hud');
  const state = { ...initial };
  if (!root) return { state, update() {}, set() {} };

  const groups = Array.from(root.querySelectorAll('.hud__seg'));
  const lamp = document.getElementById('lampToggle');
  const petals = document.getElementById('petalToggle');

  function sync() {
    for (const group of groups) {
      const key = group.dataset.group;
      for (const btn of group.querySelectorAll('button[data-value]')) {
        const on = btn.dataset.value === state[key];
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
    if (lamp) {
      lamp.classList.toggle('is-on', state.lamp);
      lamp.setAttribute('aria-pressed', state.lamp ? 'true' : 'false');
      const b = lamp.querySelector('b');
      if (b) b.textContent = state.lamp ? '开' : '关';
    }
    if (petals) {
      petals.classList.toggle('is-on', state.petals);
      petals.setAttribute('aria-pressed', state.petals ? 'true' : 'false');
      const b = petals.querySelector('b');
      if (b) b.textContent = state.petals ? '开' : '关';
    }
  }

  function update(patch) {
    Object.assign(state, patch);
    sync();
    if (onChange) onChange({ ...state });
  }

  function set(patch) {
    Object.assign(state, patch);
    sync();
  }

  for (const group of groups) {
    const key = group.dataset.group;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      update({ [key]: btn.dataset.value });
    });
  }
  if (lamp) lamp.addEventListener('click', () => update({ lamp: !state.lamp }));
  if (petals) petals.addEventListener('click', () => update({ petals: !state.petals }));
  sync();

  return { state, update, set };
}
