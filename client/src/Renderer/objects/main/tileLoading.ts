import { v4 } from "uuid";
import { WithId, WorldCoord } from "../../../_types/GlobalTypes";
import { loadingColors, LoadingStage, TILE_WIDTH, TILE_HEIGHT } from "../../constants";

export default class TileLoading extends Phaser.GameObjects.Graphics implements WithId {
  id: string;
  stage: LoadingStage;
  map: Phaser.Tilemaps.Tilemap;
  progress: number;
  duration: number;
  needToFinishDrawingCurrentStage: boolean;
  drawnOnce: boolean;
  text: Phaser.GameObjects.BitmapText;
  showText: boolean;
  coord: WorldCoord;
  tick: number;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.text = scene.add.bitmapText(0, 0, "creepWhite");
  }

  init(
    map: Phaser.Tilemaps.Tilemap,
    coord: WorldCoord,
    id: string,
    stage: LoadingStage = LoadingStage.Planned,
    progress: number = 0,
    duration: number = 0,
    showText: boolean = false
  ) {
    this.stopTweens();
    this.clear();

    this.id = id;
    this.map = map;
    this.needToFinishDrawingCurrentStage = false;
    this.drawnOnce = false;
    this.showText = showText;
    this.coord = coord;
    this.tick = 0;

    this.setText("");
    this.fillStyle(0x000000, 0.4);
    this.fillRect(0, 0, this.map.tileWidth, this.map.tileHeight);

    const snappedWorldPoint = this.map.tileToWorldXY(coord.x, coord.y);

    this.text.setPosition(
      snappedWorldPoint.x + (TILE_WIDTH - this.text.width) / 1.5,
      snappedWorldPoint.y + (TILE_HEIGHT - this.text.height) / 3
    );

    this.setPosition(snappedWorldPoint.x, snappedWorldPoint.y);
    this.setStage(stage, progress, duration, showText);
    this.setActive(true);
    this.setVisible(true);
  }

  setText(text: string) {
    this.text.setText(text);
  }

  setStage(stage: LoadingStage, progress: number, duration: number = 0, showText: boolean = false) {
    this.stage = stage;
    this.stopTweens();
    this.progress = progress;
    this.needToFinishDrawingCurrentStage = true;
    this.duration = duration;
    this.showText = showText;
    if (duration) {
      this.scene.tweens.add({
        targets: this,
        progress: 100,
        duration: duration,
      });
    }
  }

  drawProgressiveOutline(progress: number) {
    this.clear();
    this.fillStyle(0x000000, 0.4);
    const tWidth = this.map.tileWidth;
    const tHeight = this.map.tileHeight;
    this.fillRect(0, 0, tWidth, tHeight);
    if (this.stage === LoadingStage.Confirming) {
      this.lineStyle(2, loadingColors[LoadingStage.Submitting]!);
      this.strokeRect(0, 0, tWidth, tHeight);
    }
    //choose color based on state
    const alpha = this.stage === LoadingStage.Planned ? 0 : 1;
    this.lineStyle(2, loadingColors[this.stage]!, alpha);
    this.beginPath();
    this.moveTo(0, 0);
    let remainingProgress = progress / 100;
    const totalTravel = 2 * tWidth + 2 * tHeight;
    const fractionWidth = tWidth / totalTravel;
    const fractionHeight = tHeight / totalTravel;
    //don't forget to exit when drawing a line in progress

    if (remainingProgress < fractionWidth) {
      const progressTop = remainingProgress / fractionWidth;
      this.lineTo(tWidth * progressTop, 0);
      return;
    } else {
      this.lineTo(tWidth, 0);
    }

    remainingProgress -= fractionWidth;

    if (remainingProgress < fractionHeight) {
      const progressRight = remainingProgress / fractionHeight;
      this.lineTo(tWidth, tHeight * progressRight);
      return;
    } else {
      this.lineTo(tWidth, tHeight);
    }

    remainingProgress -= fractionHeight;

    if (remainingProgress < fractionWidth) {
      const progressBottom = remainingProgress / fractionWidth;
      this.lineTo(tWidth * (1.0 - progressBottom), tHeight);
      return;
    } else {
      this.lineTo(0, tHeight);
    }

    remainingProgress -= fractionWidth;

    if (remainingProgress < fractionHeight) {
      const progressLeft = remainingProgress / fractionHeight;
      this.lineTo(0, tHeight * (1.0 - progressLeft));
      return;
    } else {
      this.lineTo(0, 0);
    }
  }

  update() {
    this.tick++;
    if (this.tick % 30 !== 1) return;
    this.tick = 0;

    if (this.stage == LoadingStage.Planned && this.drawnOnce) return;
    if (this.needToFinishDrawingCurrentStage) {
      // finish drawing with current color
      this.drawProgressiveOutline(100);
      this.strokePath();
      this.needToFinishDrawingCurrentStage = false;
    }
    //draw the outline of the tile
    this.drawProgressiveOutline(this.progress);
    this.strokePath();

    // Set text
    if (this.showText) {
      const text = Math.ceil(Math.max((this.duration - (this.progress / 100) * this.duration) / 1000, 0)).toString();
      if (text !== this.text.text) {
        this.setText(text);
        const snappedWorldPoint = this.map.tileToWorldXY(this.coord.x, this.coord.y);
        this.text.setPosition(
          snappedWorldPoint.x + (TILE_WIDTH - this.text.width) / 1.5,
          snappedWorldPoint.y + (TILE_HEIGHT - this.text.height) / 3
        );
      }
    } else {
      this.setText("");
    }

    this.drawnOnce = true;
  }

  private stopTweens() {
    const tweens = this.scene.tweens.getTweensOf(this);
    for (const tween of tweens) {
      tween.stop(1);
      this.scene.tweens.remove(tween);
    }
    this.scene.tweens.killTweensOf(this);
  }

  setVisible(visible: boolean) {
    this.text.setVisible(visible);
    super.setVisible(visible);
    return this;
  }

  setActive(active: boolean) {
    this.text.setActive(active);
    super.setActive(active);
    return this;
  }

  destroy() {
    this.text.destroy();
    super.destroy();
  }
}
