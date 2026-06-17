// systems/audioSetup.js
// Responsabilità: tutto il setup audio ambientale e preload.
// Estratto da main.js perché non ha nulla a che fare con il render loop.

import { preloadSound, getAudioContext } from './audioManager.js';
import * as THREE from 'three';

export async function initAmbientAudio() {
    //const ctx = new (window.AudioContext || window.webkitAudioContext)();
    //if (ctx.state === 'suspended') await ctx.resume();

    const ctx = getAudioContext(); 
    if (!ctx) return;

    const al = new THREE.AudioLoader();
    const [bufferLoop, bufferAir] = await Promise.all([
      new Promise((res) => al.load('./assets/audio/dungeon_sound_effect_2_good.mp3', res)),
      new Promise((res) => al.load('./assets/audio/dungeon_air.mp3', res))
    ]);

    const loopSource = ctx.createBufferSource();
    loopSource.buffer = bufferLoop;
    loopSource.loop = true;
    const loopGain = ctx.createGain();
    loopGain.gain.value = 0.35;
    loopSource.connect(loopGain);
    loopGain.connect(ctx.destination);
    loopSource.start(0);

    const airDuration     = bufferAir.duration;
    const airClipLength   = 10;
    const airOffset       = Math.max(0, airDuration - airClipLength);
    const airFadeIn       = 3;
    const intervalSeconds = 20;

    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    airGain.connect(ctx.destination);

    function scheduleAirOverlay() {
      const source = ctx.createBufferSource();
      source.buffer = bufferAir;
      source.connect(airGain);
      const now = ctx.currentTime;
      airGain.gain.cancelScheduledValues(now);
      airGain.gain.setValueAtTime(0, now);
      airGain.gain.linearRampToValueAtTime(0.55, now + airFadeIn);
      source.start(0, airOffset, airClipLength);
      source.onended = () => {
        airGain.gain.setValueAtTime(0, ctx.currentTime);
        setTimeout(scheduleAirOverlay, intervalSeconds * 1000);
      };
    }
    setTimeout(scheduleAirOverlay, intervalSeconds * 1000);
  }

  export function preloadGameSounds() {
    preloadSound('woodDestroy',  './assets/audio/wood_destroy.mp3');
    preloadSound('footsteps',    './assets/audio/footsteps.mp3');
    
    preloadSound('bagZip',       './assets/audio/quick_zip_bag.mp3');
    preloadSound('leverPush',    './assets/audio/lever_push.mp3');

    preloadSound('doorOpen',     './assets/audio/door_open.mp3');
    preloadSound('axeSwing',     './assets/audio/axe_swing_2.mp3');
    preloadSound('swordEquip',   './assets/audio/sword_sfx.wav');
    preloadSound('shieldEquip',  './assets/audio/shield_sound_2.mp3');
    preloadSound('whoosh',       './assets/audio/whoosh_axe_trap.mp3');
    preloadSound('axeTrapHit',   './assets/audio/axe_trap_hit_player.mp3');

    preloadSound('pickupItem',   './assets/audio/pickup_item.mp3');
    preloadSound('fireIgnition', './assets/audio/fire_ignition.mp3');
    preloadSound('torchOnView',  './assets/audio/fire_manor_torch_onview.mp3');

    preloadSound('damagePlayer', './assets/audio/damage_for_player.mp3');
    preloadSound('deathByMob', './assets/audio/death_player_by_mob.mp3');

    preloadSound('mobDamage', './assets/audio/ogre_growl3.mp3');
    preloadSound('mobDeath', './assets/audio/death_monster_growl.mp3');

    preloadSound('ogre_walk',   './assets/audio/ogre_walk.mp3');
    preloadSound('ogre_growl1', './assets/audio/ogre_growl1.mp3');
    preloadSound('ogre_growl2', './assets/audio/ogre_growl2.mp3');
    preloadSound('ogre_growl3', './assets/audio/ogre_growl3.mp3');
    preloadSound('ogre_attack', './assets/audio/ogre_attack.mp3');
    preloadSound('roll', './assets/audio/rolling_stone.mp3');
    preloadSound('impact', './assets/audio/impact.mp3');
  }
