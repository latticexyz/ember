import { CombatAtomicTrace, CombatTrace, CombatWinner, HalfRoundTrace } from "../../../../../packages/combat/dist";
import { REGION_LENGTH } from "../../../Backend/Utils/Defaults";
import { range, sleep, regionCoordToTileCoord } from "../../../Backend/Utils/Utils";
import { hexColors } from "../../../theme";
import { Creature, EthAddress, WorldCoord } from "../../../_types/GlobalTypes";
import {
  TILE_HEIGHT,
  TILE_WIDTH,
  TILE_HEIGHT_OFFSET,
  TILE_WIDTH_OFFSET,
  CombatTilesetId,
  colors,
  ColorKey,
} from "../../constants";
import MainScene from "../../scenes/mainScene";
import LifeBar from "./lifeBar";
import Cross from "./cross";
import Constants from "../../../Backend/Game/Constants";
import { getMaxLifeOfCreature, creatureToSprite } from "../../utils/creatures";
import { HueTintFXPipeline } from "../../pipelines/hueTintAndOutlineFXPipeline";
import { getColorFromEthAddress } from "../../utils/colors";
import { CheckedTypeUtils } from "../../../Backend/Utils/CheckedTypeUtils";
import { SoundManager, SoundType, SoundLayer } from "../../../Renderer/manager/SoundManager";
import { translate } from "../../../Utils/Utils";

const FONT_CHAR_WIDTH = 7;

const isNotEmptyAtomicTrace = (a: CombatAtomicTrace): boolean => {
  return !(a.damage === 0);
};

