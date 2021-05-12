import GameManager from "../../Backend/Game/GameManager";
import { GameScene } from "../../_types/GlobalTypes";
import { UIManager } from "../../Frontend/UIManager";
import { SoundType } from "../manager/SoundManager";

export default class PreloadScene extends Phaser.Scene {
  gm: GameManager;
  constructor() {
    super({ key: "PreloadScene" });
  }

  async preload() {
    this.load.image("tilemap", "Assets/tilemaps/tilemap.png");
    // we use it as a spritesheet too
    this.load.spritesheet("tilemapSpritesheet", "Assets/tilemaps/tilemap.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.image("particle", "Assets/particles/particle.png");

    this.load.multiatlas("loadingScreen", "Assets/multiatlas/loadingScreen.json", "Assets/multiatlas");

    this.load.spritesheet("imp", "Assets/spritesheets/imp2.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("skeleton", "Assets/spritesheets/skeleton2.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("fire-skeleton", "Assets/spritesheets/fire2.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("ice-skeleton", "Assets/spritesheets/ice2.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("demon-skeleton", "Assets/spritesheets/demon2.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("beholder", "Assets/spritesheets/legendary.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("laser", "Assets/spritesheets/StarlightBeam.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.spritesheet("ui", "Assets/spritesheets/UI.png", {
      frameWidth: 24,
      frameHeight: 24,
    });
    this.load.bitmapFont("creep", "Assets/fonts/creep.png", "Assets/fonts/creep.xml");
    this.load.bitmapFont("creepWhite", "Assets/fonts/creepWhite.png", "Assets/fonts/creepWhite.xml");
    this.load.bitmapFont("creepRed", "Assets/fonts/creepRed.png", "Assets/fonts/creepRed.xml");
    this.load.bitmapFont("emberRed", "Assets/fonts/emberRed.png", "Assets/fonts/emberRed.xml");
    this.load.bitmapFont("emberBlack", "Assets/fonts/emberBlack.png", "Assets/fonts/emberBlack.xml");
    this.load.bitmapFont("emberWhite", "Assets/fonts/emberWhite.png", "Assets/fonts/emberWhite.xml");
    this.load.bitmapFont("emberPlayer", "Assets/fonts/emberPlayer.png", "Assets/fonts/emberPlayer.xml");

    // Add new sounds to the sound manager here. Can also be an AudioSprite.
    // https://photonstorm.github.io/phaser3-docs/Phaser.Sound.WebAudioSoundManager.html
    this.load.audio(SoundType.FIRE, "Assets/sounds/fire.mp3");
    this.load.audio(SoundType.IMP_APPEAR_ONE, "Assets/sounds/imp_appear_1.mp3");
    this.load.audio(SoundType.IMP_APPEAR_TWO, "Assets/sounds/imp_appear_2.mp3");
    this.load.audio(SoundType.IMP_APPEAR_THREE, "Assets/sounds/imp_appear_3.mp3");
    this.load.audio(SoundType.MINE_ONE, "Assets/sounds/mine_1.mp3");
    this.load.audio(SoundType.MINE_TWO, "Assets/sounds/mine_3.mp3");
    this.load.audio(SoundType.CLAIM, "Assets/sounds/claim.mp3");
    this.load.audio(SoundType.MINE_END, "Assets/sounds/mine_end.mp3");
    this.load.audio(SoundType.UPGRADE_END, "Assets/sounds/upgrade_end.mp3");
    this.load.audio(SoundType.CLAIM_END, "Assets/sounds/claim_end.mp3");
    this.load.audio(SoundType.CREATURE, "Assets/sounds/creature_1.mp3");
    this.load.audio(SoundType.ACTION, "Assets/sounds/creature_spawn.mp3");
    this.load.audio(SoundType.ATTACK, "Assets/sounds/attack.mp3");
    this.load.audio(SoundType.DEATH, "Assets/sounds/death.mp3");
    this.load.audio(SoundType.CAVE, "Assets/sounds/cave.mp3");
    this.load.audio(SoundType.CLOSE_ACTION, "Assets/sounds/close_window.mp3");
    this.load.audio(SoundType.BATTLE_START, "Assets/sounds/battle_start.mp3");
    this.load.audio(SoundType.CREATURE_MOVE, "Assets/sounds/creature_move.mp3");
    this.load.audio(SoundType.SOUL_UPGRADE, "Assets/sounds/soul_upgrade.mp3");
    this.load.audio(SoundType.GOLD_UPGRADE, "Assets/sounds/gold_upgrade.mp3");
    this.load.audio(SoundType.NOTIFICATION, "Assets/sounds/notification.mp3");
  }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000);
    bg.fillRect(-1000, -1000, 2000, 2000);
    const ember = this.add.bitmapText(0, 0, "emberRed", "Ember");
    ember.setScale(4);
    const loadingText = this.add.bitmapText(0, ember.height + 10, "creepWhite", "waiting for player to join...");
    loadingText.setScale(1);
    this.cameras.main.centerOn(ember.x + ember.width / 2, ember.y + ember.height / 2);
    this.pollGameManager();
  }
  pollGameManager() {
    try {
      this.gm = GameManager.getInstance();
      this.goToLoadingScene();
    } catch (_) {
      setTimeout(() => this.pollGameManager(), 100);
    }
  }
  goToLoadingScene() {
    const ui = UIManager.getInstance();

    this.scene.start("LoadingScene");
    ui.state.setGameScene(GameScene.Loading);
  }
}
