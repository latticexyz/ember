import { ethers } from "ethers";
import { EthAddress } from "../../_types/GlobalTypes";

export function rgbToHex(r: number, g: number, b: number): number {
  const hexString = [r, g, b]
    .map((n) => {
      const hex = n.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");
  return parseInt(hexString, 16);
}

export function getColorFromEthAddress(address: EthAddress): Phaser.Display.Color {
  if (!address) return Phaser.Display.Color.IntegerToColor(0);
  if (address === ethers.constants.AddressZero) return Phaser.Display.Color.HSLToColor(0, 0, 0.01);
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

  function createColor() {
    // hue is the whole color spectrum
    const h = Math.floor(rand() * 360) / 360;
    //saturation goes from 40 to 100, it avoids greyish colors
    // --> Multiply by 0.75 to limit saturation
    const s = ((rand() * 60 + 40) / 100) * 0.75;
    // lightness can be anything from 0 to 100, but probabilities are a bell curve around 50%
    // --> Multiply by 0.75 to shift
    const l = (((rand() + rand() + rand() + rand()) * 25) / 100) * 0.65;
    return { h, s, l };
  }
  seedRand(address);
  const { h, s, l } = createColor();
  return Phaser.Display.Color.HSLToColor(h, s, l);
}

// export function rgbStringToPhaserColor(rgb: string) {
//   if (rgb.substr(0, 5) != "rgba(") {
//     throw new Error("invalid rgba string");
//   }

//   const colors = rgb
//     .substring(5, rgb.length - 1)
//     .replaceAll(" ", "")
//     .split(",")
//     .map((s) => Number(s));

//   return new Phaser.Display.Color(colors[0], colors[1], colors[2], colors[3]);
// }
