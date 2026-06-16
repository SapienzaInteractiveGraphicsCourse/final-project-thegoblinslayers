// ── Costanti di gioco (invariate) ─────────────────────────────────────────────
export const MOB_HP_MAX       = 300;
export const MOB_SPEED        = 3.8;
export const MOB_ATTACK_RANGE = 2.0;
export const MOB_CHAIN_HIT_RANGE = 2.25;   // hit effettiva attackChain
export const MOB_POWER_HIT_RANGE = 2.45;   // hit effettiva powerAttack
export const MOB_SHIELD_BASH_HIT_RANGE = 2.55; // hit effettiva bash
//const MOB_ATTACK_RATE  = 1.8;
export const MOB_STOP_RADIUS  = 1.0;
export const ACTIVATE_DELAY   = 1.5;
export const MOB_HALF_W       = 0.35;


// Danno per tipo di attacco — valori separati e bilanciati
export const MOB_CHAIN_DAMAGE        = 12;   // colpo normale: rapido, basso
export const MOB_POWER_DAMAGE        = 35;   // power attack: lento, devastante
export const MOB_SHIELD_BASH_DAMAGE  = 25;   // shield bash: break guardia + danno fisso


// timeScale > 1 = animazione più veloce, < 1 = più lenta.
// Calibra questo valore fino a ottenere ~1.5s per catena completa.
export const ATK_TIME_SCALE = 1.6;
export const POWER_ATTACK_TIME_SCALE = 1.35;
export const SHIELD_BASH_TIME_SCALE = 1.45;


export const SHIELD_HIT_THRESHOLD = 2; // colpi ricevuti prima di attivare lo scudo
export const PHASE2_SHIELD_HIT_THRESHOLD = 1;
export const PHASE2_BLOCK_CHANCE = 0.55;

export const MOB_MAX_BLOCK_REACTIONS = 3;       // colpi prima di abbassare lo scudo
export const MOB_BLOCK_REACTION_COOLDOWN = 0.4; // secondi minimi tra una reaction e l'altra


export const PHASE2_POWER_BASE_CHANCE = 0.30;
export const PHASE2_POWER_BONUS_AFTER_2_CHAINS = 0.45;
export const PHASE2_POWER_FORCED_AFTER_3_CHAINS = true;
export const POWER_ATTACK_COOLDOWN = 2.5;