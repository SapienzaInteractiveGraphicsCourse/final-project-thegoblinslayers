// js/ui/inventory.js
// Gestisce la logica degli slot (primary / secondary / bag1 / bag2) e l'overlay UI.
// I flag legacy di state (hasAxe, hasTorch, hasSword, ecc.) vengono sincronizzati qui
// in modo che il resto del codice (torch.js, axe.js, sword.js) continui a funzionare.

import { gameState } from '../core/state.js';
import { playSound, stopLoopingSound, startLoopingSound } from '../systems/audioManager.js';
import { ensureViewShield } from '../world/shield.js';

// ─── Tipi di oggetto ───────────────────────────────────────────────────────────
export const ITEM_TYPES = {
  AXE:    'axe',
  TORCH:  'torch',
  SHIELD: 'shield',
  SWORD:  'sword',       
};

// Quali tipi sono armi → vanno in PRIMARY (mano destra)
const WEAPON_TYPES = new Set([ITEM_TYPES.AXE, ITEM_TYPES.SWORD]);

// Icone e label visualizzati nello slot
const ITEM_ICONS = {
  [ITEM_TYPES.AXE]:    '🪓',
  [ITEM_TYPES.TORCH]:  '🕯️',
  [ITEM_TYPES.SHIELD]: '🛡️',
  [ITEM_TYPES.SWORD]:  '🗡️',
};

const ITEM_LABELS = {
  [ITEM_TYPES.AXE]:    'Axe',
  [ITEM_TYPES.TORCH]:  'Torch',
  [ITEM_TYPES.SHIELD]: 'Shield',
  [ITEM_TYPES.SWORD]:  'Sword',
};

// ─── Statistiche oggetto per il tooltip ────────────────────────────────────────
// attackSpeed  : durata totale dello swing in secondi (dal campo state.js corrispondente)
// damage       : danni approssimativi per colpo (bilanciati su: danni × colpi_necessari / durata_swing)
//                Ascia:  3 colpi × 0.48s =  1.44s totale per distruggere  → danni alto, lento
//                Spada:  5 colpi × 0.28s =  1.40s totale per distruggere  → danni basso, veloce
// description  : stringa breve per l'esame / contestualizzazione
const ITEM_STATS = {
  [ITEM_TYPES.AXE]: {
    attackSpeed:  0.48,
    damage:       5,
    description:  'Heavy blow. Requires 3 hits to break through a barrel.',
  },
  [ITEM_TYPES.SWORD]: {
    attackSpeed:  0.28,
    damage:       3,
    description:  'Quick shot. Requires 5 hits to break through a barrel.',
  },
  // Torcia e scudo non hanno stats di attacco — il tooltip mostra solo il nome
  [ITEM_TYPES.TORCH]: {
    attackSpeed:  null,
    damage:       null,
    description:  'Light up the dungeon. Can light unlit torches.',
  },
  [ITEM_TYPES.SHIELD]: {
    attackSpeed:  null,
    damage:       null,
    description:  'Blocks enemy shots. Press and hold right button.',
  },
};

// ─── Riferimenti DOM ──────────────────────────────────────────────────────────
let overlayEl   = null;
let slotEls     = {};      // { primary, secondary, bag1, bag2 }
let tooltipEl   = null;    // tooltip DOM condiviso tra tutti gli slot

// ─── Drag & drop state ────────────────────────────────────────────────────────
let dragState = {
  active:    false,
  itemType:  null,
  fromSlot:  null,
  ghostEl:   null,
};

