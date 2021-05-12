import GameManager from "../../../Backend/Game/GameManager";
import { hexColors } from "../../../theme";
import { Settlement as SettlementData } from "../../../_types/GlobalTypes";
import { TILE_WIDTH, TILE_HEIGHT_OFFSET, TILE_HEIGHT } from "../../constants";

export default class Settlement extends Phaser.GameObjects.Container {
  energy: number;
  maxEnergy: number;
  owner: Phaser.GameObjects.Graphics;
  spriteLeft: Phaser.GameObjects.Sprite;
  spriteRight: Phaser.GameObjects.Sprite;
  digitLeft: Phaser.GameObjects.Sprite;
  digitRight: Phaser.GameObjects.Sprite;
  g: Phaser.GameObjects.Graphics;
  settlementData: SettlementData;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.spriteLeft = this.scene.add.sprite(TILE_WIDTH * 3 + TILE_WIDTH / 2, TILE_HEIGHT * 3, "ui", 24);
    this.spriteRight = this.scene.add.sprite(TILE_WIDTH * 4 + TILE_WIDTH / 2, TILE_HEIGHT * 3, "ui", 25);
    this.digitLeft = this.scene.add.sprite(TILE_WIDTH * 3 + 6 - 0.5, TILE_HEIGHT * 3 - 0.5, "digits", 0);
    this.digitRight = this.scene.add.sprite(TILE_WIDTH * 3 + 10 - 0.5, TILE_HEIGHT * 3 - 0.5, "digits", 0);
    this.add(this.spriteLeft);
    this.add(this.spriteRight);
    this.add(this.digitLeft);
    this.add(this.digitRight);
    this.g = this.scene.add.graphics();
    this.add(this.g);
  }

  initSettlement(x: number, y: number, settlement: SettlementData) {
    this.setVisible(true);
    this.setActive(true);
    this.setX(x);
    this.setY(y);
    this.updateSettlement(settlement);
  }

  updateSettlement(settlement: SettlementData) {
    const gm = GameManager.getInstance();
    this.settlementData = settlement;
    const maxEnergy = gm.constants.gameConstants.MAX_ENERGY_PER_LEVEL[settlement.level];
    this.maxEnergy = maxEnergy;
    this.recomputeEnergy();
    this.drawDigits();
    this.strokeEnergyBar();
  }

  updateEnergy() {
    this.recomputeEnergy();
    this.drawDigits();
    this.strokeEnergyBar();
  }

  private drawDigits() {
    const { energy } = this;
    if (energy > 9) {
      this.digitLeft.setFrame(parseInt(energy.toString()[0]));
      this.digitRight.setFrame(parseInt(energy.toString()[1]));
    } else {
      this.digitLeft.setFrame(0);
      this.digitRight.setFrame(parseInt(energy.toString()[0]));
    }
  }

  private recomputeEnergy() {
    const gm = GameManager.getInstance();
    const energy =
      this.settlementData.energy +
      Math.floor(
        Math.max(0, gm.net.predictedChainTime - this.settlementData.lastEnergyUpdateTimestamp) /
        gm.constants.gameConstants.NUMBER_OF_SECONDS_FOR_ONE_ENERGY_REGEN
      );
    this.energy = Math.min(energy, this.maxEnergy);
  }

  private strokeEnergyBar() {
    this.g.clear();
    this.g.beginPath();
    this.g.lineStyle(2, hexColors.invalid);
    const HEIGHT = TILE_HEIGHT * 3;
    const START = TILE_WIDTH * 3 + 14;
    this.g.moveTo(START, HEIGHT);
    this.g.lineTo(START + Math.ceil((this.energy / this.maxEnergy) * 27), HEIGHT);
    this.g.strokePath();
  }
}
