import { WorldCoord } from "../../../_types/GlobalTypes";
import { CoordMap } from "../../../Utils/CoordMap";
import { ViewportManager } from "../ViewportManager";
import { ExecutionQueue } from "./ExecutionQueue";
import { SoundLayer, SoundType, UPDATE_INTERVAL, SOUND_PADDING, SoundConfig, LAYER_VOLUME } from "./config";
import { TypedSound, Sound } from "./types";
import { isValidSound, getUniqueKey, getIdentifyingKey, setVolume, setPan } from "./utils";
import { makeObservable, computed, action, observable } from "mobx";

export class SoundManager {
  static instance: SoundManager;
  private backgroundSounds = new Map<SoundType, Sound>();
  private spatialSounds: { [key in SoundLayer]: CoordMap<TypedSound> } = {
    [SoundLayer.MAP]: new CoordMap<TypedSound>(),
    [SoundLayer.ACTION]: new CoordMap<TypedSound>(),
    [SoundLayer.UPGRADING]: new CoordMap<TypedSound>(),
    [SoundLayer.COMBAT]: new CoordMap<TypedSound>(),
  };
  private spatialSoundCounter = new Map<string, number>();
  private volumeQueue = new ExecutionQueue();
  private panQueue = new ExecutionQueue();
  private lastUpdated: number = 0;
  public volume: number = 0;

  constructor(private scene: Phaser.Scene, private viewportManager: ViewportManager) {
    this.viewportManager.setOnViewportChange(() => {
      if (Date.now() - this.lastUpdated > UPDATE_INTERVAL) {
        this.updateSpatialSounds();
      }
    });
    // default volume
    this.scene.sound.volume = 0.5;
    this.volume = this.scene.sound.volume;

    (window as any).soundManager = this;
    makeObservable(this, {
      volume: observable,
      setVolume: action,
    });
  }

  public static init(scene: Phaser.Scene, viewportManager: ViewportManager) {
    this.instance = new SoundManager(scene, viewportManager);
  }

  public static destroy() {
    this.instance.backgroundSounds.clear();
    this.instance.spatialSounds.MAP.map.clear();
    this.instance.spatialSounds.ACTION.map.clear();
    this.instance.spatialSounds.UPGRADING.map.clear();
    this.instance.spatialSounds.COMBAT.map.clear();
    this.instance.spatialSoundCounter.clear();
    this.instance.volumeQueue.destroy();
    this.instance.panQueue.destroy();
  }

  /**
   * Sets the global volume
   * @param volume Volume between 0 and 1
   */
  public setVolume(volume: number): number {
    this.scene.sound.volume = volume;
    this.volume = volume;
    return volume;
  }

  /**
   * Register a sound in the sound engine. The sound engine takes care of the rest.
   * @param type Type of the sound to play. Needs to be configured in this method.
   * @param coord TileCoord of the sound for spacial sounds. Leave undefined for background sounds.
   * @param layer Layer of the sound. On each layer there can be only one sound per coord.
   * @param force Should the sound be played even though the same sound is registered at this coord already?
   */
  public static register(type: SoundType, coord?: WorldCoord, layer: SoundLayer = SoundLayer.ACTION, force?: boolean) {
    // Ignore if the same sound is playing at the same coord already to prevent sounds to restart when the map rerenders
    if (
      (!force && coord && this.instance.spatialSounds[layer].get(coord)?.type === type) ||
      this.instance.backgroundSounds.has(type)
    ) {
      return;
    }

    // Remove spatial sounds currently playing at this coord
    if (coord) {
      this.removeSpatialSound(coord, layer);
    }

    const sound = SoundConfig(type, this.instance.scene);
    if (!sound || !isValidSound(sound)) return;

    if (coord) {
      this.instance.spatialSounds[layer].set(coord, { sound, type });
      this.instance.updateSpatialSound(sound, coord, layer, true);
    } else {
      this.instance.backgroundSounds.set(type, sound);
      this.instance.playSound(sound.key, sound);
    }

    sound.on("complete", () => {
      if (!sound || !isValidSound(sound)) return;
      if (coord) {
        this.removeSpatialSound(coord, layer);
      } else {
        this.removeBackgroundSound(type);
      }
    });
  }

  /**
   * Removes the sound registered at the given coord from the sound manager and scene
   * @param coord WorldCoord of the spatial sound
   * @param layer Layer of the spatial sound
   */
  public static removeSpatialSound(coord: WorldCoord, layer: SoundLayer = SoundLayer.ACTION) {
    const typedSound = this.instance.spatialSounds[layer].get(coord);
    if (typedSound) {
      const uniqueKey = getUniqueKey(typedSound.sound, coord, layer);
      this.instance.decSpatialCount(typedSound.sound, coord);
      this.instance.spatialSounds[layer].delete(coord);
      this.instance.stopSound(uniqueKey, typedSound.sound);
    }
  }

  /**
   * Removes the given background sound from the sound manager and scene
   * @param type SoundType of the background sound
   */
  public static removeBackgroundSound(type: SoundType) {
    const sound = this.instance.backgroundSounds.get(type);
    if (sound) {
      this.instance.backgroundSounds.delete(type);
      this.instance.stopSound(sound.key, sound);
    }
  }

