export abstract class NotImplementedTilemap implements Phaser.Tilemaps.Tilemap {
  scene: Phaser.Scene;
  tileWidth: number;
  tileHeight: number;
  width: number;
  height: number;
  orientation: string;
  renderOrder: string;
  format: number;
  version: number;
  properties: object;
  widthInPixels: number;
  heightInPixels: number;
  imageCollections: Phaser.Tilemaps.ImageCollection[];
  images: any[];
  layers: Phaser.Tilemaps.LayerData[];
  tilesets: Phaser.Tilemaps.Tileset[];
  objects: Phaser.Tilemaps.ObjectLayer[];
  currentLayerIndex: number;
  hexSideLength: number;
  setRenderOrder(renderOrder: string | number): this {
    throw new Error("Method not implemented.");
  }
  addTilesetImage(
    tilesetName: string,
    key?: string | undefined,
    tileWidth?: number | undefined,
    tileHeight?: number | undefined,
    tileMargin?: number | undefined,
    tileSpacing?: number | undefined,
    gid?: number | undefined
  ): Phaser.Tilemaps.Tileset {
    throw new Error("Method not implemented.");
  }
  copy(
    srcTileX: number,
    srcTileY: number,
    width: number,
    height: number,
    destTileX: number,
    destTileY: number,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  createBlankLayer(
    name: string,
    tileset: string | Phaser.Tilemaps.Tileset | Phaser.Tilemaps.Tileset[] | string[],
    x?: number | undefined,
    y?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    tileWidth?: number | undefined,
    tileHeight?: number | undefined
  ): Phaser.Tilemaps.TilemapLayer {
    throw new Error("Method not implemented.");
  }
  createLayer(
    layerID: string | number,
    tileset: string | Phaser.Tilemaps.Tileset | Phaser.Tilemaps.Tileset[] | string[],
    x?: number | undefined,
    y?: number | undefined
  ): Phaser.Tilemaps.TilemapLayer {
    throw new Error("Method not implemented.");
  }
  createFromObjects(
    objectLayerName: string,
    config: Phaser.Types.Tilemaps.CreateFromObjectLayerConfig | Phaser.Types.Tilemaps.CreateFromObjectLayerConfig[]
  ): Phaser.GameObjects.GameObject[] {
    throw new Error("Method not implemented.");
  }
  createFromTiles(
    indexes: number | any[],
    replacements: number | any[],
    spriteConfig: Phaser.Types.GameObjects.Sprite.SpriteConfig,
    scene?: Phaser.Scene | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.GameObjects.Sprite[] {
    throw new Error("Method not implemented.");
  }
  fill(
    index: number,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  filterObjects(
    objectLayer: string | Phaser.Tilemaps.ObjectLayer,
    callback: TilemapFilterCallback,
    context?: object | undefined
  ): Phaser.Types.Tilemaps.TiledObject[] {
    throw new Error("Method not implemented.");
  }
  filterTiles(
    callback: Function,
    context?: object | undefined,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile[] {
    throw new Error("Method not implemented.");
  }
  findByIndex(
    index: number,
    skip?: number | undefined,
    reverse?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  findObject(
    objectLayer: string | Phaser.Tilemaps.ObjectLayer,
    callback: TilemapFindCallback,
    context?: object | undefined
  ): Phaser.Types.Tilemaps.TiledObject {
    throw new Error("Method not implemented.");
  }
  findTile(
    callback: FindTileCallback,
    context?: object | undefined,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  forEachTile(
    callback: EachTileCallback,
    context?: object | undefined,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  getImageIndex(name: string): number {
    throw new Error("Method not implemented.");
  }
  getImageLayerNames(): string[] {
    throw new Error("Method not implemented.");
  }
  getIndex(location: any[], name: string): number {
    throw new Error("Method not implemented.");
  }
  getLayer(layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): Phaser.Tilemaps.LayerData {
    throw new Error("Method not implemented.");
  }
  getObjectLayer(name?: string | undefined): Phaser.Tilemaps.ObjectLayer {
    throw new Error("Method not implemented.");
  }
  getObjectLayerNames(): string[] {
    throw new Error("Method not implemented.");
  }
  getLayerIndex(layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): number {
    throw new Error("Method not implemented.");
  }
  getLayerIndexByName(name: string): number {
    throw new Error("Method not implemented.");
  }
  getTileAt(
    tileX: number,
    tileY: number,
    nonNull?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  getTileAtWorldXY(
    worldX: number,
    worldY: number,
    nonNull?: boolean | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  getTileLayerNames(): string[] {
    throw new Error("Method not implemented.");
  }
  getTilesWithin(
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile[] {
    throw new Error("Method not implemented.");
  }
  getTilesWithinShape(
    shape: Phaser.Geom.Circle | Phaser.Geom.Line | Phaser.Geom.Rectangle | Phaser.Geom.Triangle,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile[] {
    throw new Error("Method not implemented.");
  }
  getTilesWithinWorldXY(
    worldX: number,
    worldY: number,
    width: number,
    height: number,
    filteringOptions?: Phaser.Types.Tilemaps.FilteringOptions | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile[] {
    throw new Error("Method not implemented.");
  }
  getTileset(name: string): Phaser.Tilemaps.Tileset {
    throw new Error("Method not implemented.");
  }
  getTilesetIndex(name: string): number {
    throw new Error("Method not implemented.");
  }
  hasTileAt(tileX: number, tileY: number, layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): boolean {
    throw new Error("Method not implemented.");
  }
  hasTileAtWorldXY(
    worldX: number,
    worldY: number,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): boolean {
    throw new Error("Method not implemented.");
  }
  layer: Phaser.Tilemaps.LayerData;
  putTileAt(
    tile: number | Phaser.Tilemaps.Tile,
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  putTileAtWorldXY(
    tile: number | Phaser.Tilemaps.Tile,
    worldX: number,
    worldY: number,
    recalculateFaces?: boolean | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  putTilesAt(
    tile: Phaser.Tilemaps.Tile[] | number[] | number[][] | Phaser.Tilemaps.Tile[][],
    tileX: number,
    tileY: number,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  randomize(
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    indexes?: number[] | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  calculateFacesAt(
    tileX: number,
    tileY: number,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  calculateFacesWithin(
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  removeLayer(layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  destroyLayer(layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  removeAllLayers(): this {
    throw new Error("Method not implemented.");
  }
  removeTile(
    tiles: Phaser.Tilemaps.Tile | Phaser.Tilemaps.Tile[],
    replaceIndex?: number | undefined,
    recalculateFaces?: boolean | undefined
  ): Phaser.Tilemaps.Tile[] {
    throw new Error("Method not implemented.");
  }
  removeTileAt(
    tileX: number,
    tileY: number,
    replaceWithNull?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  removeTileAtWorldXY(
    worldX: number,
    worldY: number,
    replaceWithNull?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tile {
    throw new Error("Method not implemented.");
  }
  renderDebug(
    graphics: Phaser.GameObjects.Graphics,
    styleConfig?: Phaser.Types.Tilemaps.StyleConfig | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  renderDebugFull(
    graphics: Phaser.GameObjects.Graphics,
    styleConfig?: Phaser.Types.Tilemaps.StyleConfig | undefined
  ): this {
    throw new Error("Method not implemented.");
  }
  replaceByIndex(
    findIndex: number,
    newIndex: number,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setCollision(
    indexes: number | any[],
    collides?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined,
    updateLayer?: boolean | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setCollisionBetween(
    start: number,
    stop: number,
    collides?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setCollisionByProperty(
    properties: object,
    collides?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setCollisionByExclusion(
    indexes: number[],
    collides?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setCollisionFromCollisionGroup(
    collides?: boolean | undefined,
    recalculateFaces?: boolean | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setTileIndexCallback(
    indexes: number | number[],
    callback: Function,
    callbackContext: object,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setTileLocationCallback(
    tileX: number,
    tileY: number,
    width: number,
    height: number,
    callback: Function,
    callbackContext?: object | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  setLayer(layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined): this {
    throw new Error("Method not implemented.");
  }
  setBaseTileSize(tileWidth: number, tileHeight: number): this {
    throw new Error("Method not implemented.");
  }
  setLayerTileSize(
    tileWidth: number,
    tileHeight: number,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): this {
    throw new Error("Method not implemented.");
  }
  shuffle(
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  swapByIndex(
    tileA: number,
    tileB: number,
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  tileToWorldX(
    tileX: number,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): number {
    throw new Error("Method not implemented.");
  }
  tileToWorldY(
    tileY: number,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): number {
    throw new Error("Method not implemented.");
  }
  tileToWorldXY(
    tileX: number,
    tileY: number,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    throw new Error("Method not implemented.");
  }
  weightedRandomize(
    weightedIndexes: object[],
    tileX?: number | undefined,
    tileY?: number | undefined,
    width?: number | undefined,
    height?: number | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Tilemaps.Tilemap {
    throw new Error("Method not implemented.");
  }
  worldToTileX(
    worldX: number,
    snapToFloor?: boolean | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): number {
    throw new Error("Method not implemented.");
  }
  worldToTileY(
    worldY: number,
    snapToFloor?: boolean | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): number {
    throw new Error("Method not implemented.");
  }
  worldToTileXY(
    worldX: number,
    worldY: number,
    snapToFloor?: boolean | undefined,
    vec2?: Phaser.Math.Vector2 | undefined,
    camera?: Phaser.Cameras.Scene2D.Camera | undefined,
    layer?: string | number | Phaser.Tilemaps.TilemapLayer | undefined
  ): Phaser.Math.Vector2 {
    throw new Error("Method not implemented.");
  }
  destroy(): void {
    throw new Error("Method not implemented.");
  }
}
