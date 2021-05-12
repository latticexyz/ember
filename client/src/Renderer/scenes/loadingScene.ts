import { Renderer } from "phaser";
import { DungeonLoadingStage } from "../../Backend/ETH/types";
import GameManager from "../../Backend/Game/GameManager";
import { UIManager } from "../../Frontend/UIManager";
import { DungeonEvent, GameScene, PlayerStatus } from "../../_types/GlobalTypes";

enum LoadingScreenAnimationPhase {
  PHASE_1,
  SWITCH_1,
  PHASE_2,
  SWITCH_2,
  PHASE_3,
  SWITCH_3,
  LOGO,
  END_LOOP,
}

export default class LoadingScene extends Phaser.Scene {
  gm: GameManager;
  loadingSprite: Phaser.GameObjects.Sprite;
  logText: Phaser.GameObjects.BitmapText;
  subLogText: Phaser.GameObjects.BitmapText;
  currentDungeonLoadingStage: DungeonLoadingStage;
  currentLoadingScreenAnimationPhase: LoadingScreenAnimationPhase;
  canStart: boolean;
  // tweens
  previousOldLogTextTween: Phaser.Tweens.Tween;
  previousLogTextTween: Phaser.Tweens.Tween;

  constructor() {
    super({ key: "LoadingScene" });
  }

  onResize() {
    const rendererWidth = this.renderer.width;
    const zoomNeeded = rendererWidth / this.loadingSprite.width;
    this.loadingSprite.setScale(Math.round(zoomNeeded));
  }

  getDesiredLoadingScreenAnimationPhase(): LoadingScreenAnimationPhase {
    if (this.currentDungeonLoadingStage <= DungeonLoadingStage.TILES) {
      return LoadingScreenAnimationPhase.PHASE_1;
    }
    if (this.currentDungeonLoadingStage <= DungeonLoadingStage.PLAYERS) {
      return LoadingScreenAnimationPhase.PHASE_2;
    }
    if (this.currentDungeonLoadingStage <= DungeonLoadingStage.CREATURES) {
      return LoadingScreenAnimationPhase.PHASE_3;
    }
    return LoadingScreenAnimationPhase.END_LOOP;
  }

  getNextAnimationKey(): LoadingScreenAnimationPhase {
    // find the desired state first
    const currentPhase = this.currentLoadingScreenAnimationPhase;
    const desiredLoadingScreenAnimationPhase = this.getDesiredLoadingScreenAnimationPhase();

    if (currentPhase === desiredLoadingScreenAnimationPhase) {
      // loop
      return desiredLoadingScreenAnimationPhase;
    }

    if (currentPhase < desiredLoadingScreenAnimationPhase) {
      return currentPhase + 1;
    }

    throw new Error("desired phase: " + desiredLoadingScreenAnimationPhase + ". current phase: " + currentPhase);
  }

  playAnimationPhase(phase: LoadingScreenAnimationPhase) {
    this.loadingSprite.stop();
    this.loadingSprite.play(phase.toString(), false);
    this.currentLoadingScreenAnimationPhase = phase;
  }

  registerAnimations() {
    // register animations
    const createAnimationWithName = (key: LoadingScreenAnimationPhase, start: number, length: number) => {
      this.anims.create({
        key: key.toString(),
        frames: this.anims.generateFrameNames("loadingScreen", {
          start: start + 1,
          end: start + length,
          prefix: "LoadScreen",
          suffix: ".png",
        }),
        frameRate: 10,
        repeat: 0,
      });
    };
    createAnimationWithName(LoadingScreenAnimationPhase.PHASE_1, 0, 24);
    createAnimationWithName(LoadingScreenAnimationPhase.SWITCH_1, 24, 7);
    createAnimationWithName(LoadingScreenAnimationPhase.PHASE_2, 32, 24);
    createAnimationWithName(LoadingScreenAnimationPhase.SWITCH_2, 57, 4);
    createAnimationWithName(LoadingScreenAnimationPhase.PHASE_3, 60, 24);
    createAnimationWithName(LoadingScreenAnimationPhase.SWITCH_3, 84, 4);
    createAnimationWithName(LoadingScreenAnimationPhase.LOGO, 88, 24);
    createAnimationWithName(LoadingScreenAnimationPhase.END_LOOP, 112, 23);
  }

