import { SoundType } from "./config";

export type Sound = Phaser.Sound.WebAudioSound;
export type TypedSound = { type: SoundType; sound: Sound };
