import { WorldCoord } from "../../../_types/GlobalTypes";
import { ColorKey, colors, FONT, loadingColors, LoadingStage } from "../../constants";

const CONTAINER_PADDING = 16;
const CONTAINER_HEIGHT = 50;

const statusToLoadingStage = {
  SUBMITTING: LoadingStage.Submitting,
  CONFIRMING: LoadingStage.Confirming,
};

const BUTTON_DEPTH = 100;

export default class UI {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Graphics;
  loadingBar: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  buttonText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  button: Phaser.GameObjects.Graphics;
  selectedRegion: WorldCoord | undefined;
  status: "SELECTING" | "PROVING" | "SUBMITTING" | "CONFIRMING" | "WAITING" = "SELECTING";
  progress: number = 0;
  needToFinishCurrentLoadingStage: boolean = false;
  width: number;
  height: number;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.graphics();
    this.container.setScrollFactor(0);
    this.fillContainer();

    this.button = scene.add.graphics();
    this.button.setScrollFactor(0);
    this.text = scene.add.text(0, 0, "");
    this.text.setScrollFactor(0);
    this.buttonText = scene.add.text(0, 0, "");
    this.buttonText.setScrollFactor(0);
    this.text.style.setFontFamily(FONT);
    this.text.setScrollFactor(0);
    this.buttonText.style.setFontFamily(FONT);
    this.buttonText.setScrollFactor(0);
    this.selectedRegion = undefined;
    this.loadingBar = scene.add.graphics();
    this.loadingBar.setScrollFactor(0);
    this.statusText = scene.add.text(0, 0, "");
    this.statusText.setScrollFactor(0);
    this.statusText.setFontFamily(FONT);
    this.setVisibility(false);
    this.updateStaticGraphics();

    this.text.depth = BUTTON_DEPTH;
    this.button.depth = BUTTON_DEPTH;
    this.buttonText.depth = BUTTON_DEPTH;
    this.container.depth = BUTTON_DEPTH;
    this.loadingBar.depth = BUTTON_DEPTH + 1;
    this.statusText.depth = BUTTON_DEPTH + 1;
  }

  setStatus(status: "SELECTING" | "PROVING" | "SUBMITTING" | "CONFIRMING" | "WAITING") {
    this.status = status;
    if (this.status === "SELECTING") {
      this.loadingBar.clear();
      this.setVisibility(false);
      this.statusText.visible = false;
    }
  }

  setVisibility(visible: boolean) {
    this.button.visible = visible;
    this.buttonText.visible = visible;
    this.text.visible = visible;
    this.container.visible = visible;
    this.loadingBar.visible = visible;
  }

  renderProgressBar() {
    if (this.needToFinishCurrentLoadingStage) {
      this.loadingBar.fillRect(
        CONTAINER_PADDING,
        this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT,
        this.scene.scale.width - CONTAINER_PADDING * 2,
        CONTAINER_HEIGHT
      );
      this.needToFinishCurrentLoadingStage = false;
    }
    this.loadingBar.fillStyle(loadingColors[statusToLoadingStage[this.status] as LoadingStage]!);
    this.loadingBar.fillRect(
      CONTAINER_PADDING,
      this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT,
      (this.progress / 100) * (this.scene.scale.width - CONTAINER_PADDING * 2),
      CONTAINER_HEIGHT
    );
  }

  setSelectedRegion(coords: WorldCoord) {
    this.selectedRegion = coords;
    this.text.text = `Do you want to spawn at ${coords.x}, ${coords.y}?`;
    this.buttonText.text = `Press [ENTER] to spawn`;
    this.setVisibility(true);
    this.drawText();
  }

  updateStaticGraphics() {
    if (this.height !== this.scene.scale.height || this.width !== this.scene.scale.width) {
      this.height = this.scene.scale.height;
      this.width = this.scene.scale.width;

      this.drawContainer();
      this.drawText();
    }
  }

  fillContainer() {
    this.container.fillStyle(colors[ColorKey.DarkGray] as number, 0.9);
    this.container.fillRect(
      CONTAINER_PADDING,
      this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT,
      this.scene.scale.width - 2 * CONTAINER_PADDING,
      CONTAINER_HEIGHT
    );
  }

  drawContainer() {
    this.container.clear();
    this.fillContainer();
  }

  drawText() {
    this.text.setPosition(CONTAINER_PADDING + 20, this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT / 2);
    this.text.y -= this.text.height / 1.8;
    this.buttonText.setPosition(
      this.scene.scale.width - CONTAINER_PADDING,
      this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT / 2
    );
    this.buttonText.x -= this.buttonText.width + 20;
    this.buttonText.y -= this.buttonText.height / 1.8;
  }

  update() {
    this.renderProgressBar();
    this.updateStaticGraphics();
    if (this.status !== "SELECTING") {
      this.text.visible = false;
      this.buttonText.visible = false;
      this.statusText.setPosition(
        CONTAINER_PADDING + 20,
        this.scene.scale.height - CONTAINER_PADDING - CONTAINER_HEIGHT / 2
      );
      let statusText = "";
      switch (this.status) {
        case "PROVING":
          statusText = "proving init proof...";
          break;
        case "SUBMITTING":
          statusText = "submitting tx...";
          break;
        case "CONFIRMING":
          statusText = "waiting for tx to be confirmed...";
          break;
        case "WAITING":
          statusText = "waiting for init event from node...";
          break;
        default:
          statusText = "waiting...";
      }
      this.statusText.text = statusText;
      this.statusText.y -= this.text.height / 1.8;
      const mask = this.loadingBar.createGeometryMask();
      this.statusText.setMask(mask);
    }
  }

  destroy() {
    this.container.destroy();
    this.button.destroy();
    this.buttonText.destroy();
    this.text.destroy();
    this.statusText.destroy();
  }
}
