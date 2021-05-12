import { hexColors } from "../theme";
import { rgbToHex } from "./utils/colors";

// We keep 25 creatures/imps on "standby" instead of destroying them when they leave the viewport.
// Standby means they're deactivated and hidden, but still part of the group and don't
// need to be recreated when an object is requested from the group.
export const CREATURE_GROUP_STANDBY_SIZE = 25;
export const IMP_GROUP_STANDBY_SIZE = 25;

export const GAME_MAP_RENDER_CHUNK_SIZE = 8;
export const STRATEGIC_MAP_RENDER_CHUNK_SIZE = 16;

export const GAME_MAP_TILEMAP_CHUNK_SIZE = 64;
export const STRATEGIC_MAP_TILEMAP_CHUNK_SIZE = 128;

export const FONT = '"04b_03"';
//export const FONT = 'creepRegular';

export const TILE_WIDTH = 24;
export const TILE_HEIGHT = 24;
export const TILE_WIDTH_OFFSET = TILE_WIDTH * (1 / 2);
export const TILE_HEIGHT_OFFSET = TILE_HEIGHT * (1 / 2);

export enum TerrainTilesetId {
  Wall = 168,
  WallMinedBottom = 136,
  WallRockBottom = 136,
  PlayerWall = 7,
  PlayerWallMinedBottom = 6,
  ForeignWall = 7,
  ForeignWallBottom = 6,
  Ground = 2,
  OwnedGround = 1,
  RockA = 9,
  RockB = 3,
  RockC = 32,
  RockD = 33,
  Full = 8,
  Empty = 9,
  Gold = 4,
  Soul = 5,
  SoulGroundResource = 35,
  BedRock = 0,
}

export enum CombatTilesetId {
  FrameTopLeft = 0,
  FrameTop = 1,
  FrameTopRight = 2,
  SwordLeft = 3,
  SwordRight = 4,
  PlayerFrameLeft = 5,
  PlayerFrameMiddle = 6,
  PlayerFrameRight = 7,
  FrameLeft = 8,
  FrameRight = 10,
  SelectedFrame = 11,
  TargetedFrame = 12,
  RoundFrameLeft = 13,
  RoundFrameMiddle = 14,
  RoundFrameRight = 15,
  FrameBottomLeft = 16,
  FrameBottom = 17,
  FrameBottomRight = 18,
  LifeBarLeft = 19,
  LifeBarRight = 20,
}

/*
Connection tile notation:
Naming convention assumes a central "node"
Then an "arm" sticking out from that node in specified direction
Arms go clockwise starting from the left of that node
For example, LeftUpRight means there's a node with an arm pointing left, up, and right
          2  
         | |
         | |
         | |
1  -----[  ]----- 3
   -----[  ]-----
         4
*/

// Names are mapped to a tuple of tile indices
// index 0 = wall tileset id
// index 1 = rock tileset id

export const WALL_IDS = {
  // Transitions (inner faces, no outer border)
  upRightDown: [164, 388],
  leftRightDown: [165, 389],
  leftUpRight: [196, 420],
  leftUpDown: [197, 421],
  leftUpRightDown: [128, 352],

  // Transitions (no inner faces, outer border)
  oUpRightDown: [230, 454],
  oLeftUpRight: [260, 484],
  oLeftUpDown: [231, 455],
  oLeftRightDown: [165, 389],
  oLeftRightDownFaceLeft: [232, 456],
  oLeftRightDownFaceRight: [233, 457],
  leftUpRightBorderRight: [265, 489],
  leftUpRightBorderLeft: [264, 488],

  // Transitions (inner faces, outer border)
  ioUpRightDown: [100, 324],
  ioLeftRightDown: [101, 325],
  ioLeftUpRight: [132, 356],
  ioLeftUpDown: [133, 357],

  // Corners (inner faces, no outer border)
  upRight: [192, 416],
  leftUp: [193, 417],
  leftDown: [161, 385],
  rightDown: [160, 384],

  // Corners (no inner faces, outer border)
  oUpRight: [194, 418],
  oLeftUp: [195, 419],
  oLeftDown: [163, 387],
  oRightDown: [162, 386],

  // Corners (inner faces && outer border)
  ioUpRight: [130, 354],
  ioLeftUp: [131, 355],
  ioLeftDown: [99, 323],
  ioRightDown: [98, 322],

  // Straight pieces
  leftRight: [166, 390],
  upDown: [129, 353],

  // Straight pieces (depth pass)
  horizontalFace: [199, 423],
  horizontalFaceBorder: [97, 321],
  verticalBorderRight: [198, 422],
  verticalBorderLeft: [167, 391],

  // End pieces
  down: [103, 359],
  left: [135, 327],
  right: [102, 326],
  top: [134, 358],
  single: [168, 392],
};

