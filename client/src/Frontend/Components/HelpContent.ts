export interface IHelpCard {
  title: string;
  desc: string;
}

export const HelpContent: IHelpCard[] = [
  {
    title: "How to win",
    desc: "Win by having the largest dungeon area after a round.",
  },
  {
    title: "Mining tiles",
    desc: "Click and drag to select an area of rock tiles, then press E",
  },
  {
    title: "Claiming tiles",
    desc: "Click and drag to select an area of claimed tiles, then press E",
  },
  {
    title: "Moving the camera",
    desc: "Use WASD to move the camera",
  },
  {
    title: "Strategic view",
    desc: "Hold down SPACE to enter Strategic View",
  },
  {
    title: "Gold Resources",
    desc: "Gold is used to create upgrades and spawn creatures. Mining 1 gold block gives you 20 gold.",
  },
  {
    title: "Soul Resources",
    desc: "Souls are used to spawn creatures",
  },
  {
    title: "Influence",
    desc: "Colored walls outline the set of regions a player controls. Mining and claiming is only possible next to controlled regions.",
  },
];
