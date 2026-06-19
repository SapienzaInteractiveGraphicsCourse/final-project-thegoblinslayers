// js/systems/achievementManager.js
// Gestione completa achievements: definizioni, unlock, notifiche, coda.

// ─── Definizioni ────────────────────────────────────────────────────────────

export const ACHIEVEMENTS = {

  // ── BASE ──────────────────────────────────────────────────────────────────
  PICK_AXE: {
    id: 'PICK_AXE',
    type: 'base',
    title: '"Is it a Viking axe or a lumberjack\'s?"',
    desc: 'Successfully pick up an axe.',
  },
  PICK_SWORD: {
    id: 'PICK_SWORD',
    type: 'base',
    title: '"Is it a samurai sword or a knight\'s?"',
    desc: 'Successfully pick up a sword.',
  },
  PICK_TORCH: {
    id: 'PICK_TORCH',
    type: 'base',
    title: '"Will it light up?"',
    desc: 'Successfully pick up a torch.',
  },
  PICK_SHIELD: {
    id: 'PICK_SHIELD',
    type: 'base',
    title: '"What will I have to protect myself from?"',
    desc: 'Successfully pick up a shield.',
  },
  READ_NOTE: {
    id: 'READ_NOTE',
    type: 'base',
    title: '"The Architect\'s Testament"',
    desc: 'Read the note left in the dungeon.',
  },
  LIGHT_HAND_TORCH: {
    id: 'LIGHT_HAND_TORCH',
    type: 'base',
    title: '"A Moving Light"',
    desc: 'Light your hand torch.',
  },
  LIGHT_WALL_TORCH: {
    id: 'LIGHT_WALL_TORCH',
    type: 'base',
    title: '"Let\'s Light Everything Up"',
    desc: 'Light an unlit wall torch.',
  },
  PULL_LEVER: {
    id: 'PULL_LEVER',
    type: 'base',
    title: '"Click"',
    desc: 'Successfully pull a lever.',
  },
  BREAK_BARREL: {
    id: 'BREAK_BARREL',
    type: 'base',
    title: '"They Can Be Destroyed!"',
    desc: 'Destroy a barrel.',
  },
  KILL_NO_DAMAGE: {
    id: 'KILL_NO_DAMAGE',
    type: 'base',
    title: '"Untouchable"',
    desc: 'Defeat the mob without ever taking damage.',
  },
  WIN_NO_DEATH: {
    id: 'WIN_NO_DEATH',
    type: 'base',
    title: '"Highlander"',
    desc: 'Win without ever dying.',
  },

  // ── SUPER ─────────────────────────────────────────────────────────────────
  SUPER_COLLECTOR: {
    id: 'SUPER_COLLECTOR',
    type: 'super',
    title: '"Collector"',
    desc: 'Pick up all items: sword, axe, shield and torch.',
    requires: ['PICK_SWORD', 'PICK_AXE', 'PICK_SHIELD', 'PICK_TORCH'],
  },
  SUPER_SPEEDRUN: {
    id: 'SUPER_SPEEDRUN',
    type: 'super',
    title: '"SpeedRunner"',
    desc: 'Win the game in under 2 minutes.',
    requires: [], // triggered manually on win
  },
  SUPER_WARRIOR: {
    id: 'SUPER_WARRIOR',
    type: 'super',
    title: '"Warrior"',
    desc: 'Pick up all weapons: sword and axe.',
    requires: ['PICK_SWORD', 'PICK_AXE'],
  },
  SUPER_FIREMAN: {
    id: 'SUPER_FIREMAN',
    type: 'super',
    title: '"Fire Man"',
    desc: 'Light all torches — both your hand torch and every wall torch.',
    requires: [],  
  },
  SUPER_DESTROYER: {
    id: 'SUPER_DESTROYER',
    type: 'super',
    title: '"Destroyer"',
    desc: 'Destroy all four barrels.',
    requires: [], // triggered manually after 4th barrel
  },

  // ── FINAL ─────────────────────────────────────────────────────────────────
  FINAL_PLATINUM: {
    id: 'FINAL_PLATINUM',
    type: 'final',
    title: '"100% Platinum"',
    desc: 'Unlock every base and super achievement. True dungeon master.',
    requires: [
      'PICK_AXE','PICK_SWORD','PICK_TORCH','PICK_SHIELD',
      'READ_NOTE','LIGHT_HAND_TORCH','LIGHT_WALL_TORCH',
      'PULL_LEVER','BREAK_BARREL','KILL_NO_DAMAGE','WIN_NO_DEATH',
      'SUPER_COLLECTOR','SUPER_SPEEDRUN','SUPER_WARRIOR',
      'SUPER_FIREMAN','SUPER_DESTROYER',
    ],
  },
};

// ─── Stato runtime ───────────────────────────────────────────────────────────