// ─── Creazione UI ─────────────────────────────────────────────────────────────
export function createInventoryUI(state) {
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.id = 'inventory-overlay';
  Object.assign(overlayEl.style, {
    position:      'absolute',
    top:           '190px',
    left:          '16px',
    zIndex:        '20',
    padding:       '12px 16px',
    background:    'rgba(0, 0, 0, 0.72)',
    border:        '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius:  '10px',
    color:         '#f5f5f5',
    fontFamily:    'Arial, sans-serif',
    display:       'none',
    userSelect:    'none',
    pointerEvents: 'auto',
  });

  // Titolo
  const title = document.createElement('p');
  title.textContent = '🎒 Inventory';
  Object.assign(title.style, {
    margin:        '0 0 10px 0',
    fontWeight:    'bold',
    fontSize:      '13px',
    letterSpacing: '0.05em',
    color:         '#ffd166',
  });
  overlayEl.appendChild(title);

  // Riga slot — ora 4 slot
  const row = document.createElement('div');
  Object.assign(row.style, {
    display:    'flex',
    gap:        '12px',
    alignItems: 'flex-start',
  });
  overlayEl.appendChild(row);

  // Definizione dei 4 slot con label
  const SLOT_LABELS = {
    primary:   '⚔️ Weapon',
    secondary: '🕯️ Utility',
    bag1:      '🎒 Slot Bag 1',
    bag2:      '🎒 Slot Bag 2',
  };

  ['primary', 'secondary', 'bag1', 'bag2'].forEach((slotName) => {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      gap:           '4px',
      position:      'relative',  // necessario per il tooltip absolute dentro
    });

    const labelEl = document.createElement('span');
    labelEl.textContent = SLOT_LABELS[slotName];
    Object.assign(labelEl.style, {
      fontSize:      '10px',
      color:         '#aaa',
      letterSpacing: '0.04em',
    });

    const slotEl = document.createElement('div');
    slotEl.dataset.slot = slotName;
    Object.assign(slotEl.style, {
      width:          '60px',
      height:         '60px',
      background:     'rgba(255,255,255,0.07)',
      border:         '2px solid rgba(255,255,255,0.20)',
      borderRadius:   '8px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       '28px',
      cursor:         'default',
      position:       'relative',
      transition:     'border-color 0.15s',
    });

    wrapper.appendChild(labelEl);
    wrapper.appendChild(slotEl);
    row.appendChild(wrapper);
    slotEls[slotName] = slotEl;

    // Drag & drop
    slotEl.addEventListener('mousedown',  (e) => onSlotMouseDown(e, slotName));
    slotEl.addEventListener('mouseup',    (e) => onSlotMouseUp(e, slotName));
    slotEl.addEventListener('mouseenter', ()  => onSlotEnter(slotName));
    slotEl.addEventListener('mouseleave', ()  => onSlotLeave(slotName));
  });

  // Hint tasto F
  const hint = document.createElement('p');
  hint.textContent = 'F — close inventory';
  Object.assign(hint.style, {
    margin:   '10px 0 0 0',
    fontSize: '10px',
    color:    '#666',
  });
  overlayEl.appendChild(hint);

  document.body.appendChild(overlayEl);

  // ── Tooltip DOM (condiviso, spostato via JS sopra lo slot hovered) ──────────
  tooltipEl = document.createElement('div');
  tooltipEl.id = 'inventory-tooltip';
  Object.assign(tooltipEl.style, {
    position:      'absolute',
    bottom:        '72px',          // appare sopra lo slot (60px slot + 8px gap + 4px)
    left:          '50%',
    transform:     'translateX(-50%) translateY(4px)',
    background:    'rgba(10, 10, 10, 0.88)',
    border:        '1px solid rgba(255, 209, 102, 0.35)',
    borderRadius:  '7px',
    padding:       '8px 10px',
    minWidth:      '130px',
    maxWidth:      '190px',
    color:         '#f0f0f0',
    fontFamily:    'Arial, sans-serif',
    fontSize:      '11px',
    lineHeight:    '1.5',
    pointerEvents: 'none',     // non blocca il drag
    zIndex:        '50',
    opacity:       '0',
    transition:    'opacity 0.15s ease, transform 0.15s ease',
    whiteSpace:    'normal',
  });

  // Il tooltip viene appeso al wrapper dello slot al momento del mouseenter
  // (non al body) così la posizione relative funziona senza calcoli pixel

  // Ghost per il drag
  dragState.ghostEl = document.createElement('div');
  Object.assign(dragState.ghostEl.style, {
    position:      'fixed',
    pointerEvents: 'none',
    fontSize:      '32px',
    zIndex:        '100',
    display:       'none',
    transform:     'translate(-50%, -50%)',
  });
  document.body.appendChild(dragState.ghostEl);

  document.addEventListener('mousemove', onGlobalMouseMove);
  document.addEventListener('mouseup',   onGlobalMouseUp);
}

// ─── Toggle / close overlay ───────────────────────────────────────────────────
export function toggleInventory(state) {
  state.isInventoryOpen = !state.isInventoryOpen;

  // dove gestisci il toggle inventario con F:
  playSound('bagZip', { volume: 0.7, offset: 0, duration: 0.5 });
  
  overlayEl.style.display = state.isInventoryOpen ? 'block' : 'none';
  if (state.isInventoryOpen) refreshInventoryUI(state);
}

export function closeInventory(state) {
  state.isInventoryOpen = false;
  if (overlayEl) overlayEl.style.display = 'none';
  hideTooltip();
}

