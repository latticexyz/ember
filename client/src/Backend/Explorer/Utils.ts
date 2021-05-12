import { WorldCoord, PerlinValues, Rectangle } from "../../_types/GlobalTypes";
import { perlin, PerlinConfig } from "@latticexyz/ember-hashing";
import { CoordMap } from "../../Utils/CoordMap";
import { regionCoordToTileCoord } from "../Utils/Utils";
import { REGION_LENGTH } from "../Utils/Defaults";
import { toJS } from "mobx";

export function explorePerlinInRegion(
  region: WorldCoord,
  perlinConfig1: PerlinConfig,
  perlinConfig2: PerlinConfig
): CoordMap<PerlinValues> {
  const perlinValues = new CoordMap<PerlinValues>();
  const { x: topLeftX, y: topLeftY } = regionCoordToTileCoord(region);
  for (let x = topLeftX; x < topLeftX + REGION_LENGTH; x++) {
    for (let y = topLeftY; y < topLeftY + REGION_LENGTH; y++) {
      const coord: WorldCoord = { x, y };
      const perlin1 = perlin({ x, y }, perlinConfig1);
      const perlin2 = perlin({ x, y }, perlinConfig2);
      perlinValues.set(coord, { gold: perlin1, soul: perlin2 });
    }
  }
  return toJS(perlinValues);
}
