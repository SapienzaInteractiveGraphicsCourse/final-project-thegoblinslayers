// js/ui/screenEffects.js
// Effetti visivi overlay: vignette danno player + flash colpo mob.

const _vignette = document.getElementById('damage-vignette');
const _flash    = document.getElementById('hit-flash');

function _triggerOverlay(el) {
  if (!el) return;
  // Rimuove e riaggiunge la classe per resettare l'animazione
  // anche se è già in corso (colpi rapidi consecutivi)
  el.classList.remove('active');
  void el.offsetWidth; // forza reflow — resetta l'animazione CSS
  el.classList.add('active');

  el.addEventListener('animationend', () => {
    el.classList.remove('active');
  }, { once: true });
}

/** Chiama quando il player subisce danno. */
export function triggerDamageVignette() {
  _triggerOverlay(_vignette);
}

