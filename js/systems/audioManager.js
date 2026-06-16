// Modulo singleton per audio condivisi di gioco.
// Il buffer viene caricato una sola volta e riusato da qualsiasi modulo.

let _ctx = null;
const _buffers = {};

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  return _ctx;
}


export function warmupAudioContext() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      // Context caldo e pronto — crea e distruggi subito un buffer silenzioso
      const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
      source.stop(0.001);
    });
  }
}

/**
 * Precarica un file audio e lo salva con una chiave.
 * @param {string} key   - Identificatore (es. 'woodDestroy')
 * @param {string} url   - Path relativo al file mp3
 */
export async function preloadSound(key, url) {
  if (_buffers[key]) return;
  try {
    const ctx      = getCtx();
    const response = await fetch(url);
    const array    = await response.arrayBuffer();
    _buffers[key]  = await ctx.decodeAudioData(array);
  } catch (err) {
    console.warn(`[audioManager] Errore caricamento "${key}":`, err);
  }
}

/**
 * Riproduce un suono già caricato.
 * @param {string} key          - Chiave del buffer
 * @param {number} volume       - Gain (0.0 → 1.0)
 * @param {number} playbackRate - Velocità (1.0 = normale, 1.5 = accelerato)
 * @param {number} offset       - Secondo di inizio nel buffer (default 0)
 * @param {number|undefined} duration - Durata in secondi (undefined = tutto)
 */
export function playSound(key, { volume = 1.0, playbackRate = 1.0, offset = 0, duration } = {}) {
  const ctx    = getCtx();
  const buffer = _buffers[key];
  if (!buffer) return;
  if (ctx.state === 'suspended') ctx.resume();

  const source = ctx.createBufferSource();
  source.buffer       = buffer;
  source.playbackRate.value = playbackRate;

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  // duration undefined → riproduci tutto il buffer dal offset
  if (duration !== undefined) {
    source.start(0, offset, duration);
  } else {
    source.start(0, offset);
  }
}

// Aggiunta in fondo al file audioManager.js esistente

const _loopingSources = {}; // chiave → { source, gainNode }

/**
 * Avvia un suono in loop continuo. Se già in corso, non fa nulla.
 * Restituisce la coppia { source, gainNode } per aggiornare playbackRate.
 */
export function startLoopingSound(key, { volume = 1.0, playbackRate = 1.0 } = {}) {
  if (_loopingSources[key]) return _loopingSources[key]; // già attivo

  const ctx    = getCtx();
  const buffer = _buffers[key];
  if (!buffer) return null;
  if (ctx.state === 'suspended') ctx.resume();

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop   = true;
  source.playbackRate.value = playbackRate;
  source.connect(gainNode);
  source.start(0);

  _loopingSources[key] = { source, gainNode };
  return _loopingSources[key];
}

/**
 * Ferma il loop e lo rimuove dal registro.
 */
export function stopLoopingSound(key) {
  const entry = _loopingSources[key];
  if (!entry) return;

  try {
    entry.source.onended = null;
    entry.source.stop(0);
  } catch (_) {}

  try {
    entry.source.disconnect();
  } catch (_) {}

  try {
    entry.gainNode.disconnect();
  } catch (_) {}

  delete _loopingSources[key];
}

/**
 * Aggiorna il playbackRate di un loop in corso.
 */
export function setLoopPlaybackRate(key, rate) {
  const entry = _loopingSources[key];
  if (!entry) return;
  entry.source.playbackRate.value = rate;
}

/**
 * Riproduce un suono one-shot e, al termine, avvia un loop continuo.
 * @param {string} oneshotKey  - Chiave del suono introduttivo
 * @param {string} loopKey     - Chiave del suono da loopare dopo
 * @param {object} oneshotOpts - Opzioni per il one-shot { volume, playbackRate }
 * @param {object} loopOpts    - Opzioni per il loop    { volume, playbackRate }
 */
export function startLoopAfterSound(oneshotKey, loopKey, oneshotOpts = {}, loopOpts = {}) {
  const ctx          = getCtx();
  const bufferShot   = _buffers[oneshotKey];
  const bufferLoop   = _buffers[loopKey];
  if (!bufferShot || !bufferLoop) return;
  if (ctx.state === 'suspended') ctx.resume();

  // Ferma eventuale loop già attivo (es. torcia riaccesa)
  stopLoopingSound(loopKey);

  const gainShot = ctx.createGain();
  gainShot.gain.value = oneshotOpts.volume ?? 1.0;
  gainShot.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = bufferShot;
  source.playbackRate.value = oneshotOpts.playbackRate ?? 1.0;
  source.connect(gainShot);
  source.start(0);

  // Quando il one-shot finisce, avvia il loop
  source.onended = () => {
    gainShot.disconnect();
    startLoopingSound(loopKey, loopOpts);
  };
}

export function stopFootsteps() {
  stopLoopingSound('footsteps');
}

/**
 * Aggiorna il volume (gain) di un loop in corso.
 * Usato per l'audio di prossimità (es. whoosh pendolo).
 * @param {string} key    - Chiave del loop
 * @param {number} volume - Gain target (0.0 → 1.0)
 */
export function setLoopVolume(key, volume) {
  const entry = _loopingSources[key];
  if (!entry) return;
  entry.gainNode.gain.value = Math.max(0, Math.min(1, volume));
}


export function setAudioContext(externalCtx) {
  if (_ctx) return; // già impostato, non sovrascrivere
  _ctx = externalCtx;
}

export function getAudioContext() {
  return _ctx;
}


// ── Sistema audio danno player ────────────────────────────────────────────────
// Comportamento:
// - Colpo ricevuto → audio parte dal punto in cui si era fermato (o da 0 la prima volta)
// - Nessun colpo per 1 secondo → audio si ferma, salva il punto
// - Nuovo colpo → riprende esattamente da dove si era fermato
// - Quando il buffer finisce naturalmente → il bookmark torna a 0

let _dmgSource       = null;
let _dmgGain         = null;
let _dmgStartCtxTime = 0;   // ctx.currentTime quando la source è partita
let _dmgStartOffset  = 0;   // offset nel buffer da cui è partita
let _dmgBookmark     = 0;   // ← punto salvato all'ultimo stop
let _dmgStopTimeout  = null;

const DAMAGE_SOUND_SUSTAIN = 1.0; // secondi di audio dopo l'ultimo colpo