  /**
   * Updates the volume and pan of all registered spatial sounds in the viewport
   */
  private updateSpatialSounds() {
    this.lastUpdated = Date.now();
    for (const layer of Object.values(SoundLayer)) {
      for (const coord of this.spatialSounds[layer].coords()) {
        const { sound } = this.spatialSounds[layer].get(coord)!;

        if (sound.isPlaying || this.viewportManager.isTileInViewport(coord, SOUND_PADDING)) {
          this.updateSpatialSound(sound, coord, layer);
        }
      }
    }
  }

  /**
   * Updates the volume and pan for the given sound
   * @param sound Phaser WebAdudio object
   * @param coord WorldCoord of the spatial sound
   * @param layer SoundLayer of the spatial sound
   * @param initialPlay Set to true when called while registering the sound, false when updating the sound
   */
  private updateSpatialSound(sound: Sound, coord: WorldCoord, layer: SoundLayer, initialPlay?: boolean) {
    const proximity = this.viewportManager.getProximityToViewportCenter(coord, SOUND_PADDING);
    const volume = proximity * LAYER_VOLUME[layer];
    const pan = this.viewportManager.getPanFromViewportCenter(coord, SOUND_PADDING);
    const stack = !sound.loop;
    const uniqueKey = getUniqueKey(sound, coord, layer);

    // Pause the sound if it is too far away
    if (proximity === 0) {
      if (sound.isPlaying) {
        this.decSpatialCount(sound, coord);
        this.pauseSound(uniqueKey, sound);
      }
      return;
    }

    this.setSoundPan(uniqueKey, sound, pan);
    this.setSoundVolume(uniqueKey, sound, volume);

    // Get the number of identical sounds playing at the moment
    const spatialCount = this.getSpatialCount(sound, coord);

    // If this sound is playing and another identical sound is playing, stop this sound
    if (!stack && sound.isPlaying && spatialCount > 1) {
      this.decSpatialCount(sound, coord);
      this.pauseSound(uniqueKey, sound);
      return;
    }

    // Only play the sound if
    // 1. it is not already playing and
    // 2. there is no identical sound playing and
    // 3. it is the first time this sound is played or the sound should loop
    if (!sound.isPlaying && (spatialCount === 0 || stack) && (initialPlay || sound.loop)) {
      this.incSpatialCount(sound, coord);
      this.playSound(uniqueKey, sound, volume);
    }
  }

  /**
   * Returns the current number of identical sounds in the counter
   */
  private getSpatialCount(sound: Sound, coord: WorldCoord): number {
    const id = getIdentifyingKey(sound, coord);
    return this.spatialSoundCounter.get(id) || 0;
  }

  /**
   * Increases the number of identical sounds in the counter
   */
  private incSpatialCount(sound: Sound, coord: WorldCoord) {
    const id = getIdentifyingKey(sound, coord);
    const num = this.spatialSoundCounter.get(id) || 0;
    this.spatialSoundCounter.set(id, num + 1);
  }

  /**
   * Decreases the number of identical sounds in the counter
   */
  private decSpatialCount(sound: Sound, coord: WorldCoord) {
    const id = getIdentifyingKey(sound, coord);
    const num = this.spatialSoundCounter.get(id) || 0;
    if (num === 1) this.spatialSoundCounter.delete(id);
    if (num > 1) this.spatialSoundCounter.set(id, num - 1);
  }

  /**
   * Schedules a job to pause the given sound
   * @param id Unique key of the sound (getUniqueKey)
   * @param sound Phaser WebAudio object
   */
  private async pauseSound(id: string, sound: Sound) {
    this.volumeQueue.schedule(id, {
      execute: async () => {
        await setVolume(sound, 0);
        sound.pause();
      },
    });
  }

  /**
   * Schedules a job to stop the given sound and remove it from the scene
   * @param id Unique key of the sound (getUniqueKey)
   * @param sound Phaser WebAudio object
   */
  private async stopSound(id: string, sound: Sound) {
    this.volumeQueue.schedule(id, {
      priority: true,
      execute: async () => {
        await setVolume(sound, 0);
        sound.stop();
        this.scene.sound.remove(sound);
      },
    });
  }

  /**
   * Schedules a job to play the given sound
   * @param id Unique key of the sound (getUniqueKey)
   * @param sound Phaser WebAudio object
   * @param volume Volume between 0 and 1 to play the sound at
   */
  private async playSound(id: string, sound: Sound, volume?: number) {
    this.volumeQueue.schedule(id, {
      priority: true,
      execute: async () => {
        const v = volume !== undefined ? volume : sound.volume;
        sound.volume = 0;
        sound.play();
        await setVolume(sound, v);
      },
    });
  }

  /**
   * Schedules a job to fade the given sound to the given volume
   * @param id Unique key of the sound (getUniqueKey)
   * @param sound Phaser WebAudio object
   * @param volume Volume between 0 and 1
   */
  private async setSoundVolume(id: string, sound: Sound, volume: number) {
    await this.volumeQueue.schedule(id, { execute: () => setVolume(sound, volume) });
  }

  /**
   * Schedules a job to fade the given sound to the given pan
   * @param id Unique key of the sound (getUniqueKey)
   * @param sound Phaser WebAudio object
   * @param pan Pan between -1 and 1
   */
  private async setSoundPan(id: string, sound: Sound, pan: number) {
    await this.panQueue.schedule(id, { execute: () => setPan(sound, pan) });
  }
}
