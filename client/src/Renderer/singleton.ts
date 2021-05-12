export class ActivePhaserGame {
  static instance: Phaser.Game | undefined;
  static resizeListener: () => void;

  static resize(game: Phaser.Game | undefined) {
    if (!game) return;
    const width = window.innerWidth / game.scale.zoom;
    const height = window.innerHeight / game.scale.zoom;
    game.scale.resize(width, height);
  }

  static hasInstance(): boolean {
    return !!this.instance;
  }

  static getInstance(): Phaser.Game | undefined {
    return this.instance;
  }

  static boot(config: Phaser.Types.Core.GameConfig) {
    if (this.instance) {
      throw new Error("Called boot() on ActivePhaserGame, but already have an instance");
    }
    // Boot up an instance of Phaser.Game. Note that this does not call the functions of the actual
    // scenes of the game (like create()), but rather just instantiate the object.
    this.instance = new Phaser.Game(config);

    // Add listener for a window resized event. This lets us dynamically change the size of the
    // game object when the window changes size.
    this.resizeListener = () => this.resize(this.instance);
    window.addEventListener("resize", this.resizeListener);

    (window as any).game = this.instance;
  }
  static shutdown() {
    if (!this.instance) {
      throw new Error("No ActivePhaserGame instance");
    }

    // Destroy all active Phaser scenes. This iterates the scenes by using the scene manager and removes
    // each from the scene manager. 
    //
    // Important Note: This might fail and cause a Phaser crash if we do not clean up all Phaser Objects
    //                 prior to this call (i.e. call destroy()). This is due to the fact that leaving
    //                 Phaser object stuff dangling around prevents clean garbage collection and internal
    //                 functions of Phaser that are resposible for cleaning up the scene and firing events
    //                 to alert the plugins and such of the scene, will be confused by stuff laying around
    //                 and not getting destroyed.
    //                 TL/DR: if something has a Phaser.Object or similar, it has to be destroyed.
    this.instance.scene.getScenes().map((s) => (this.instance as Phaser.Game).scene.remove(s.scene.key));
    // Destroy the scene manager.
    this.instance.scene.destroy();
    // Destroy the instance of the Phaser.Game.
    this.instance.destroy(true);
    this.instance = undefined;

    window.removeEventListener("resize", this.resizeListener);
  }
}