export default class CombatRenderer extends Phaser.GameObjects.Container {
  constants: Constants;
  destroyed: boolean;
  playingTrace: boolean;
  region: WorldCoord;
  scene: Phaser.Scene;
  pipeline: HueTintFXPipeline;
  playerAddress: EthAddress;
  accelerationFactor: number;
  computedAccelerationFactor: number;
  squad1Player: string;
  squad2Player: string;
  title1: Phaser.GameObjects.BitmapText;
  title2: Phaser.GameObjects.BitmapText;
  round: Phaser.GameObjects.BitmapText;
  accelerateIcon: Phaser.GameObjects.BitmapText;
  message: Phaser.GameObjects.BitmapText;
  activePlayerUnderline: Phaser.GameObjects.Graphics;
  squad1: Creature[];
  squad1Sprites: Phaser.GameObjects.Sprite[];
  squad1LifeBars: LifeBar[];
  squad2: Creature[];
  squad2Sprites: Phaser.GameObjects.Sprite[];
  squad2LifeBars: LifeBar[];
  crosses: Cross[];
  activeCreature: Phaser.GameObjects.Sprite;
  targetedCreature: Phaser.GameObjects.Sprite;
  roundFrame1: Phaser.GameObjects.Sprite;
  roundFrame2: Phaser.GameObjects.Sprite;
  roundFrame3: Phaser.GameObjects.Sprite;
  constructor(
    scene: Phaser.Scene,
    pipeline: HueTintFXPipeline,
    constants: Constants,
    x: number,
    y: number,
    playerAddress: EthAddress,
    squad1: Creature[],
    squad2: Creature[],
    region: WorldCoord
  ) {
    super(scene, x, y);
    this.region = region;
    this.constants = constants;
    this.pipeline = pipeline;
    this.playerAddress = playerAddress;
    this.playingTrace = false;
    this.destroyed = false;
    this.scene = scene;
    this.accelerationFactor = 1;
    scene.add.existing(this);
    this.depth = 500;
    const g = new Phaser.GameObjects.Graphics(scene);
    g.fillStyle(0x1d1d1d);
    g.fillRect(0, 0, TILE_WIDTH * REGION_LENGTH, TILE_HEIGHT * REGION_LENGTH);
    this.setSize(TILE_WIDTH * REGION_LENGTH, TILE_HEIGHT * REGION_LENGTH);
    this.squad1 = squad1;
    this.squad2 = squad2;
    this.squad1Player = squad1[0]?.owner.substring(0, 6);
    this.squad2Player = squad2[0]?.owner.substring(0, 6);

    this.title1 = new Phaser.GameObjects.BitmapText(
      scene,
      TILE_WIDTH - 1,
      TILE_HEIGHT_OFFSET * (1 / 2) + 1,
      squad1[0].owner === this.playerAddress ? "emberPlayer" : "emberWhite",
      this.squad1Player ? `${this.squad1Player}` : "Upcoming"
    );
    this.title2 = new Phaser.GameObjects.BitmapText(
      scene,
      TILE_WIDTH * 5 + TILE_WIDTH_OFFSET - 1,
      TILE_HEIGHT_OFFSET * (1 / 2) + 1,
      squad2[0].owner === this.playerAddress ? "emberPlayer" : "emberWhite",
      this.squad2Player ? `${this.squad2Player}` : "Upcoming"
    );
    this.round = new Phaser.GameObjects.BitmapText(scene, 0, this.title1.height + 15, "emberRed", `Round 1`);
    this.round.x = (this.width - this.round.width + 2) / 2;
    this.accelerateIcon = new Phaser.GameObjects.BitmapText(scene, 0, this.title1.height + 14, "emberWhite", `>>`);
    this.accelerateIcon.x = this.width - this.accelerateIcon.width - 10;
    this.accelerateIcon.visible = false;
    this.message = new Phaser.GameObjects.BitmapText(scene, 0, TILE_HEIGHT * 8 - 20, "emberWhite", `Waiting for trace`);
    this.message.x = (this.width - this.message.width) / 2;
    this.add(g);
    this.add(this.title1);
    this.add(this.title2);
    this.add(this.round);
    this.add(this.accelerateIcon);
    this.add(this.message);

    this.buildCombatFrame();

    // init the combat
    const [squad1Sprites, squad1LifeBars] = this.addSquadSprites(this.squad1, true);
    const [squad2Sprites, squad2LifeBars] = this.addSquadSprites(this.squad2, false);
    this.squad1Sprites = squad1Sprites;
    this.squad2Sprites = squad2Sprites;
    this.squad1LifeBars = squad1LifeBars;
    this.squad2LifeBars = squad2LifeBars;
    this.crosses = [];
    // active player underlined
    const a = new Phaser.GameObjects.Graphics(scene);
    a.lineStyle(1, hexColors.soul);
    a.beginPath();
    a.moveTo(0, 0);
    a.lineTo(6 * FONT_CHAR_WIDTH, 0);
    a.strokePath();
    a.visible = false;
    this.add(a);
    this.activePlayerUnderline = a;
    // selected
    const s = this.scene.add.sprite(TILE_WIDTH_OFFSET, TILE_HEIGHT_OFFSET, "ui", CombatTilesetId.SelectedFrame);
    s.visible = false;
    this.add(s);
    this.activeCreature = s;
    // targeted
    const t = this.scene.add.sprite(TILE_WIDTH_OFFSET, TILE_HEIGHT_OFFSET, "ui", CombatTilesetId.TargetedFrame);
    t.visible = false;
    this.add(t);
    this.targetedCreature = t;
    // fade in
    this.alpha = 0;
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 300,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    g.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, TILE_WIDTH * REGION_LENGTH, TILE_HEIGHT * REGION_LENGTH),
      Phaser.Geom.Rectangle.Contains
    );
    g.on("pointerover", () => {
      this.accelerationFactor = 1;
      this.accelerateIcon.visible = false;
    });
    g.on("pointerout", () => {
      this.accelerationFactor = this.computedAccelerationFactor;
      if (this.accelerationFactor > 1) {
        this.accelerateIcon.visible = true;
      }
    });
    g.on("pointerdown", () => {
      if (this.playingTrace) {
        this.accelerationFactor = 100;
      } else {
        this.destroy();
      }
    });
  }

  fadeIn(s: Phaser.GameObjects.Sprite) {
    const duration = 300 / this.accelerationFactor;
    s.alpha = 0;
    s.visible = true;
    this.scene.tweens.add({
      targets: s,
      alpha: 1,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    const tileCoord = regionCoordToTileCoord(this.region);
    SoundManager.register(SoundType.BATTLE_START, translate(tileCoord, 1, 0), SoundLayer.COMBAT, true);
  }
  async playCombatTrace(trace: CombatTrace, winner: CombatWinner, soulsDropped: number) {
    // compute the required acceleration factor
    const numberOfAtomicTrace = trace
      .map(
        (t) =>
          t.squad1Trace.filter((tt) => isNotEmptyAtomicTrace(tt)).length +
          t.squad2Trace.filter((tt) => isNotEmptyAtomicTrace(tt)).length
      )
      .reduce((a, b) => a + b);
    this.computedAccelerationFactor = Math.max(1, numberOfAtomicTrace / 8);
    this.accelerationFactor = this.computedAccelerationFactor;
    if (this.accelerationFactor > 1) {
      this.accelerateIcon.visible = true;
    }
    this.playingTrace = true;
    try {
      // fade in the different outlines/underlines
      this.activePlayerUnderline.setPosition(24 + 15 * FONT_CHAR_WIDTH, this.title1.height + 10);
      this.activePlayerUnderline.alpha = 0;
      this.activePlayerUnderline.visible = true;
      this.scene.tweens.add({
        targets: this.activePlayerUnderline,
        alpha: 1,
        duration: 300 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });

      for (const [i, t] of trace.entries()) {
        this.round.text = `Round ${i + 1}`;
        this.moveActivePlayerUnderline(24 + 15 * FONT_CHAR_WIDTH, this.title1.height + 10);
        await this.playHalfRound(t.squad2Trace, 1);
        // exit early if round is done
        if (t.squad1Trace.filter(isNotEmptyAtomicTrace).length === 0) {
          break;
        }
        this.moveActivePlayerUnderline(21, this.title1.height + 10);
        await this.playHalfRound(t.squad1Trace, 0);
      }
      await sleep(300 / this.accelerationFactor);
      // remove sprites, lifebars, round, message, underline
      for (const s of [
        ...this.squad1Sprites,
        ...this.squad1LifeBars,
        ...this.squad2Sprites,
        ...this.squad2LifeBars,
        ...this.crosses,
        this.round,
        this.accelerateIcon,
        this.activePlayerUnderline,
        this.message,
      ]) {
        this.scene.tweens.add({
          targets: s,
          alpha: 0,
          duration: 600 / this.accelerationFactor,
          ease: Phaser.Math.Easing.Quadratic.InOut,
        });
      }
      this.scene.tweens.add({
        targets: this.roundFrame1,
        alpha: 0,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      this.scene.tweens.add({
        targets: this.roundFrame2,
        alpha: 0,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      this.scene.tweens.add({
        targets: this.roundFrame3,
        alpha: 0,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      await sleep(600 / this.accelerationFactor);
      // set round and message as visible
      this.round.visible = true;
      this.message.visible = true;

      this.round.setPosition(0, TILE_HEIGHT * 3 - 10);
      switch (winner) {
        case CombatWinner.DRAW: {
          this.round.setText(
            `It's a draw! \n${
              this.squad1[0]?.owner === this.playerAddress ? "You retreat" : this.squad1Player + " retreats"
            }`
          );
          break;
        }
        case CombatWinner.SQUAD1: {
          this.round.setText(`Winner: ${this.squad1[0]?.owner === this.playerAddress ? "You" : this.squad1Player}`);
          break;
        }
        case CombatWinner.SQUAD2: {
          this.round.setText(`Winner: ${this.squad2[0]?.owner === this.playerAddress ? "You" : this.squad2Player}`);
          break;
        }
      }
      this.round.x = (this.width - this.round.width) / 2;
      this.scene.tweens.add({
        targets: this.round,
        alpha: 1,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      await sleep(300 / this.accelerationFactor);
      this.message.setPosition(0, TILE_HEIGHT * 4.5 - 10);
      this.message.setText(`Souls: +${soulsDropped}`);
      this.message.x = (this.width - this.message.width) / 2;
      this.scene.tweens.add({
        targets: this.message,
        alpha: 1,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      await sleep(2000 / this.accelerationFactor);
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 600 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      await sleep(600 / this.accelerationFactor);
    } catch (e) {
      console.warn("combat renderer erred during playTrace. Probably got destroyed before end of animation");
      console.warn(e);
    }
  }

  async moveActivePlayerUnderline(x, y) {
    this.scene.tweens.add({
      targets: this.activePlayerUnderline,
      x,
      y,
      duration: 300 / this.accelerationFactor,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
  }

  setMessage(text: string) {
    this.message.text = text;
    this.message.x = (this.width - this.message.width) / 2;
  }

  async playHalfRound(halfRoundTrace: HalfRoundTrace, squad: number) {
    this.fadeIn(this.activeCreature);
    this.fadeIn(this.targetedCreature);
    for (const [i, a] of halfRoundTrace.entries()) {
      const target = a.targets[0];
      this.message.visible = false;
      if (!isNotEmptyAtomicTrace(a)) {
        // skip because this is not an actual action
        continue;
      }
      await this.setCreatureAsActive(squad, a.initiator, i === 0);
      this.message.visible = true;
      let message = `dmg=${a.damage}`;
      if (a.multipliers.strength !== 0) {
        message += ` ${a.multipliers.strength > 0 ? "+" : "-"}${Math.abs(a.multipliers.strength)}%`;
      }
      if (a.multipliers.group !== 0) {
        message += ` ${a.multipliers.group > 0 ? "+" : "-"}${Math.abs(a.multipliers.group)}%`;
      }
      this.setMessage(message);
      await this.setCreatureAsTargeted(target.squad, target.squadIndex, i === 0);
      await sleep(300 / this.accelerationFactor);
      await this.blinkCreature(target.squad, target.squadIndex);
      const lbs = target.squad === 0 ? this.squad1LifeBars : this.squad2LifeBars;
      this.scene.tweens.add({
        targets: lbs[target.squadIndex],
        life: a.newTargetStates[0].newLife,
        duration: 500 / this.accelerationFactor,
        ease: Phaser.Math.Easing.Quadratic.InOut,
      });
      // if dead, turn sprite off and draw cross
      if (a.newTargetStates[0].newLife === 0) {
        await this.setCreatureAsDead(target.squad, target.squadIndex);
      }
      await sleep(500 / this.accelerationFactor);
    }
    this.activeCreature.visible = false;
    this.targetedCreature.visible = false;
  }

  async blinkCreature(squad: number, squadIndex: number) {
    const c = squad === 0 ? this.squad1Sprites[squadIndex] : this.squad2Sprites[squadIndex];
    const tileCoord = regionCoordToTileCoord(this.region);
    SoundManager.register(SoundType.ATTACK, translate(tileCoord, 2, 0), SoundLayer.COMBAT, true);
    for (const _ of range(3)) {
      c.alpha = 0;
      await sleep(60 / this.accelerationFactor);
      c.alpha = 1;
      await sleep(90 / this.accelerationFactor);
    }
  }
  async setCreatureAsDead(squad: number, squadIndex: number, skipTweening = false) {
    const duration = (skipTweening ? 0 : 400) / this.accelerationFactor;
    const pos = this.getCreaturePosition(squad, squadIndex);
    const sprites = squad === 0 ? this.squad1Sprites : this.squad2Sprites;
    this.scene.tweens.add({
      targets: sprites[squadIndex],
      alpha: 0.2,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    sprites[squadIndex].anims.stop();
    const tileCoord = regionCoordToTileCoord(this.region);
    SoundManager.register(SoundType.DEATH, translate(tileCoord, 3, 0), SoundLayer.COMBAT, true);
    const cross = new Cross(this.scene, pos.x, pos.y);
    this.add(cross);
    this.crosses.push(cross);
    this.scene.tweens.add({
      targets: cross,
      progress: 1,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    const lbs = squad === 0 ? this.squad1LifeBars : this.squad2LifeBars;
    this.scene.tweens.add({
      targets: lbs[squadIndex],
      alpha: 0,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    await sleep(duration);
  }
  async setCreatureAsActive(squad: number, squadIndex: number, skipTweening = false) {
    const duration = (skipTweening ? 0 : 400) / this.accelerationFactor;
    const pos = this.getCreaturePosition(squad, squadIndex);
    this.scene.tweens.add({
      targets: this.activeCreature,
      x: pos.x + TILE_WIDTH_OFFSET,
      y: pos.y + TILE_HEIGHT_OFFSET,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    await sleep(duration);
  }
  async setCreatureAsTargeted(squad: number, squadIndex: number, skipTweening = false) {
    const duration = (skipTweening ? 0 : 400) / this.accelerationFactor;
    const pos = this.getCreaturePosition(squad, squadIndex);
    this.scene.tweens.add({
      targets: this.targetedCreature,
      x: pos.x + TILE_WIDTH_OFFSET,
      y: pos.y + TILE_HEIGHT_OFFSET,
      duration,
      ease: Phaser.Math.Easing.Quadratic.InOut,
    });
    await sleep(duration);
  }
  getCreaturePosition(squad: number, squadIndex: number): Phaser.Math.Vector2 {
    // horrible magic math. pls forgive me
    const isSquad2 = squad === 1;
    const offset = 5 * TILE_WIDTH;
    if (squadIndex < 4) {
      return new Phaser.Math.Vector2(TILE_WIDTH + (isSquad2 ? offset : 0), ((squadIndex + 2) * TILE_HEIGHT * 5) / 4);
    } else {
      return new Phaser.Math.Vector2(
        TILE_WIDTH + (isSquad2 ? offset - (TILE_WIDTH * 5) / 4 : (TILE_WIDTH * 5) / 4),
        ((squadIndex - 4 + 2) * TILE_HEIGHT * 5) / 4
      );
    }
  }
  addSquadSprites(squad: Creature[], isSquad1: boolean): [Phaser.GameObjects.Sprite[], LifeBar[]] {
    const out: Phaser.GameObjects.Sprite[] = [];
    const lbOut: LifeBar[] = [];
    for (const [i, c] of squad.entries()) {
      const pos = this.getCreaturePosition(isSquad1 ? 0 : 1, i);
      const s = this.createCreatureSprite(c, pos.x + TILE_WIDTH / 2, pos.y + TILE_HEIGHT / 2);
      this.add(s);
      out.push(s);
      const maxLife = getMaxLifeOfCreature(c);
      const lb = new LifeBar(this.scene, pos.x, pos.y - 2, c.life, maxLife);
      this.add(lb);
      lbOut.push(lb);
    }
    return [out, lbOut];
  }
  createCreatureSprite(c: Creature, x: number, y: number): Phaser.GameObjects.Sprite {
    const s = new Phaser.GameObjects.Sprite(this.scene, x, y, "creature");
    s.resetPipeline();
    const hueTint =
      c.owner === this.playerAddress
        ? colors[ColorKey.Player]
        : getColorFromEthAddress(CheckedTypeUtils.address(c.owner)).color;
    s.setData("hueTint", hueTint);
    s.setPipeline(this.pipeline);
    const sprite = creatureToSprite[c.species][c.creatureType];
    s.anims.play(sprite + "-idle", true);
    s.addToUpdateList();
    return s;
  }
  buildCombatFrame() {
    const frameTopLeft = this.scene.add.sprite(
      TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameTopLeft
    );
    const frameTopRight = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameTopRight
    );
    const frameBottomLeft = this.scene.add.sprite(
      TILE_WIDTH_OFFSET,
      TILE_HEIGHT * REGION_LENGTH - TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameBottomLeft
    );
    const frameBottomRight = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - TILE_WIDTH_OFFSET,
      TILE_HEIGHT * REGION_LENGTH - TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameBottomRight
    );
    const frameTop1 = this.scene.add.sprite(
      3 * TILE_WIDTH - 2 * TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameTop
    );
    const swordLeft = this.scene.add.sprite(
      4 * TILE_WIDTH - TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.SwordLeft
    );
    const swordRight = this.scene.add.sprite(
      5 * TILE_WIDTH - TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.SwordRight
    );
    const frameTop2 = this.scene.add.sprite(
      7 * TILE_WIDTH - 2 * TILE_WIDTH_OFFSET,
      TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameTop
    );
    const frameRight = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - TILE_WIDTH_OFFSET,
      (TILE_HEIGHT * REGION_LENGTH) / 2,
      "ui",
      CombatTilesetId.FrameRight
    );
    const frameBottom = this.scene.add.sprite(
      (TILE_WIDTH * REGION_LENGTH) / 2,
      TILE_HEIGHT * REGION_LENGTH - TILE_HEIGHT_OFFSET,
      "ui",
      CombatTilesetId.FrameBottom
    );
    const frameLeft = this.scene.add.sprite(
      TILE_WIDTH_OFFSET,
      (TILE_HEIGHT * REGION_LENGTH) / 2,
      "ui",
      CombatTilesetId.FrameLeft
    );
    const leftPlayerFrame1 = this.scene.add.sprite(
      TILE_WIDTH - TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameLeft
    );
    const leftPlayerFrame2 = this.scene.add.sprite(
      2 * TILE_WIDTH - TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameMiddle
    );
    const leftPlayerFrame3 = this.scene.add.sprite(
      3 * TILE_WIDTH - TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameRight
    );
    const rightPlayerFrame1 = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - TILE_WIDTH + TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameRight
    );
    const rightPlayerFrame2 = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - 2 * TILE_WIDTH + TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameMiddle
    );
    const rightPlayerFrame3 = this.scene.add.sprite(
      TILE_WIDTH * REGION_LENGTH - 3 * TILE_WIDTH + TILE_WIDTH_OFFSET / 2,
      TILE_HEIGHT * (2 / 3),
      "ui",
      CombatTilesetId.PlayerFrameLeft
    );
    this.roundFrame1 = this.scene.add.sprite(
      3 * TILE_WIDTH,
      this.title1.height + 26,
      "ui",
      CombatTilesetId.RoundFrameLeft
    );
    this.roundFrame2 = this.scene.add.sprite(
      4 * TILE_WIDTH,
      this.title1.height + 26,
      "ui",
      CombatTilesetId.RoundFrameMiddle
    );
    this.roundFrame3 = this.scene.add.sprite(
      5 * TILE_WIDTH,
      this.title1.height + 26,
      "ui",
      CombatTilesetId.RoundFrameRight
    );
    frameTop1.setScale(2, 1);
    frameTop2.setScale(2, 1);
    frameRight.setScale(1, 6);
    frameBottom.setScale(6, 1);
    frameLeft.setScale(1, 6);
    this.add(frameTopLeft);
    this.add(frameTopRight);
    this.add(frameBottomLeft);
    this.add(frameBottomRight);
    this.add(frameTop1);
    this.add(swordLeft);
    this.add(swordRight);
    this.add(frameTop2);
    this.add(frameRight);
    this.add(frameBottom);
    this.add(frameLeft);
    this.add(leftPlayerFrame1);
    this.add(leftPlayerFrame2);
    this.add(leftPlayerFrame3);
    this.add(rightPlayerFrame1);
    this.add(rightPlayerFrame2);
    this.add(rightPlayerFrame3);
    this.add(this.roundFrame1);
    this.add(this.roundFrame2);
    this.add(this.roundFrame3);
  }
  update() {
    for (const c of this.getAll()) {
      c.update();
    }
  }
  destroy() {
    for (const c of this.getAll()) {
      c.destroy();
    }
    this.destroyed = true;
  }
}
