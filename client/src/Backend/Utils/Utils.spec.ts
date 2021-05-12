import { WorldCoord } from "../../_types/GlobalTypes";
import { getPermutationIterator, getNestedPermutationIterator, manhattan, _checkConnection } from "./Utils";

describe("getPermutationIterator", () => {
  it("should return an iterator over all permutations of the given array", () => {
    const array = [0, 1, 2];
    const result = Array.from(getPermutationIterator(array));
    expect(result).toEqual([
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]);
  });
});

describe("getNestedPermutationIterator", () => {
  it("should return an iterator over all iterations of the arrays of the given nested array 1", () => {
    const array = [
      [0, 1],
      [2, 3],
    ];
    const result = Array.from(getNestedPermutationIterator(array));
    console.log(result);
    expect(result).toEqual([
      [0, 1, 2, 3],
      [1, 0, 2, 3],
      [0, 1, 3, 2],
      [1, 0, 3, 2],
    ]);
  });

  it("should return an iterator over all iterations of the arrays of the given nested array 2", () => {
    const array = [
      [0, 1],
      [2, 3],
      [4, 5],
    ];
    const result = Array.from(getNestedPermutationIterator(array));
    console.log(result);
    expect(result).toEqual([
      [0, 1, 2, 3, 4, 5],
      [1, 0, 2, 3, 4, 5],
      [0, 1, 3, 2, 4, 5],
      [1, 0, 3, 2, 4, 5],
      [0, 1, 2, 3, 5, 4],
      [1, 0, 2, 3, 5, 4],
      [0, 1, 3, 2, 5, 4],
      [1, 0, 3, 2, 5, 4],
    ]);
  });

  it("should return an iterator over all iterations of the arrays of the given nested array 3", () => {
    const array = [
      [0, 1, 2],
      [3, 4, 5],
    ];
    const result = Array.from(getNestedPermutationIterator(array));
    expect(result).toEqual([
      [0, 1, 2, 3, 4, 5],
      [0, 2, 1, 3, 4, 5],
      [1, 0, 2, 3, 4, 5],
      [1, 2, 0, 3, 4, 5],
      [2, 0, 1, 3, 4, 5],
      [2, 1, 0, 3, 4, 5],
      [0, 1, 2, 3, 5, 4],
      [0, 2, 1, 3, 5, 4],
      [1, 0, 2, 3, 5, 4],
      [1, 2, 0, 3, 5, 4],
      [2, 0, 1, 3, 5, 4],
      [2, 1, 0, 3, 5, 4],
      [0, 1, 2, 4, 3, 5],
      [0, 2, 1, 4, 3, 5],
      [1, 0, 2, 4, 3, 5],
      [1, 2, 0, 4, 3, 5],
      [2, 0, 1, 4, 3, 5],
      [2, 1, 0, 4, 3, 5],
      [0, 1, 2, 4, 5, 3],
      [0, 2, 1, 4, 5, 3],
      [1, 0, 2, 4, 5, 3],
      [1, 2, 0, 4, 5, 3],
      [2, 0, 1, 4, 5, 3],
      [2, 1, 0, 4, 5, 3],
      [0, 1, 2, 5, 3, 4],
      [0, 2, 1, 5, 3, 4],
      [1, 0, 2, 5, 3, 4],
      [1, 2, 0, 5, 3, 4],
      [2, 0, 1, 5, 3, 4],
      [2, 1, 0, 5, 3, 4],
      [0, 1, 2, 5, 4, 3],
      [0, 2, 1, 5, 4, 3],
      [1, 0, 2, 5, 4, 3],
      [1, 2, 0, 5, 4, 3],
      [2, 0, 1, 5, 4, 3],
      [2, 1, 0, 5, 4, 3],
    ]);
  });
});

describe("Alvarius' algorithm", () => {
  it("Should compute the correct thing", () => {
    const coords = [
      {
        x: -15,
        y: -4,
      },
      {
        x: -14,
        y: -4,
      },
      {
        x: -16,
        y: -4,
      },
      {
        x: -13,
        y: -4,
      },
    ];
    const tilesToVisit = _checkConnection(coords);
    expect(tilesToVisit).toBe(0);
  });
});
