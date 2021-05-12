import { LocationId, WorldCoord, PerlinValues } from "../../_types/GlobalTypes";

export interface TileChunk {
  coords: Map<LocationId, WorldCoord>;
  perlinValues: Map<LocationId, PerlinValues>;
}

export type RegionChunk = Map<LocationId, WorldCoord>;