const _unlocked = new Set();   // id achievement già sbloccati
const _queue    = [];          // coda notifiche da mostrare
let   _showing  = false;       // true mentre una notifica è visibile

// ─── Unlock ──────────────────────────────────────────────────────────────────

/**
 * Tenta di sbloccare un achievement.
 * Se già sbloccato non fa nulla.
 * Dopo ogni unlock controlla se si sbloccano super/final a cascata.
 */
export function unlockAchievement(id) {
  if (_unlocked.has(id)) return;
  const ach = ACHIEVEMENTS[id];
  if (!ach) { console.warn(`[achievements] Unknown id: ${id}`); return; }

  _unlocked.add(id);
  _enqueueNotification(ach);

  // Controlla super e final a cascata
  for (const a of Object.values(ACHIEVEMENTS)) {
    if (a.requires?.length > 0 && !_unlocked.has(a.id)) {
      if (a.requires.every(r => _unlocked.has(r))) {
        unlockAchievement(a.id);
      }
    }
  }
}

export function isUnlocked(id) {
  return _unlocked.has(id);
}

export function getUnlocked() {
  return _unlocked;
}

// ─── Coda notifiche ──────────────────────────────────────────────────────────

const SHOW_MS  = 2000;   // tempo visibile
const FADE_MS  = 500;    // durata dissolvenza uscita

function _enqueueNotification(ach) {
  _queue.push(ach);
  if (!_showing) _processQueue();
}

function _processQueue() {
  if (_queue.length === 0) { _showing = false; return; }
  _showing = true;
  const ach = _queue.shift();
  _showToast(ach, () => _processQueue());
}

function _showToast(ach, onDone) {
  // Rimuovi eventuale toast precedente rimasto
  document.getElementById('ach-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'ach-toast';

  const typeColor = ach.type === 'final' ? '#ffd700'
                  : ach.type === 'super' ? '#a78bfa'
                  : '#a8ff78';

  const typeLabel = ach.type === 'final' ? '🏆 Final Achievement'
                  : ach.type === 'super' ? '⭐ Super Achievement'
                  : '✅ Achievement Unlocked';

  Object.assign(toast.style, {
    position:      'fixed',
    bottom:        '32px',
    right:         '28px',
    minWidth:      '280px',
    maxWidth:      '340px',
    padding:       '14px 18px',
    borderRadius:  '12px',
    background:    'rgba(10, 18, 10, 0.93)',
    border:        `1px solid ${typeColor}44`,
    boxShadow:     '0 8px 32px rgba(0,0,0,0.5)',
    color:         '#f0f0f0',
    fontFamily:    'inherit',
    zIndex:        '200',
    opacity:       '0',
    transition:    `opacity ${FADE_MS * 0.5}ms ease`,
    pointerEvents: 'none',
  });

  toast.innerHTML = `
    <div style="font-size:11px;color:${typeColor};font-weight:700;
                letter-spacing:0.05em;margin-bottom:4px;">${typeLabel}</div>
    <div style="font-size:14px;font-weight:700;color:#ffffff;
                margin-bottom:3px;">${ach.title}</div>
    <div style="font-size:12px;color:#b0c8b0;line-height:1.4;">${ach.desc}</div>
  `;

  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
  });

  // Dopo SHOW_MS → fade out → rimuovi → prossimo
  setTimeout(() => {
    toast.style.transition = `opacity ${FADE_MS}ms ease`;
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.remove();
      onDone();
    }, FADE_MS);
  }, SHOW_MS);
}


// ─── Helpers torce ───────────────────────────────────────────────────────────

// Cambia questo numero con il totale di torce a muro SPENTE nel tuo dungeon.
// Cerca in dungeon.js quante createTorchInstance hanno startLit = false.
const TOTAL_WALL_TORCHES = 2; // ← solo le 2 torce puzzle stanza 1, accese dal player

let _wallTorchesLitCount = 0;
let _handTorchLit = false;    // ← flag separato per la torcia in mano

export function onWallTorchLit() {
  _wallTorchesLitCount++;
  console.log('[ACH] onWallTorchLit → count:', _wallTorchesLitCount, '| handLit:', _handTorchLit, '| total:', TOTAL_WALL_TORCHES);
  unlockAchievement('LIGHT_WALL_TORCH');

  if (_wallTorchesLitCount >= TOTAL_WALL_TORCHES && _handTorchLit) {
    unlockAchievement('SUPER_FIREMAN');
  }
}

export function onHandTorchLit() {
  _handTorchLit = true;
  console.log('[ACH] onHandTorchLit → count:', _wallTorchesLitCount, '| handLit:', _handTorchLit, '| total:', TOTAL_WALL_TORCHES);
  unlockAchievement('LIGHT_HAND_TORCH');

  if (_wallTorchesLitCount >= TOTAL_WALL_TORCHES) {
    unlockAchievement('SUPER_FIREMAN');
  }
}