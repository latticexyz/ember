import { WorldCoord } from "../../_types/GlobalTypes";

export const worldCoordsToVector2 = (coord: WorldCoord): Phaser.Math.Vector2 => {
  return new Phaser.Math.Vector2(coord.x, coord.y);
};
