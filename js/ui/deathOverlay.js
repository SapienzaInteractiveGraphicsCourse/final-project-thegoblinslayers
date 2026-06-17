export function createDeathOverlay(state) {
  const flash = document.createElement('div');
  flash.id = 'death-flash';
  Object.assign(flash.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    opacity: '0',
    zIndex: '80',
    background: 'radial-gradient(circle, rgba(160,0,0,0.08) 20%, rgba(120,0,0,0.28) 65%, rgba(80,0,0,0.6) 100%)',
    transition: 'opacity 120ms linear'
  });

  const overlay = document.createElement('div');
  overlay.id = 'death-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 0, 0, 0.72)',
    zIndex: '90'
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    minWidth: '320px',
    maxWidth: '90vw',
    padding: '28px 26px',
    borderRadius: '16px',
    textAlign: 'center',
    background: 'rgba(25, 16, 16, 0.96)',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
    color: '#f6f1f1',
    fontFamily: 'inherit'
  });

  const title = document.createElement('h2');
  title.textContent = 'You died';
  title.style.margin = '0 0 10px 0';
  title.style.fontSize = '34px';
  title.style.color = '#ff8a8a';

  const text = document.createElement('p');
  text.textContent = 'You\'re dead. Start again from the beginning of the dungeon without losing the progress already made.';
  text.style.margin = '0 0 18px 0';
  text.style.lineHeight = '1.5';
  text.style.color = '#e9dede';

  const button = document.createElement('button');
  button.textContent = 'Restart';
  Object.assign(button.style, {
    padding: '12px 22px',
    fontSize: '16px',
    fontWeight: '700',
    border: 'none',
    borderRadius: '10px',
    background: '#b33939',
    color: '#ffffff',
    cursor: 'pointer'
  });

  button.addEventListener('click', () => {
    if (typeof state.respawnPlayer === 'function') {
      state.respawnPlayer();
    }
  });

  panel.appendChild(title);
  panel.appendChild(text);
  panel.appendChild(button);
  overlay.appendChild(panel);

  document.body.appendChild(flash);
  document.body.appendChild(overlay);

  state.deathUI = {
    flash,
    overlay,
    button
  };
}

export function setDeathFlash(state, intensity) {
  if (!state.deathUI?.flash) return;
  const value = Math.max(0, Math.min(1, intensity));
  state.deathUI.flash.style.opacity = String(value);
}

export function showDeathOverlay(state) {
  if (!state.deathUI?.overlay) return;
  state.deathUI.overlay.style.display = 'flex';
}

export function hideDeathOverlay(state) {
  if (!state.deathUI?.overlay) return;
  state.deathUI.overlay.style.display = 'none';
}