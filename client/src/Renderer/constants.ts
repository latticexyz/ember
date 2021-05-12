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
  // blank tile for now given we don't have a good tile to put inside groups of player walls
  InnerWall = 10,
  Ground = 2,
  OwnedGroundLvl1 = 36,
  OwnedGroundLvl2 = 38,
  OwnedGroundLvl3 = 37,
  RockA = 9,
  RockB = 3,
  RockC = 32,
  RockD = 33,
  Full = 8,
  Empty = 9,
  Gold = 4,
  Soul = 5,
  SoulPit = 40,
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

const OFFSET_BETWEEN_WALLS_AND_GEM_WALLS = 448;
export const GEM_WALL_IDS = Object.fromEntries(
  Object.entries(WALL_IDS).map(([k, v]) => [
    k,
    [v[0] + OFFSET_BETWEEN_WALLS_AND_GEM_WALLS, v[1] + OFFSET_BETWEEN_WALLS_AND_GEM_WALLS],
  ])
);

export enum ObjectTilesetId {
  DHa1 = 12,
  DHb1 = 13,
  DHc1 = 44,
  DHd1 = 45,
  DHa2 = 140,
  DHb2 = 141,
  DHc2 = 172,
  DHd2 = 173,
  DHa3 = 268,
  DHb3 = 269,
  DHc3 = 300,
  DHd3 = 301,
  GoldStorageA = 524,
  GoldStorageB = 525,
  GoldStorageC = 526,
  GoldStorageD = 527,
  GoldGenerator = 876,
  SoulStorage = 428,
  SoulGenerator = 460,
  Lair = 1036,
  TrainingRoom1 = 748,
  TrainingRoom2 = 780,
  TrainingRoom3 = 812,
  TrainingRoom4 = 844,
}

const generateDHSequenceA = (offset: number) => [12, 14, 16, 18, 76, 78, 80, 82].map((n) => n + offset);
const generateDHSequenceB = (offset: number) => [12, 14, 16, 18, 76, 78, 80, 82].map((n) => n + offset + 1);
const generateDHSequenceC = (offset: number) => [12, 14, 16, 18, 76, 78, 80, 82].map((n) => n + offset + 32);
const generateDHSequenceD = (offset: number) => [12, 14, 16, 18, 76, 78, 80, 82].map((n) => n + offset + 32 + 1);

export const ObjectTilesetAnimations: { [key in ObjectTilesetId]?: number[][] } = {
  [ObjectTilesetId.DHa1]: [generateDHSequenceA(0)],
  [ObjectTilesetId.DHb1]: [generateDHSequenceB(0)],
  [ObjectTilesetId.DHc1]: [generateDHSequenceC(0)],
  [ObjectTilesetId.DHd1]: [generateDHSequenceD(0)],
  [ObjectTilesetId.DHa2]: [generateDHSequenceA(128)],
  [ObjectTilesetId.DHb2]: [generateDHSequenceB(128)],
  [ObjectTilesetId.DHc2]: [generateDHSequenceC(128)],
  [ObjectTilesetId.DHd2]: [generateDHSequenceD(128)],
  [ObjectTilesetId.DHa3]: [generateDHSequenceA(256)],
  [ObjectTilesetId.DHb3]: [generateDHSequenceB(256)],
  [ObjectTilesetId.DHc3]: [generateDHSequenceC(256)],
  [ObjectTilesetId.DHd3]: [generateDHSequenceD(256)],
  [ObjectTilesetId.SoulGenerator]: [
    [460, 461, 462, 463, 464, 465, 466, 467],
    [492, 493, 494, 495, 496, 497, 498, 499],
    [556, 557, 558, 559, 560, 561, 562, 563],
    [588, 589, 590, 591, 592, 593, 594, 595],
    [620, 621, 622, 623, 624, 625, 626, 627],
  ],
  [ObjectTilesetId.SoulStorage]: [[428, 429, 430, 431, 432, 433, 434, 435]],
  [ObjectTilesetId.GoldGenerator]: [
    [876, 877, 878, 879, 880, 881, 882, 883],
    [908, 909, 910, 911, 912, 913, 914, 915],
    [940, 941, 942, 943, 944, 945, 946, 947],
    [972, 973, 974, 975, 976, 977, 978, 979],
    [1004, 1005, 1006, 1007, 1008, 1009, 1010, 1011],
  ],
  [ObjectTilesetId.Lair]: [
    [1036, 1037, 1038, 1039, 1040, 1041, 1042, 1043],
    [1068, 1069, 1070, 1071, 1072, 1073, 1074, 1075],
    [1100, 1101, 1102, 1103, 1104, 1105, 1106, 1107],
    [1132, 1133, 1134, 1135, 1136, 1137, 1138, 1139],
    [1164, 1165, 1166, 1167, 1168, 1169, 1170, 1171],
  ],
  [ObjectTilesetId.TrainingRoom2]: [[780, 781, 782, 783, 784, 785, 786, 787]],
  [ObjectTilesetId.TrainingRoom3]: [[812, 813, 814, 815, 816, 817, 818, 819]],
  [ObjectTilesetId.TrainingRoom4]: [[844, 845, 846, 847, 848, 849, 850, 851]],
};

