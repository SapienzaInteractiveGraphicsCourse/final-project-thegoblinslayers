// hud.js
// HUD del combattimento: lifebar mob (in alto al centro, rossa)
//                        lifebar player (in basso al centro, verde)

export function createCombatHUD() {
  // ── Stile iniettato nel documento ────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Contenitore lifebar mob — in alto al centro */
    #mob-hp-bar {
      position: fixed;
      top: 28px;
      left: 50%;
      transform: translateX(-50%);
      width: 320px;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }

    #mob-hp-label {
      text-align: center;
      color: #ffcccc;
      font-family: 'Georgia', serif;
      font-size: 13px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 5px;
      text-shadow: 0 0 8px #ff000088;
    }

    #mob-hp-track {
      width: 100%;
      height: 14px;
      background: rgba(0,0,0,0.6);
      border: 1px solid #660000;
      border-radius: 3px;
      overflow: hidden;
      box-shadow: 0 0 10px #ff000044;
    }

    #mob-hp-fill {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #8b0000, #ff2222);
      border-radius: 2px;
      transition: width 0.15s ease-out;
    }

    /* Contenitore lifebar player — in basso al centro */
    #player-hp-bar {
      position: fixed;
      bottom: 72px;
      left: 50%;
      transform: translateX(-50%);
      width: 280px;
      z-index: 100;
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }

    #player-hp-label {
      text-align: center;
      color: #ccffcc;
      font-family: 'Georgia', serif;
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 5px;
      text-shadow: 0 0 8px #00ff0055;
    }

    #player-hp-track {
      width: 100%;
      height: 12px;
      background: rgba(0,0,0,0.6);
      border: 1px solid #004400;
      border-radius: 3px;
      overflow: hidden;
      box-shadow: 0 0 8px #00ff0033;
    }

    #player-hp-fill {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #006600, #44ff44);
      border-radius: 2px;
      transition: width 0.15s ease-out;
    }
  `;
  document.head.appendChild(style);

  // ── Mob HP bar ────────────────────────────────────────────────────────────
  const mobBar = document.createElement('div');
  mobBar.id = 'mob-hp-bar';
  mobBar.innerHTML = `
    <div id="mob-hp-label">⚔ Guardian Ogre</div>
    <div id="mob-hp-track">
      <div id="mob-hp-fill"></div>
    </div>
  `;
  document.body.appendChild(mobBar);

  // ── Player HP bar ─────────────────────────────────────────────────────────
  const playerBar = document.createElement('div');
  playerBar.id = 'player-hp-bar';
  playerBar.innerHTML = `
    <div id="player-hp-label">❤ Player</div>
    <div id="player-hp-track">
      <div id="player-hp-fill"></div>
    </div>
  `;
  document.body.appendChild(playerBar);
}