import { BigNumberish, BigNumber } from "ethers";
import {
  unpackCoords,
  packCoords,
  unpackCoordList,
  UnpackedCoords,
  packCoordList,
  coordToId,
  idToCoord,
} from "./PackedCoords";

describe("PackedCoords", function () {
  describe("unpackCoords", () => {
    it("should unpack a uint256 into 4 coord structs", async () => {
      const packed = "0x0000000100000002000000030000000400000005000000060000000700000008";
      const coords = unpackCoords(packed);
      expect(coords.length).toEqual(4);
      expect(coords).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ]);
    });

    it("should work with negative coords", async () => {
      const packed = "0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8";

      const coords = unpackCoords(packed);
      expect(coords.length).toEqual(4);
      expect(coords).toEqual([
        { x: -1, y: -2 },
        { x: -3, y: -4 },
        { x: -5, y: -6 },
        { x: -7, y: -8 },
      ]);
    });
  });

  describe("packCoords", () => {
    it("should pack four coord structs into one uint256", async () => {
      const coords: UnpackedCoords = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ];

      const packed = packCoords(coords);
      expect(packed).toEqual(BigNumber.from("0x0000000100000002000000030000000400000005000000060000000700000008"));
    });

    it("should work with negative coordinates", async () => {
      const coords: UnpackedCoords = [
        { x: -1, y: -2 },
        { x: -3, y: -4 },
        { x: -5, y: -6 },
        { x: -7, y: -8 },
      ];

      const packed = packCoords(coords);
      expect(packed).toEqual(BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8"));
    });
  });

  it("unpackCoords should be inverse of packCoords", async () => {
    const rounds: UnpackedCoords[] = [
      [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
      ],
      [
        { x: -1, y: -2 },
        { x: -3, y: -4 },
        { x: -5, y: -6 },
        { x: -7, y: -8 },
      ],
      [
        { x: 13245, y: 745676 },
        { x: 83838272, y: 848823737 },
        { x: -8472666, y: 99827772 },
        { x: 8277, y: -6699483 },
      ],
      [
        { x: 2 ** 31 - 1, y: 2 ** 31 - 1 },
        { x: 2 ** 31 - 1, y: -(2 ** 31) },
        { x: -(2 ** 31), y: 2 ** 31 - 1 },
        { x: -(2 ** 31), y: -(2 ** 31) },
      ],
    ];

    for (const coords of rounds) {
      const packed = packCoords(coords);
      const unpacked = unpackCoords(packed);
      expect(unpacked).toEqual(coords);
    }
  });
  it("packCoords should be inverse of unpackCoords", async () => {
    const rounds = [
      BigNumber.from("0x0100000002000000030000000400000005000000060000000700000008"),
      BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8"),
      BigNumber.from("0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625"),
      BigNumber.from("0x7fffffff7fffffff7fffffff80000000800000007fffffff8000000080000000"),
    ];

    for (const round of rounds) {
      const unpacked = unpackCoords(round);
      const packed = packCoords(unpacked);
      expect(packed).toEqual(round);
    }
  });

  describe("unpackCoordList", () => {
    it("should unpack a list of packed coords", async () => {
      const packedList = [
        "0x0100000002000000030000000400000005000000060000000700000008",
        "0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8",
        "0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625",
        "0x7ffffffe7ffffffe7ffffffe80000000800000007ffffffe8000000080000000",
      ];

      const unpacked = unpackCoordList(packedList);

      expect(unpacked).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
        { x: -1, y: -2 },
        { x: -3, y: -4 },
        { x: -5, y: -6 },
        { x: -7, y: -8 },
        { x: 13245, y: 745676 },
        { x: 83838272, y: 848823737 },
        { x: -8472666, y: 99827772 },
        { x: 8277, y: -6699483 },
        { x: 2 ** 31 - 2, y: 2 ** 31 - 2 },
        { x: 2 ** 31 - 2, y: -(2 ** 31) },
        { x: -(2 ** 31), y: 2 ** 31 - 2 },
        { x: -(2 ** 31), y: -(2 ** 31) },
      ]);
    });
  });

  describe("packCoordList", () => {
    it("should pack a list of coords", () => {
      const coords = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
        { x: 5, y: 6 },
        { x: 7, y: 8 },
        { x: -1, y: -2 },
        { x: -3, y: -4 },
        { x: -5, y: -6 },
        { x: -7, y: -8 },
        { x: 13245, y: 745676 },
        { x: 83838272, y: 848823737 },
        { x: -8472666, y: 99827772 },
        { x: 8277, y: -6699483 },
        { x: 2 ** 31 - 1, y: 2 ** 31 - 1 },
        { x: 2 ** 31 - 1, y: -(2 ** 31) },
        { x: -(2 ** 31), y: 2 ** 31 - 1 },
        { x: -(2 ** 31), y: -(2 ** 31) },
      ];

      const packed = packCoordList(coords);

      expect(packed).toEqual([
        BigNumber.from("0x0100000002000000030000000400000005000000060000000700000008"),
        BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8"),
        BigNumber.from("0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625"),
        BigNumber.from("0x7fffffff7fffffff7fffffff80000000800000007fffffff8000000080000000"),
      ]);
    });

    it("should work with list of coords undivisable by 4", () => {
      const coords = [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ];

      const packed = packCoordList(coords);

      expect(packed).toEqual([BigNumber.from("0x010000000200000003000000047fffffff7fffffff7fffffff7fffffff")]);
    });
  });

  it("unpackCoordList should be inverse of packCoordList", () => {
    const coords = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
      { x: -1, y: -2 },
      { x: -3, y: -4 },
      { x: -5, y: -6 },
      { x: -7, y: -8 },
      { x: 13245, y: 745676 },
      { x: 83838272, y: 848823737 },
      { x: -8472666, y: 99827772 },
      { x: 8277, y: -6699483 },
      { x: 2 ** 31 - 2, y: 2 ** 31 - 2 },
      { x: 2 ** 31 - 1, y: -(2 ** 31) },
      { x: -(2 ** 31), y: 2 ** 31 - 1 },
      { x: -(2 ** 31), y: -(2 ** 31) },
    ];

    const packed = packCoordList(coords);
    const unpacked = unpackCoordList(packed);

    expect(unpacked).toEqual(coords);
  });

  it("should work with coord list not divisable by 4", () => {
    const coords = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
      { x: -1, y: -2 },
      { x: -3, y: -4 },
    ];

    const packed = packCoordList(coords);
    const unpacked = unpackCoordList(packed);

    expect(unpacked).toEqual(coords);
  });

  it("packCoordList should be inverse of unpackCoordList", () => {
    const packed = [
      BigNumber.from("0x0100000002000000030000000400000005000000060000000700000008"),
      BigNumber.from("0xfffffffffffffffefffffffdfffffffcfffffffbfffffffafffffff9fffffff8"),
      BigNumber.from("0x33bd000b60cc04ff4540329805b9ff7eb7a605f3403c00002055ff99c625"),
      BigNumber.from("0x7ffffffe7ffffffe7fffffff80000000800000007fffffff8000000080000000"),
    ];

    const unpacked = unpackCoordList(packed);
    const repacked = packCoordList(unpacked);

    expect(repacked).toEqual(packed);
  });

  describe("coordToId", () => {
    it("should build a uint256 id from a given coord", async () => {
      const coord = { x: 1, y: 2 };
      const id = coordToId(coord);
      expect(id).toEqual(BigNumber.from("0x0000000000000000000000000000000100000000000000000000000000000002"));

      const coord2 = { x: 2 ** 31 - 1, y: 2 ** 31 - 1 };
      const id2 = coordToId(coord2);
      expect(id2).toEqual(BigNumber.from("0x7fffffff0000000000000000000000007fffffff"));
    });

    it("should build a uint256 id from a given negative coord", async () => {
      const coord = { x: -1, y: -2 };
      const id = coordToId(coord);
      expect(id).toEqual(BigNumber.from("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe"));
    });
  });

  describe("idToCoord", () => {
    it("should construct the coord from a given id", async () => {
      const id = "0x0000000000000000000000000000000100000000000000000000000000000002";
      const coord = idToCoord(id);
      expect(coord).toEqual({ x: 1, y: 2 });
    });

    it("should construct the negative coord from a given id", async () => {
      const id = "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe";
      const coord = idToCoord(id);
      expect(coord).toEqual({ x: -1, y: -2 });
    });
  });

  it("idToCoord should be inverse to coordToId", async () => {
    const coords = [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
      { x: 5, y: 6 },
      { x: 7, y: 8 },
      { x: -1, y: -2 },
      { x: -3, y: -4 },
      { x: -5, y: -6 },
      { x: -7, y: -8 },
      { x: 13245, y: 745676 },
      { x: 83838272, y: 848823737 },
      { x: -8472666, y: 99827772 },
      { x: 8277, y: -6699483 },
      { x: 2 ** 31 - 2, y: 2 ** 31 - 2 },
      { x: 2 ** 31 - 1, y: -(2 ** 31) },
      { x: -(2 ** 31), y: 2 ** 31 - 1 },
      { x: -(2 ** 31), y: -(2 ** 31) },
    ];

    for (const coord of coords) {
      const id = coordToId(coord);
      const reconstructedCoord = idToCoord(id);
      expect(reconstructedCoord).toEqual(coord);
    }
  });

  it("coordToId should be inverse to idToCoord", async () => {
    const ids = [
      BigNumber.from("0x0100000000000000000000000000000002"),
      BigNumber.from("0x0300000000000000000000000000000004"),
      BigNumber.from("0x0500000000000000000000000000000006"),
      BigNumber.from("0x0700000000000000000000000000000008"),
      BigNumber.from("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe"),
      BigNumber.from("0xfffffffffffffffffffffffffffffffdfffffffffffffffffffffffffffffffc"),
      BigNumber.from("0xfffffffffffffffffffffffffffffffbfffffffffffffffffffffffffffffffa"),
      BigNumber.from("0xfffffffffffffffffffffffffffffff9fffffffffffffffffffffffffffffff8"),
      BigNumber.from("0x33bd000000000000000000000000000b60cc"),
      BigNumber.from("0x04ff4540000000000000000000000000329805b9"),
      BigNumber.from("0xffffffffffffffffffffffffff7eb7a600000000000000000000000005f3403c"),
      BigNumber.from("0x2055ffffffffffffffffffffffffff99c625"),
      BigNumber.from("0x7fffffff0000000000000000000000007fffffff"),
      BigNumber.from("0x7fffffffffffffffffffffffffffffff80000000"),
      BigNumber.from("0xffffffffffffffffffffffff800000000000000000000000000000007fffffff"),
      BigNumber.from("0xffffffffffffffffffffffff80000000ffffffffffffffffffffffff80000000"),
    ];
    for (const id of ids) {
      const coord = idToCoord(id);
      const reconstructedId = coordToId(coord);
      expect(reconstructedId).toEqual(id);
    }
  });
});
