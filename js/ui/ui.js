export function createUI(state) {
  state.uiElement = document.getElementById('ui');

  if (!state.uiElement) {
    state.uiElement = document.createElement('div');
    state.uiElement.id = 'ui';
    document.body.appendChild(state.uiElement);
  }

  Object.assign(state.uiElement.style, {
    position:   'absolute',
    top:        '16px',
    left:       '16px',
    zIndex:     '10',
    padding:    '12px 16px',
    background: 'rgba(0, 0, 0, 0.45)',
    border:     '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    color:      '#f5f5f5',
    fontFamily: 'Arial, sans-serif',
    pointerEvents: 'none'
  });

  state.uiElement.innerHTML = `
    <p>Click per attivare la visuale in prima persona</p>
    <p>WASD per muoverti, mouse per guardarti attorno</p>
    <p>ESC per liberare il cursore</p>
    <p>F per aprire/chiudere l'inventario</p>
    <p>Shift per iniziare a correre</p>
  `;

  // ── Testo interazione: elemento indipendente, centrato in basso ──────────
  let interactionText = document.getElementById('interaction-text');
  if (!interactionText) {
    interactionText = document.createElement('div');
    interactionText.id = 'interaction-text';
    document.body.appendChild(interactionText);
  }

  // Stili separati da textContent (Object.assign su .style NON tocca il DOM)
  Object.assign(interactionText.style, {
    position:      'fixed',
    bottom:        '80px',
    left:          '50%',
    transform:     'translateX(-50%)',
    zIndex:        '20',
    color:         '#f4c430',
    fontFamily:    'Arial, sans-serif',
    fontSize:      '17px',
    fontWeight:    '600',
    letterSpacing: '0.04em',
    textShadow:    '0 1px 6px rgba(0,0,0,0.9)',
    pointerEvents: 'none',
    textAlign:     'center',
    whiteSpace:    'nowrap',
    display:       'block'    // ← assicura che sia visibile
    // ← RIMUOVI la riga: textContent: ''
  });

  // Inizializzazione del testo sul DOM (NON dentro Object.assign)
  interactionText.textContent = '';

state.interactionTextElement = interactionText;

  // ── Crosshair ─────────────────────────────────────────────────────────────
  let crosshair = document.getElementById('crosshair');
  if (!crosshair) {
    crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    Object.assign(crosshair.style, {
      position:     'absolute',
      left:         '50%',
      top:          '50%',
      width:        '10px',
      height:       '10px',
      marginLeft:   '-5px',
      marginTop:    '-5px',
      border:       '2px solid rgba(255,255,255,0.85)',
      borderRadius: '50%',
      zIndex:       '9',
      pointerEvents:'none'
    });
    document.body.appendChild(crosshair);
  }

  return state.uiElement;
}

export function showErrorOverlay(message) {
  let overlay = document.getElementById('error-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'error-overlay';

    Object.assign(overlay.style, {
      position: 'fixed',
      left: '16px',
      right: '16px',
      top: '16px',
      padding: '12px',
      background: 'rgba(200,50,50,0.95)',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      zIndex: 9999,
      borderRadius: '6px'
    });

    document.body.appendChild(overlay);
  }

  overlay.textContent = '';

  const title = document.createElement('div');
  title.style.fontWeight = '700';
  title.style.marginBottom = '6px';
  title.textContent = 'Errore: ' + message;
  overlay.appendChild(title);

  if (typeof message === 'string' && message.includes('\n')) {
    const pre = document.createElement('pre');
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.margin = '0';
    pre.textContent = message;
    overlay.appendChild(pre);
  }

  console.error('Error overlay shown:', message);
}  // ← chiusura di showErrorOverlay

// ─── STAMINA BAR ──────────────────────────────────────────────────────────────
let _staminaBarContainer = null;
let _staminaBarFill      = null;

export function createStaminaBar() {
  if (_staminaBarContainer) return;

  _staminaBarContainer = document.createElement('div');
  Object.assign(_staminaBarContainer.style, {
    position:      'fixed',
    bottom:        '48px',
    left:          '50%',
    transform:     'translateX(-50%)',
    width:         '220px',
    height:        '8px',
    background:    'rgba(0, 0, 0, 0.45)',
    borderRadius:  '4px',
    border:        '1px solid rgba(255,255,255,0.18)',
    overflow:      'hidden',
    opacity:       '0',
    transition:    'opacity 0.3s ease',
    zIndex:        '50',
    pointerEvents: 'none'
  });

  _staminaBarFill = document.createElement('div');
  Object.assign(_staminaBarFill.style, {
    height:          '100%',
    width:           '100%',
    background:      'linear-gradient(90deg, #f4c430, #f9a825)',
    borderRadius:    '4px',
    transformOrigin: 'left center',
    transition:      'background 0.4s ease'
  });

  _staminaBarContainer.appendChild(_staminaBarFill);
  document.body.appendChild(_staminaBarContainer);

  // Emoji corridore a destra della stamina bar
  let _runnerEmoji = document.getElementById('stamina-runner');
  if (!_runnerEmoji) {
    _runnerEmoji = document.createElement('div');
    _runnerEmoji.id = 'stamina-runner';
    Object.assign(_runnerEmoji.style, {
      position:      'fixed',
      bottom:        '43px',              // stesso baseline della barra
      left:          'calc(50% + 118px)', // metà barra (110px) + 8px gap
      fontSize:      '20px',
      lineHeight:    '1',
      opacity:       '0',
      transition:    'opacity 0.3s ease',
      zIndex:        '50',
      pointerEvents: 'none',
      userSelect:    'none'
    });
    _runnerEmoji.textContent = '🏃';
    document.body.appendChild(_runnerEmoji);
  }
}

export function updateStaminaBar(stamina, show) {
  if (!_staminaBarContainer) return;

  _staminaBarContainer.style.opacity = show ? '1' : '0';
  _staminaBarFill.style.width = (stamina * 100).toFixed(1) + '%';

  // Sincronizza emoji con la barra
  const runner = document.getElementById('stamina-runner');
  if (runner) runner.style.opacity = show ? '1' : '0';

  if (stamina < 0.25) {
    _staminaBarFill.style.background = 'linear-gradient(90deg, #e53935, #ef5350)';
  } else {
    _staminaBarFill.style.background = 'linear-gradient(90deg, #f4c430, #f9a825)';
  }
}