export enum SpriteName {
  Imp = "Imp",
  BalancedNormal = "BalancedNormal",
  BalancedBlue = "BalancedBlue",
  BalancedRed = "BalancedRed",
  BalancedBlack = "BalancedBlack",
  BalancedUnique = "BalancedUnique",
  Hero = "Hero",
}

export enum SpriteModifier {
  Idle = "Idle",
  Walking = "Walking",
  Action = "Action",
}

// I don't know the right data structure for this yet. we'll probably want to mix and match different parts together
// there should be one prefix per part (headPrefix, ....)
export interface ModularSprite {
  prefix: string;
  length: number;
}

export const MODULAR_SPRITE_PARTS = ["head", "torso", "leftHand", "rightHand", "leg"];
export const SpriteNameAndModifierToFrameStartAndNumber: {
  [key in SpriteName]: { [key in SpriteModifier]: { start: number; length: number } | ModularSprite };
} = {
  [SpriteName.Imp]: {
    [SpriteModifier.Idle]: { start: 22, length: 4 },
    [SpriteModifier.Walking]: { start: 54, length: 4 },
    [SpriteModifier.Action]: { start: 86, length: 5 },
  },
  [SpriteName.BalancedNormal]: {
    [SpriteModifier.Idle]: { start: 150, length: 4 },
    [SpriteModifier.Walking]: { start: 182, length: 4 },
    [SpriteModifier.Action]: { start: 214, length: 5 },
  },
  [SpriteName.BalancedBlue]: {
    [SpriteModifier.Idle]: { start: 630, length: 4 },
    [SpriteModifier.Walking]: { start: 662, length: 4 },
    [SpriteModifier.Action]: { start: 694, length: 4 },
  },
  [SpriteName.BalancedRed]: {
    [SpriteModifier.Idle]: { start: 278, length: 4 },
    [SpriteModifier.Walking]: { start: 310, length: 4 },
    [SpriteModifier.Action]: { start: 342, length: 5 },
  },
  [SpriteName.BalancedBlack]: {
    [SpriteModifier.Idle]: { start: 758, length: 4 },
    [SpriteModifier.Walking]: { start: 790, length: 4 },
    [SpriteModifier.Action]: { start: 822, length: 5 },
  },
  [SpriteName.BalancedUnique]: {
    [SpriteModifier.Idle]: { start: 886, length: 4 },
    [SpriteModifier.Walking]: { start: 918, length: 4 },
    [SpriteModifier.Action]: { start: 950, length: 6 },
  },
  [SpriteName.Hero]: {
    [SpriteModifier.Idle]: { prefix: "sprites/heroes/6/idle", length: 4 },
    [SpriteModifier.Walking]: { prefix: "sprites/heroes/6/walk", length: 4 },
    [SpriteModifier.Action]: { prefix: "sprites/heroes/6/attack", length: 4 },
  },
};

export const isAnimationModular = (spriteName: SpriteName, spriteModifier: SpriteModifier): boolean => {
  return Object.keys(SpriteNameAndModifierToFrameStartAndNumber[spriteName][spriteModifier]).includes("prefix")
    ? true
    : false;
};

export const getAnimationNameFromSpriteNameAndModifier = (
  spriteName: SpriteName,
  spriteModifier: SpriteModifier
): string => {
  return `${spriteName}-${spriteModifier}`;
};

export const getModularSpriteAnimationNamesFromSpriteNameAndModifier = (
  part: string,
  spriteName: SpriteName,
  spriteModifier: SpriteModifier
): string => {
  return `${part}-${spriteName}-${spriteModifier}`;
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
  [TerrainTilesetId.RockA]: ColorKey.White,
  [TerrainTilesetId.RockB]: ColorKey.White,
  [TerrainTilesetId.RockC]: ColorKey.White,
  [TerrainTilesetId.Wall]: ColorKey.Player,
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
