import { WorldCoord } from "../../_types/GlobalTypes";
import { BigNumberish, BigNumber } from "ethers";

export type UnpackedCoords = [WorldCoord, WorldCoord, WorldCoord, WorldCoord];

const PAD_VALUE = 2 ** 31 - 1;

function requireBits(num: number, bits: number) {
  if (num > 2 ** (bits - 1) - 1 || num < -(2 ** (bits - 1))) {
    throw new Error(`Int${bits} overflow`);
  }
}

function toHexString(num: number, bits: number): string {
  requireBits(num, bits);
  const padStart = num < 0 ? "f" : "0";
  return (num >>> 0).toString(16).padStart(bits / 4, padStart);
}

function hexStringToNumber(hex: string) {
  return parseInt(hex, 16) >> 0;
}

export function packCoords(coords: UnpackedCoords): BigNumber {
  let packed = "";
  for (const coord of coords) {
    packed += toHexString(coord.x, 32);
    packed += toHexString(coord.y, 32);
  }
  return BigNumber.from("0x" + packed);
}

export function unpackCoords(packed: BigNumberish): UnpackedCoords {
  let packedString = BigNumber.from(packed).toHexString();
  const coords: WorldCoord[] = [];

  for (let i = 0; i < 4; i++) {
    const yHex = packedString.substr(-8);
    packedString = packedString.substring(0, packedString.length - 8);
    const xHex = packedString.substr(-8);
    packedString = packedString.substring(0, packedString.length - 8);
    coords.unshift({ x: hexStringToNumber(xHex), y: hexStringToNumber(yHex) });
  }

  return coords as UnpackedCoords;
}

export function unpackCoordList(packedList: BigNumberish[]): WorldCoord[] {
  const coords: WorldCoord[] = [];

  for (const packed of packedList) {
    const unpacked = unpackCoords(packed);
    for (const item of unpacked) {
      if (item.x === PAD_VALUE && item.y === PAD_VALUE) {
        return coords;
      }
      coords.push(item);
    }
  }

  return coords;
}

export function packCoordList(coords: WorldCoord[]): BigNumber[] {
  const lastGroupLength = coords.length % 4;

  // coords array must be made divisible by 4
  const padLength = lastGroupLength > 0 ? 4 - lastGroupLength : 0;
  const paddedCoordList = [...coords];
  for (let i = 0; i < padLength; i++) {
    paddedCoordList.push({ x: PAD_VALUE, y: PAD_VALUE });
  }

  const packedList: BigNumber[] = [];
  for (let i = 0; i < paddedCoordList.length / 4; i++) {
    packedList.push(
      packCoords([
        paddedCoordList[i * 4],
        paddedCoordList[i * 4 + 1],
        paddedCoordList[i * 4 + 2],
        paddedCoordList[i * 4 + 3],
      ])
    );
  }

  return packedList;
}

export function coordToId(coord: WorldCoord): BigNumber {
  let id = toHexString(coord.x, 128);
  id += toHexString(coord.y, 128);
  return BigNumber.from("0x" + id);
}

export function idToCoord(id: BigNumberish): WorldCoord {
  let idString = BigNumber.from(id).toHexString();
  const yHex = idString.substr(-8);
  idString = idString.substring(0, idString.length - 32);
  const xHex = idString.substr(-8);
  return { x: hexStringToNumber(xHex), y: hexStringToNumber(yHex) };
}