export enum ObjectTilesetId {
  DHa = 268,
  DHb = 269,
  DHc = 300,
  DHd = 301,
  GoldStorageA = 524,
  GoldStorageB = 525,
  GoldStorageC = 526,
  GoldStorageD = 527,
  GoldGenerator = 460,
  SoulStorage = 428,
  SoulGenerator = 396,
  Lair = 492,
}

export const ObjectTilesetAnimations: { [key in ObjectTilesetId]?: number[] } = {
  [ObjectTilesetId.DHa]: [268, 270, 272, 274, 332, 334, 336, 338],
  [ObjectTilesetId.DHb]: [269, 271, 273, 275, 333, 335, 337, 339],
  [ObjectTilesetId.DHc]: [300, 302, 304, 306, 364, 366, 368, 370],
  [ObjectTilesetId.DHd]: [301, 303, 305, 307, 365, 367, 369, 371],
  [ObjectTilesetId.SoulGenerator]: [396, 397, 398, 399, 400, 401, 402, 403],
  [ObjectTilesetId.SoulStorage]: [428, 429, 430, 431, 432, 433, 434, 435],
  [ObjectTilesetId.GoldGenerator]: [460, 461, 462, 463, 464, 465, 466, 467],
  [ObjectTilesetId.Lair]: [492, 493, 494, 495, 496, 497, 498, 499],
};

export enum ColorKey {
  Background = 0,
  Gray = 1,
  DarkGray = 2,
  LightGray = 3,
  Player = 4,
  White = 5,
  Grayer = 6,
}

export const terrainTilesetIdToDefaultColorKey: {
  [key in TerrainTilesetId]?: ColorKey;
} = {
  [TerrainTilesetId.Ground]: ColorKey.White,
  [TerrainTilesetId.OwnedGround]: ColorKey.White,
  [TerrainTilesetId.RockA]: ColorKey.White,
  [TerrainTilesetId.RockB]: ColorKey.White,
  [TerrainTilesetId.RockC]: ColorKey.White,
  [TerrainTilesetId.Wall]: ColorKey.Player,
  [TerrainTilesetId.PlayerWall]: ColorKey.Player,
};

export const colors: { [key in ColorKey]?: number } = {
  [ColorKey.Background]: rgbToHex(35, 31, 38),
  [ColorKey.DarkGray]: rgbToHex(41, 41, 41),
  [ColorKey.Gray]: rgbToHex(58, 58, 58),
  [ColorKey.LightGray]: rgbToHex(91, 91, 91),
  [ColorKey.Player]: rgbToHex(170, 76, 54),
  [ColorKey.White]: rgbToHex(255, 255, 255),
};

export enum LoadingStage {
  Planned = 0,
  Submitting = 1,
  Confirming = 2,
  Waiting = 3,
}

export const loadingColors: { [key in LoadingStage]?: number } = {
  [LoadingStage.Planned]: hexColors.white,
  [LoadingStage.Submitting]: hexColors.txScheduled,
  [LoadingStage.Confirming]: hexColors.txConfirming,
  [LoadingStage.Waiting]: hexColors.waiting,
};

export const getDefaultColorFromTerrainTilesetId = (tilesetId: TerrainTilesetId): number => {
  return colors[terrainTilesetIdToDefaultColorKey[tilesetId] as ColorKey] as number;
};
