import { getRandomNumberBetween, getRandomElement } from "../../utils/random";

export const FADE = 250;
export const SPATIAL_COLUMN_WIDTH = 4;
export const EASE = (v: number) => Phaser.Math.Easing.Quadratic.InOut(v);
export const SOUND_PADDING = 4;
export const UPDATE_INTERVAL = 0;

export enum SoundType {
  IMP_APPEAR = "IMP_APPEAR",
  IMP_APPEAR_ONE = "IMP_APPEAR_ONE",
  IMP_APPEAR_TWO = "IMP_APPEAR_TWO",
  IMP_APPEAR_THREE = "IMP_APPEAR_THREE",
  MINE = "MINE",
  MINE_ONE = "MINE_ONE",
  MINE_TWO = "MINE_TWO",
  UPGRADE = "UPGRADE",
  UPGRADE_END = "UPGRADE_END",
  FIRE = "FIRE",
  MINE_END = "MINE_END",
  CREATURE = "CREATURE",
  ACTION = "ACTION",
  ATTACK = "ATTACK",
  DEATH = "DEATH",
  CAVE = "CAVE",
  CLOSE_ACTION = "CLOSE_ACTION",
  BATTLE_START = "BATTLE_START",
  CREATURE_MOVE = "CREATURE_MOVE",
  SOUL_UPGRADE = "SOUL_UPGRADE",
  GOLD_UPGRADE = "GOLD_UPGRADE",
  NOTIFICATION = "NOTIFICATION",
}

export enum SoundLayer {
  MAP = "MAP",
  ACTION = "ACTION",
  UPGRADING = "UPGRADING",
  COMBAT = "COMBAT",
}

export const LAYER_VOLUME: { [key in SoundLayer]: number } = {
  [SoundLayer.MAP]: 0.1,
  [SoundLayer.ACTION]: 1,
  [SoundLayer.UPGRADING]: 1,
  [SoundLayer.COMBAT]: 1,
};

export function SoundConfig(type: SoundType, scene: Phaser.Scene): Phaser.Sound.BaseSound | undefined {
  let sound: Phaser.Sound.BaseSound | undefined;
  // Load first in preloadScene.ts. Then add with configuration here.
  // https://photonstorm.github.io/phaser3-docs/Phaser.Types.Sound.html#.SoundConfig

  if (type === SoundType.MINE) {
    const rate = getRandomNumberBetween(2, 3);
    const createSound = getRandomElement([
      () => scene.sound.add(SoundType.MINE_ONE, { loop: true, rate }),
      () => scene.sound.add(SoundType.MINE_TWO, { loop: true, rate }),
    ]);
    sound = createSound();
  }

  if (type === SoundType.IMP_APPEAR) {
    const createSound = getRandomElement([
      () => scene.sound.add(SoundType.IMP_APPEAR_ONE, { loop: false }),
      () => scene.sound.add(SoundType.IMP_APPEAR_TWO, { loop: false }),
      () => scene.sound.add(SoundType.IMP_APPEAR_THREE, { loop: false }),
    ]);
    sound = createSound();
  }

  if (type === SoundType.UPGRADE) {
    sound = scene.sound.add(SoundType.MINE_ONE, { loop: true, rate: 2 });
  }

  if (type === SoundType.UPGRADE_END) {
    sound = scene.sound.add(SoundType.UPGRADE_END, { loop: false });
  }

  if (type === SoundType.FIRE) {
    sound = scene.sound.add(SoundType.FIRE, { loop: true });
  }

  if (type === SoundType.MINE_ONE) {
    sound = scene.sound.add(SoundType.MINE_ONE, { loop: false });
  }

  if (type === SoundType.MINE_TWO) {
    sound = scene.sound.add(SoundType.MINE_TWO, { loop: false });
  }

  if (type === SoundType.MINE_END) {
    const detune = getRandomNumberBetween(-100, 100);
    sound = scene.sound.add(SoundType.MINE_END, { loop: false, detune });
  }

  if (type === SoundType.CREATURE) {
    sound = scene.sound.add(SoundType.CREATURE, { loop: false });
  }

  if (type === SoundType.ACTION) {
    sound = scene.sound.add(SoundType.ACTION, { loop: false, volume: 1.5 });
  }

  if (type === SoundType.ATTACK) {
    sound = scene.sound.add(SoundType.ATTACK, { loop: false });
  }

  if (type === SoundType.DEATH) {
    sound = scene.sound.add(SoundType.DEATH, { loop: false });
  }

  if (type === SoundType.CAVE) {
    sound = scene.sound.add(SoundType.CAVE, { loop: true, volume: 0.1 });
  }

  if (type === SoundType.CLOSE_ACTION) {
    sound = scene.sound.add(SoundType.CLOSE_ACTION, { loop: false, volume: 1.5 });
  }

  if (type === SoundType.BATTLE_START) {
    sound = scene.sound.add(SoundType.BATTLE_START, { loop: false });
  }

  if (type === SoundType.CREATURE_MOVE) {
    sound = scene.sound.add(SoundType.CREATURE_MOVE, { loop: true });
  }

  if (type === SoundType.SOUL_UPGRADE) {
    const delay = getRandomNumberBetween(0, 0.5);
    sound = scene.sound.add(SoundType.SOUL_UPGRADE, { loop: true, delay });
  }

  if (type === SoundType.GOLD_UPGRADE) {
    const delay = getRandomNumberBetween(0, 0.5);
    sound = scene.sound.add(SoundType.GOLD_UPGRADE, { loop: true, delay });
  }

  if (type === SoundType.NOTIFICATION) {
    sound = scene.sound.add(SoundType.NOTIFICATION, { loop: false, volume: 1.5 });
  }

  return sound;
}