// ─── Logica slot: addToInventory ──────────────────────────────────────────────
/**
 * Inserisce un oggetto nello slot corretto in base al tipo.
 * Arma (AXE / SWORD) → primary se libero, altrimenti bag1, poi bag2.
 * Non-arma (TORCH / SHIELD) → secondary se libero, altrimenti bag1, poi bag2.
 * Restituisce il nome dello slot in cui è finito, o null se inventario pieno.
 */
export function addToInventory(state, itemType) {
  const inv = state.inventory;

  if (WEAPON_TYPES.has(itemType)) {
    if (!inv.primary) {
      inv.primary = itemType;
      syncLegacyFlags(state);
      applyEquip(state, 'primary', itemType);
      refreshInventoryUI(state);
      return 'primary';
    }
    if (!inv.bag1) {
      inv.bag1 = itemType;
      refreshInventoryUI(state);
      return 'bag1';
    }
    if (!inv.bag2) {
      inv.bag2 = itemType;
      refreshInventoryUI(state);
      return 'bag2';
    }
  } else {
    if (!inv.secondary) {
      inv.secondary = itemType;
      syncLegacyFlags(state);
      applyEquip(state, 'secondary', itemType);
      refreshInventoryUI(state);
      return 'secondary';
    }
    if (!inv.bag1) {
      inv.bag1 = itemType;
      refreshInventoryUI(state);
      return 'bag1';
    }
    if (!inv.bag2) {
      inv.bag2 = itemType;
      refreshInventoryUI(state);
      return 'bag2';
    }
  }

  return null; // inventario pieno
}

/**
 * Rimuove un oggetto dall'inventario (es. oggetto distrutto o consumato).
 */
export function removeFromInventory(state, itemType) {
  const inv = state.inventory;
  ['primary', 'secondary', 'bag1', 'bag2'].forEach((slot) => {
    if (inv[slot] === itemType) {
      inv[slot] = null;
      syncLegacyFlags(state);
      applyUnequip(state, slot, itemType);
    }
  });
  refreshInventoryUI(state);
}

// ─── Equip / Unequip ──────────────────────────────────────────────────────────
function applyEquip(state, slot, itemType) {
  if (slot === 'primary') {
    if (itemType === ITEM_TYPES.AXE) {
      state.hasAxe        = true;
      state.isAxeEquipped = true;
      if (state.viewAxeHolder) state.viewAxeHolder.visible = true;
    }
    if (itemType === ITEM_TYPES.SWORD) {
      state.hasSword        = true;
      state.isSwordEquipped = true;
      if (state.viewSwordHolder) state.viewSwordHolder.visible = true;
    }
  }

  if (slot === 'secondary') {
    if (itemType === ITEM_TYPES.TORCH) {
      state.hasTorch        = true;
      state.isTorchEquipped = true;
      if (state.viewTorchHolder) state.viewTorchHolder.visible = true;
      if (state.heldTorch?.isLit) {
        
          startLoopingSound('torchOnView', { volume: 0.35 });
        }
      }
    }
    if (itemType === ITEM_TYPES.SHIELD) {
      state.hasShield        = true;
      state.isShieldEquipped = true;
      
        ensureViewShield(state);
      }
    }
  

    


function applyUnequip(state, slot, itemType) {
  if (slot === 'primary') {
    if (itemType === ITEM_TYPES.AXE) {
      state.hasAxe        = false;
      state.isAxeEquipped = false;
      if (state.viewAxeHolder) state.viewAxeHolder.visible = false;
    }
    if (itemType === ITEM_TYPES.SWORD) {
      state.hasSword        = false;
      state.isSwordEquipped = false;
      if (state.viewSwordHolder) state.viewSwordHolder.visible = false;
    }
  }

  if (slot === 'secondary') {
    if (itemType === ITEM_TYPES.TORCH) {
      state.hasTorch        = false;
      state.isTorchEquipped = false;
      if (state.viewTorchHolder) state.viewTorchHolder.visible = false;
      stopLoopingSound('torchOnView');
    }
    if (itemType === ITEM_TYPES.SHIELD) {
      state.hasShield        = false;
      state.isShieldEquipped = false;
      state.isBlocking       = false;
      if (state.viewShieldHolder) state.viewShieldHolder.visible = false;
    }
  }
}

