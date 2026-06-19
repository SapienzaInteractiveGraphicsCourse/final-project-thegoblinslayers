// js/ui/achievementPanel.js
// Pannello achievements aperto/chiuso con tasto X.

import { ACHIEVEMENTS, getUnlocked } from '../systems/achievementManager.js';

let _panel = null;
let _isOpen = false;

export function initAchievementPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'ach-panel-overlay';
  Object.assign(overlay.style, {
    position:       'fixed',
    inset:          '0',
    display:        'none',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(0,0,0,0.72)',
    zIndex:         '25000',
    fontFamily:     'inherit',
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    position:     'relative',      // ← necessario per il tasto ✕ assoluto
    width:        '620px',
    maxWidth:     '95vw',
    maxHeight:    '80vh',
    overflowY:    'auto',
    background:   'rgba(8, 18, 8, 0.97)',
    border:       '1px solid rgba(100,255,100,0.15)',
    borderRadius: '16px',
    padding:      '28px 28px 20px',
    color:        '#f0f0f0',
    boxShadow:    '0 24px 64px rgba(0,0,0,0.6)',
  });

  // ── Tasto ✕ in alto a sinistra dentro il box ─────────────────────────
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, {
    position:   'absolute',
    top:        '12px',
    left:       '16px',
    background: 'none',
    border:     'none',
    color:      '#888',
    fontSize:   '20px',
    cursor:     'pointer',
    padding:    '4px 8px',
    lineHeight: '1',
    transition: 'color .2s',
  });
  closeBtn.addEventListener('mouseover', () => closeBtn.style.color = '#fff');
  closeBtn.addEventListener('mouseout',  () => closeBtn.style.color = '#888');
  closeBtn.addEventListener('click', closePanel);
  box.appendChild(closeBtn);
  // ─────────────────────────────────────────────────────────────────────

  const header = document.createElement('div');
  Object.assign(header.style, {
    display:        'flex',
    justifyContent: 'center',   // ← centrato ora che ✕ è assoluto
    alignItems:     'center',
    marginBottom:   '20px',
  });
  header.innerHTML = `<h2 style="margin:0;font-size:22px;color:#a8ff78;">🏅 Achievements</h2>`;

  const list = document.createElement('div');
  list.id = 'ach-panel-list';

  box.appendChild(header);
  box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // ── Tasto X da tastiera: bloccato durante win screen ─────────────────
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyX') return;
    if (document.getElementById('win-screen')?.classList.contains('active')) return;
    e.preventDefault();
    _isOpen ? closePanel() : openPanel();
  });

  _panel = overlay;
}

export function openPanel() {
  if (!_panel) return;
  _renderList();
  _panel.style.display = 'flex';
  _isOpen = true;
  document.exitPointerLock?.();
}

export function closePanel() {
  if (!_panel) return;
  _panel.style.display = 'none';
  _isOpen = false;
}

export function isPanelOpen() { return _isOpen; }

// ─── Render interno ──────────────────────────────────────────────────────────

function _renderList() {
  const list = document.getElementById('ach-panel-list');
  if (!list) return;
  list.innerHTML = '';
  const unlocked = getUnlocked();

  const sections = [
    { label: '✅ Base Achievements',  type: 'base',  color: '#a8ff78' },
    { label: '⭐ Super Achievements', type: 'super', color: '#a78bfa' },
    { label: '🏆 Final Achievement',  type: 'final', color: '#ffd700' },
  ];

  for (const section of sections) {
    const items = Object.values(ACHIEVEMENTS).filter(a => a.type === section.type);

    const sectionEl = document.createElement('div');
    sectionEl.style.marginBottom = '18px';

    const sectionTitle = document.createElement('div');
    Object.assign(sectionTitle.style, {
      fontSize:     '13px',
      fontWeight:   '700',
      color:        section.color,
      letterSpacing:'0.06em',
      marginBottom: '8px',
      borderBottom: `1px solid ${section.color}33`,
      paddingBottom:'4px',
    });
    sectionTitle.textContent = section.label;
    sectionEl.appendChild(sectionTitle);

    for (const ach of items) {
      const done = unlocked.has(ach.id);
      const row = document.createElement('div');
      Object.assign(row.style, {
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        padding:       '8px 10px',
        marginBottom:  '4px',
        borderRadius:  '8px',
        background:    done ? 'rgba(168,255,120,0.07)' : 'rgba(255,255,255,0.03)',
        opacity:       done ? '1' : '0.45',
        transition:    'opacity .2s',
      });

      const icon = document.createElement('div');
      icon.textContent = done ? '🔓' : '🔒';
      icon.style.fontSize = '20px';

      const text = document.createElement('div');
      text.innerHTML = `
        <div style="font-size:13px;font-weight:700;color:${done ? section.color : '#888'};">
          ${ach.title}
        </div>
        <div style="font-size:11px;color:#8a9a8a;margin-top:2px;">
          ${done ? ach.desc : '???'}
        </div>
      `;

      row.appendChild(icon);
      row.appendChild(text);
      sectionEl.appendChild(row);
    }

    list.appendChild(sectionEl);
  }

  // Contatore totale
  const baseItems  = Object.values(ACHIEVEMENTS).filter(a => a.type === 'base');
  const superItems = Object.values(ACHIEVEMENTS).filter(a => a.type === 'super');
  const total = baseItems.length + superItems.length + 1; // +1 final
  const done  = unlocked.size;

  const counter = document.createElement('div');
  Object.assign(counter.style, {
    textAlign:  'right',
    fontSize:   '12px',
    color:      '#667766',
    marginTop:  '8px',
  });
  counter.textContent = `${done} / ${total} unlocked`;
  list.appendChild(counter);
}