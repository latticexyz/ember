import { EthAddress } from "../../_types/GlobalTypes";

export const GAME_UI_CLASSNAME = "zk-game-ui";

export function isOverGameUI() {
  return document.querySelectorAll(`.${GAME_UI_CLASSNAME}:hover`).length > 0;
}

export function getIndexFromEthAddress(address: EthAddress, maxIndex: number): number {
  const randSeed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values
  function seedRand(seed: string) {
    for (var i = 0; i < randSeed.length; i++) {
      randSeed[i] = 0;
    }
    for (var i = 0; i < seed.length; i++) {
      randSeed[i % 4] = (randSeed[i % 4] << 5) - randSeed[i % 4] + seed.charCodeAt(i);
    }
  }

  function rand() {
    const t = randSeed[0] ^ (randSeed[0] << 11);

    randSeed[0] = randSeed[1];
    randSeed[1] = randSeed[2];
    randSeed[2] = randSeed[3];
    randSeed[3] = randSeed[3] ^ (randSeed[3] >> 19) ^ t ^ (t >> 8);
    return (randSeed[3] >>> 0) / ((1 << 31) >>> 0);
  }

  seedRand(address);
  return Math.floor(rand() * (maxIndex + 1));
}

export function pad(num: number, size: number) {
  var s = "0000000" + num;
  return s.substr(s.length - size);
}

export function padWithWhitespace(num: number, size: number) {
  var s = "       " + num;
  return s.substr(s.length - size);
}