// ─── Sincronizzazione flag legacy ─────────────────────────────────────────────
// Mantiene compatibilità con torch.js, axe.js, sword.js che leggono state.hasAxe ecc.
function syncLegacyFlags(state) {
  const inv = state.inventory;

  const allSlots = [inv.primary, inv.secondary, inv.bag1, inv.bag2];

  state.hasAxe   = allSlots.includes(ITEM_TYPES.AXE);
  state.hasTorch = allSlots.includes(ITEM_TYPES.TORCH);
  state.hasSword = allSlots.includes(ITEM_TYPES.SWORD);
  state.hasShield = allSlots.includes(ITEM_TYPES.SHIELD);

  state.isAxeEquipped   = (inv.primary === ITEM_TYPES.AXE);
  state.isSwordEquipped = (inv.primary === ITEM_TYPES.SWORD);
  state.isTorchEquipped = (inv.secondary === ITEM_TYPES.TORCH);
  state.isShieldEquipped = (inv.secondary === ITEM_TYPES.SHIELD);
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function showTooltip(slotName) {
  const inv  = gameState.inventory;
  const item = inv[slotName];
  if (!item) return;                  // slot vuoto → niente tooltip

  const stats = ITEM_STATS[item];
  const label = ITEM_LABELS[item] || item;
  const icon  = ITEM_ICONS[item]  || '?';

  // Costruisce l'HTML interno del tooltip
  let html = `<div style="font-weight:bold;font-size:12px;color:#ffd166;margin-bottom:4px;">${icon} ${label}</div>`;

  if (stats.attackSpeed !== null) {
    // Formatta la velocità come ms per chiarezza visiva
    const speedMs = Math.round(stats.attackSpeed * 1000);
    html += `<div style="color:#aaa;margin-bottom:2px;">⏱ Speed:  <span style="color:#f0f0f0">${speedMs} ms</span></div>`;
    html += `<div style="color:#aaa;margin-bottom:2px;">⚔ Damage:    <span style="color:#f0f0f0">${stats.damage} / hit</span></div>`;
  }

  html += `<div style="color:#888;font-size:10px;margin-top:5px;border-top:1px solid rgba(255,255,255,0.1);padding-top:4px;">${stats.description}</div>`;

  tooltipEl.innerHTML = html;

  // Aggancia il tooltip al wrapper del slot (il padre del slotEl)
  const slotEl      = slotEls[slotName];
  const wrapperEl   = slotEl.parentElement;
  if (!tooltipEl.parentElement || tooltipEl.parentElement !== wrapperEl) {
    wrapperEl.appendChild(tooltipEl);
  }

  // Mostra con transizione
  tooltipEl.style.opacity   = '0';
  tooltipEl.style.transform = 'translateX(-50%) translateY(4px)';
  // Forza reflow prima della transizione (pattern standard per trigger CSS transition)
  tooltipEl.offsetHeight;
  tooltipEl.style.opacity   = '1';
  tooltipEl.style.transform = 'translateX(-50%) translateY(0px)';
}

function hideTooltip() {
  if (!tooltipEl) return;
  tooltipEl.style.opacity   = '0';
  tooltipEl.style.transform = 'translateX(-50%) translateY(4px)';
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────

function onSlotMouseDown(e, slotName) {
  e.preventDefault();
  const inv = gameState.inventory;
  const itemInSlot = inv[slotName];
  if (!itemInSlot) return;

  hideTooltip();   // nasconde il tooltip mentre trascini

  dragState.active   = true;
  dragState.itemType = itemInSlot;
  dragState.fromSlot = slotName;

  dragState.ghostEl.textContent   = ITEM_ICONS[itemInSlot] || '?';
  dragState.ghostEl.style.display = 'block';
  dragState.ghostEl.style.left    = e.clientX + 'px';
  dragState.ghostEl.style.top     = e.clientY + 'px';

  slotEls[slotName].style.opacity = '0.35';
}

function onSlotMouseUp(e, slotName) {
  if (!dragState.active) return;
  e.preventDefault();
  completeDrop(slotName);
}

function onGlobalMouseMove(e) {
  if (!dragState.active) return;
  dragState.ghostEl.style.left = e.clientX + 'px';
  dragState.ghostEl.style.top  = e.clientY + 'px';
}

function onGlobalMouseUp() {
  if (!dragState.active) return;
  cancelDrag();
}

function onSlotEnter(slotName) {
  // Tooltip hover — visibile solo se lo slot è occupato e non stiamo draggando
  if (!dragState.active) {
    showTooltip(slotName);
  }

  if (dragState.active) {
    if (isDropAllowed(dragState.itemType, slotName)) {
      slotEls[slotName].style.borderColor = '#ffd166';
    } else {
      slotEls[slotName].style.borderColor = '#e05c5c';
    }
  }
}

function onSlotLeave(slotName) {
  hideTooltip();
  slotEls[slotName].style.borderColor = 'rgba(255,255,255,0.20)';
}

/**
 * Regole di compatibilità slot:
 * - primary: solo armi (AXE, SWORD)
 * - secondary: solo non-armi (TORCH, SHIELD)
 * - bag1/bag2: accettano qualsiasi tipo
 */
function isDropAllowed(itemType, targetSlot) {
  if (targetSlot === 'primary'   && !WEAPON_TYPES.has(itemType)) return false;
  if (targetSlot === 'secondary' &&  WEAPON_TYPES.has(itemType)) return false;
  return true;
}

function completeDrop(targetSlot) {
  const inv = gameState.inventory;
  const { itemType, fromSlot } = dragState;

  if (fromSlot === targetSlot) { cancelDrag(); return; }
  if (!isDropAllowed(itemType, targetSlot)) { cancelDrag(); return; }

  const itemInTarget = inv[targetSlot];

  // Se lo slot target è occupato, lo swap è possibile solo se l'oggetto
  // nel target può legalmente tornare nel fromSlot
  if (itemInTarget && !isDropAllowed(itemInTarget, fromSlot)) {
    cancelDrag();
    return;
  }

  // Unequip entrambi prima di spostare
  applyUnequip(gameState, fromSlot, itemType);
  if (itemInTarget) applyUnequip(gameState, targetSlot, itemInTarget);

  // Swap
  inv[targetSlot] = itemType;
  inv[fromSlot]   = itemInTarget || null;

  // Equip nei nuovi slot
  applyEquip(gameState, targetSlot, itemType);
  if (itemInTarget) applyEquip(gameState, fromSlot, itemInTarget);

  // ─── Audio: suona quando un oggetto arriva in primary o secondary ────────
  // Caso 1 — drag diretto da bag → primary/secondary
  // Caso 2 — swap: itemInTarget va da primary/secondary a bag,
  //           ma è itemType che ARRIVA in primary/secondary
  const arrivaPrimary   = targetSlot === 'primary';
  const arrivaSecondary = targetSlot === 'secondary';

  if (arrivaPrimary) {
    if (itemType === ITEM_TYPES.AXE)   playSound('axeSwing',   { volume: 0.65 });
    if (itemType === ITEM_TYPES.SWORD)  playSound('swordEquip', { volume: 0.75 });
  }
  if (arrivaSecondary) {
    if (itemType === ITEM_TYPES.SHIELD) playSound('shieldEquip', { volume: 0.80, duration: 1.0 });
  }

  // Caso swap inverso: itemInTarget arriva nel fromSlot che è primary/secondary
  if (itemInTarget) {
    if (fromSlot === 'primary') {
      if (itemInTarget === ITEM_TYPES.AXE)   playSound('axeSwing',   { volume: 0.65 });
      if (itemInTarget === ITEM_TYPES.SWORD)  playSound('swordEquip', { volume: 0.75 });
    }
    if (fromSlot === 'secondary') {
      if (itemInTarget === ITEM_TYPES.SHIELD) playSound('shieldEquip', { volume: 0.80, duration: 1.0 });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  syncLegacyFlags(gameState);
  cleanupDrag();
  refreshInventoryUI(gameState);
}

function cancelDrag() {
  cleanupDrag();
  refreshInventoryUI(gameState);
}

function cleanupDrag() {
  dragState.active   = false;
  dragState.itemType = null;
  dragState.fromSlot = null;
  dragState.ghostEl.style.display = 'none';
  Object.values(slotEls).forEach((el) => {
    el.style.opacity     = '1';
    el.style.borderColor = 'rgba(255,255,255,0.20)';
  });
}

// ─── Refresh visivo ────────────────────────────────────────────────────────────
export function refreshInventoryUI(state) {
  if (!overlayEl) return;
  const inv = state.inventory;

  ['primary', 'secondary', 'bag1', 'bag2'].forEach((slotName) => {
    const el   = slotEls[slotName];
    const item = inv[slotName];

    el.innerHTML = '';

    if (item) {
      const icon = document.createElement('span');
      icon.textContent     = ITEM_ICONS[item] || '?';
      icon.style.pointerEvents = 'none';

      const label = document.createElement('span');
      label.textContent = ITEM_LABELS[item] || item;
      Object.assign(label.style, {
        position:      'absolute',
        bottom:        '3px',
        fontSize:      '9px',
        color:         '#ccc',
        pointerEvents: 'none',
      });

      el.appendChild(icon);
      el.appendChild(label);
      el.style.cursor     = 'grab';
      el.style.background = 'rgba(255, 209, 102, 0.10)';
    } else {
      el.style.cursor     = 'default';
      el.style.background = 'rgba(255,255,255,0.07)';
    }
  });
}