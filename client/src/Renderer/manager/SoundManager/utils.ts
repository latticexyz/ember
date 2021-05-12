import { Sound } from "./types";
import { deferred } from "../../../Backend/Utils/Utils";
import { FADE, SPATIAL_COLUMN_WIDTH, SoundLayer } from "./config";
import { WorldCoord } from "../../../_types/GlobalTypes";

/**
 * Fades a sound to the specified volume without crackling sound by using the underlying WebAudio API
 * @param sound Phaser WebAudio sound object
 * @param volume Volume between 0 and 1 to fade to
 * @param duration Duration for the fade in ms
 */
export async function setVolume(sound: Sound, volume: number, duration: number = FADE) {
  const [resolve, _, promise] = deferred<void>();

  if (!sound) return Promise.resolve();
  const context = sound.volumeNode.context;
  const gain = sound.volumeNode.gain;
  const endTime = context.currentTime + duration / 1000;
  gain.linearRampToValueAtTime(volume, endTime);
  setTimeout(resolve, duration);

  return promise;
}

/**
 *
 * @param sound Phaser WebAudio sound object
 * @param pan Pan between -1 and 1 to fade to
 * @param duration Duration for the fade in ms
 */
export async function setPan(sound: Sound, pan: number, duration: number = FADE) {
  const [resolve, _, promise] = deferred<void>();

  if (!sound) return Promise.resolve();
  const context = sound.pannerNode?.context;
  const panner = sound.pannerNode?.pan;
  const endTime = context.currentTime + duration / 1000;
  panner.linearRampToValueAtTime(pan, endTime);
  setTimeout(resolve, duration);

  return promise;
}

export function isValidSound(sound: Phaser.Sound.BaseSound): sound is Sound {
  return "setVolume" in sound;
}

export function getIdentifyingKey(sound: Sound, coord: WorldCoord): string {
  return [sound.key, sound.rate.toFixed(1), sound.detune.toFixed(1), Math.floor(coord.x / SPATIAL_COLUMN_WIDTH)].join(
    "/"
  );
}

export function getUniqueKey(sound: Sound, coord: WorldCoord, layer: SoundLayer): string {
  return [sound.key, coord.x, coord.y, layer].join("/");
}