  startGameScene() {
    const ui = UIManager.getInstance();
    if (this.gm.actionContext.playerStatus === PlayerStatus.INITIALIZED) {
      this.scene.start("MainScene");
      ui.state.setGameScene(GameScene.Main);
    } else {
      this.scene.start("InitializeScene");
      ui.state.setGameScene(GameScene.Initialize);
    }
  }

  create() {
    this.gm = GameManager.getInstance();
    if (this.gm.extendedDungeon.loaded) {
      this.startGameScene();
    }
    this.canStart = false;
    this.currentDungeonLoadingStage = DungeonLoadingStage.TILES;
    this.gm.extendedDungeon.on(DungeonEvent.LoadingLog, (log, subLog) => {
      if (!this.logText) {
        return;
      }
      if (subLog) {
        this.subLogText.setText(log);
        return;
      }
      this.previousOldLogTextTween?.complete(0);
      this.previousLogTextTween?.complete(0);
      const oldLogText = this.logText;
      const pos = this.cameras.main.getWorldPoint(20, this.cameras.main.height - 50);
      this.logText = this.add.bitmapText(pos.x, pos.y, "creepWhite", log);
      this.logText.alpha = 0;
      this.logText.setScale(2);
      this.previousOldLogTextTween = this.tweens.add({
        targets: oldLogText,
        alpha: 0,
        y: oldLogText.y + 10,
        duration: 200,
        onComplete: () => oldLogText.destroy(),
      });
      this.previousLogTextTween = this.tweens.add({
        targets: this.logText,
        alpha: 1,
        duration: 200,
        delay: 200,
      });
    });
    this.gm.extendedDungeon.on(DungeonEvent.LoadingStage, (loadingStage) => {
      this.currentDungeonLoadingStage = loadingStage;
      if (this.currentDungeonLoadingStage === DungeonLoadingStage.DONE) {
        this.canStart = true;
        this.tweens.add({
          targets: this.logText,
          alpha: 0,
          duration: 700,
          onComplete: () => this.logText.destroy(),
        });
        this.tweens.add({
          targets: this.subLogText,
          alpha: 0,
          duration: 700,
          onComplete: () => this.subLogText.destroy(),
        });
        const pos = this.cameras.main.getWorldPoint(20, this.cameras.main.height - 50);
        const b = this.add.bitmapText(pos.x, pos.y, "creepWhite", "press any key to continue");
        this.tweens.add({
          targets: b,
          yoyo: true,
          duration: 700,
          alpha: 0,
          repeat: -1,
          delay: 700,
          ease: Phaser.Math.Easing.Quadratic.InOut,
        });
        b.setScale(2);
        this.input.keyboard.once("keydown", () => {
          this.startGameScene();
        });
      }
    });
    const bg = this.add.graphics();
    bg.fillStyle(0x000000);
    bg.fillRect(-1000, -1000, 2000, 2000);
    this.registerAnimations();
    this.loadingSprite = this.add.sprite(0, 0, "loadingScreen");

    this.loadingSprite.play(LoadingScreenAnimationPhase.PHASE_1.toString());
    this.currentLoadingScreenAnimationPhase = LoadingScreenAnimationPhase.PHASE_1;

    this.loadingSprite.on("animationcomplete", () => {
      this.playAnimationPhase(this.getNextAnimationKey());
    });

    this.cameras.main.startFollow(this.loadingSprite, true, undefined, undefined, undefined, -30);
    this.renderer.on(Renderer.Events.RESIZE, () => {
      this.onResize();
    });
    this.onResize();
    const logPos = this.cameras.main.getWorldPoint(20, this.cameras.main.height - 50);
    const subLogPos = this.cameras.main.getWorldPoint(20, this.cameras.main.height - 20);
    this.logText = this.add.bitmapText(logPos.x, logPos.y, "creepWhite", "Loading started");
    this.logText.setScale(2);
    this.subLogText = this.add.bitmapText(subLogPos.x, subLogPos.y, "creepWhite", "");
  }
}
