import RegionResources from "../objects/main/regionResources";
import { Polygon } from "../objects/main/polygon";
import TileLoading from "../objects/main/tileLoading";
import { Creature } from "../objects/main/creature";
import { CreaturePath } from "../objects/main/creaturePath";
import Imp from "../objects/main/imp";
import { Service } from "../game";
import MainScene from "../scenes/mainScene";

export class GroupRegistry implements Service {
  public layer: Phaser.GameObjects.Layer;

  public groups: {
    regionAndEmpireBoundary: Phaser.GameObjects.Group;
    creature: Phaser.GameObjects.Group;
    creaturePath: Phaser.GameObjects.Group;
    imp: Phaser.GameObjects.Group;
    tileLoading: Phaser.GameObjects.Group;
    emitter: Phaser.GameObjects.Group;
    combatRenderer: Phaser.GameObjects.Group;
    regionResource: Phaser.GameObjects.Group;
    influence: Phaser.GameObjects.Group;
  };

  private scene: MainScene;

  constructor() { }

  bootService(scene: MainScene) {
    this.scene = scene;
    this.layer = this.scene.add.layer();
    this.layer.setDepth(100);

    this.groups = {
      regionAndEmpireBoundary: this.scene.add.group(),
      regionResource: this.scene.add.group(),
      influence: this.scene.add.group(),
      tileLoading: this.scene.add.group(),
      creature: this.scene.add.group(),
      creaturePath: this.scene.add.group(),
      imp: this.scene.add.group(),
      emitter: this.scene.add.group(),
      combatRenderer: this.scene.add.group(),
    };

    this.groups.regionAndEmpireBoundary.setVisible(false);
    this.groups.regionResource.classType = RegionResources;
    this.groups.influence.classType = Polygon;
    this.groups.influence.setVisible(false);
    this.groups.tileLoading.classType = TileLoading;
    this.groups.creature.classType = Creature;
    this.groups.creaturePath.classType = CreaturePath;
    this.groups.imp.classType = Imp;

    const strategicMapIgnore = (item: Phaser.GameObjects.GameObject) => {
      this.scene.strategicMap.camera.ignore(item);
    };
    for (const group of Object.values(this.groups)) {
      group.createCallback = (item) => {
        strategicMapIgnore(item);
        this.layer.add(item);
      };
    }
  }

  destroyService() {
    for (const group of Object.values(this.groups)) {
      group.destroy();
    }
    this.layer.destroy();
  }
}
