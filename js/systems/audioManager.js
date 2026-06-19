// Singleton module for shared game audio.
// The buffer is loaded once and reused by any module.

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
      // Context warm and ready — create and immediately destroy a silent buffer
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
 * Preloads an audio file and saves it with a key.
 * @param {string} key - Identifier (e.g. 'woodDestroy')
 * @param {string} url - Relative path to the mp3 file
 */
export async function preloadSound(key, url) {
  if (_buffers[key]) return;
  try {
    const ctx = getCtx();
    const response = await fetch(url);
    const array = await response.arrayBuffer();
    _buffers[key] = await ctx.decodeAudioData(array);
  } catch (err) {
    console.warn(`[audioManager] Error loading "${key}":`, err);
  }
}

/**
 * Plays an already loaded sound.
 * @param {string} key - Buffer key
 * @param {number} volume - Gain (0.0 → 1.0)
 * @param {number} playbackRate - Speed (1.0 = normal, 1.5 = faster)
 * @param {number} offset - Start second in the buffer (default 0)
 * @param {number|undefined} duration - Duration in seconds (undefined = full buffer)
 */
export function playSound(key, { volume = 1.0, playbackRate = 1.0, offset = 0, duration } = {}) {
  const ctx = getCtx();
  const buffer = _buffers[key];
  if (!buffer) return;
  if (ctx.state === 'suspended') ctx.resume();

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = playbackRate;

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  // duration undefined → play the entire buffer from offset
  if (duration !== undefined) {
    source.start(0, offset, duration);
  } else {
    source.start(0, offset);
  }
}

// ── Looping sound system ───────────────────────────────────────────────────────

const _loopingSources = {}; // key → { source, gainNode }

/**
 * Starts a continuously looping sound. If already playing, does nothing.
 * Returns the { source, gainNode } pair for updating playbackRate.
 */
export function startLoopingSound(key, { volume = 1.0, playbackRate = 1.0 } = {}) {
  if (_loopingSources[key]) return _loopingSources[key]; // already active

  const ctx = getCtx();
  const buffer = _buffers[key];
  if (!buffer) return null;
  if (ctx.state === 'suspended') ctx.resume();

  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;
  gainNode.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.playbackRate.value = playbackRate;
  source.connect(gainNode);
  source.start(0);

  _loopingSources[key] = { source, gainNode };
  return _loopingSources[key];
}

/**
 * Stops the loop and removes it from the registry.
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
 * Updates the playbackRate of a running loop.
 */
export function setLoopPlaybackRate(key, rate) {
  const entry = _loopingSources[key];
  if (!entry) return;
  entry.source.playbackRate.value = rate;
}

/**
 * Plays a one-shot sound and, when it ends, starts a continuous loop.
 * @param {string} oneshotKey - Key of the introductory sound
 * @param {string} loopKey - Key of the sound to loop afterwards
 * @param {object} oneshotOpts - Options for the one-shot { volume, playbackRate }
 * @param {object} loopOpts - Options for the loop { volume, playbackRate }
 */
export function startLoopAfterSound(oneshotKey, loopKey, oneshotOpts = {}, loopOpts = {}) {
  const ctx = getCtx();
  const bufferShot = _buffers[oneshotKey];
  const bufferLoop = _buffers[loopKey];
  if (!bufferShot || !bufferLoop) return;
  if (ctx.state === 'suspended') ctx.resume();

  // Stop any existing loop (e.g. torch re-ignited)
  stopLoopingSound(loopKey);

  const gainShot = ctx.createGain();
  gainShot.gain.value = oneshotOpts.volume ?? 1.0;
  gainShot.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = bufferShot;
  source.playbackRate.value = oneshotOpts.playbackRate ?? 1.0;
  source.connect(gainShot);
  source.start(0);

  // When the one-shot ends, start the loop
  source.onended = () => {
    gainShot.disconnect();
    startLoopingSound(loopKey, loopOpts);
  };
}

export function stopFootsteps() {
  stopLoopingSound('footsteps');
}

/**
 * Updates the volume (gain) of a running loop.
 * Used for proximity audio (e.g. pendulum whoosh).
 * @param {string} key - Loop key
 * @param {number} volume - Target gain (0.0 → 1.0)
 */
export function setLoopVolume(key, volume) {
  const entry = _loopingSources[key];
  if (!entry) return;
  entry.gainNode.gain.value = Math.max(0, Math.min(1, volume));
}

export function setAudioContext(externalCtx) {
  if (_ctx) return; // already set, do not overwrite
  _ctx = externalCtx;
}

export function getAudioContext() {
  return _ctx;
}

// ── Player damage audio system ────────────────────────────────────────────────
// Behaviour:
// - Hit received → audio resumes from the saved bookmark (or from 0 on first hit)
// - No hit for 1 second → audio stops, saves position
// - New hit → resumes exactly from where it was stopped
// - When the buffer ends naturally → bookmark resets to 0

let _dmgSource = null;
let _dmgGain = null;
let _dmgStartCtxTime = 0;  // ctx.currentTime when the source started
let _dmgStartOffset = 0;   // buffer offset from which it started
let _dmgBookmark = 0;      // ← position saved on last stop
let _dmgStopTimeout = null;

const DAMAGE_SOUND_SUSTAIN = 1.0; // seconds of audio after the last hit


export function fadeOutLoopingSound(key, duration = 3) {
  const entry = _loopingSources[key];
  if (!entry) return;

  const ctx  = getCtx();
  const gain = entry.gainNode.gain;
  const now  = ctx.currentTime;

  // Leggi il volume corrente tramite computedValue prima di schedulare
  const currentVolume = gain.value;

  // Cancella qualsiasi automazione precedente
  gain.cancelScheduledValues(0);

  // Ancora il valore corrente ADESSO, poi scendi a 0
  gain.setValueAtTime(currentVolume, now);
  gain.linearRampToValueAtTime(0.0001, now + duration); // non zero esatto: evita click audio

  // Stop dopo la dissolvenza — usa ctx.currentTime al momento del timeout
  const timeoutId = setTimeout(() => {
    const e = _loopingSources[key];
    if (!e) return; // già stoppato da qualcun altro

    try { e.source.stop(ctx.currentTime); } catch (_) {}
    try { e.source.disconnect(); }         catch (_) {}
    try { e.gainNode.disconnect(); }       catch (_) {}
    delete _loopingSources[key];

  }, (duration + 0.1) * 1000); // +0.1s margine sicurezza

  // Salva il timeoutId per eventuale cancellazione anticipata
  entry.fadeTimeoutId = timeoutId;
}