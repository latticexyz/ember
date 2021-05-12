import { BigNumber } from "ethers";

// TODO: Move the global types and decoder into packages
export enum CreatureSpecies {
  BALANCED,
}

export enum CreatureType {
  NORMAL,
  RED,
  BLUE,
  BLACK,
  UNIQUE,
}

export enum CombatWinner {
  SQUAD1,
  SQUAD2,
  DRAW,
}

interface Creature {
  species: CreatureSpecies;
  creatureType: CreatureType;
  level: number;
  life: number;
}

function CreatureFromContractData({
  species,
  creatureType,
  level,
  life,
}: {
  species: CreatureSpecies;
  creatureType: CreatureType;
  level: BigNumber;
  life: BigNumber;
  owner: string;
  tileId: BigNumber;
}): Creature {
  return {
    species,
    creatureType,
    level: level.toNumber(),
    life: life.toNumber(),
  };
}

export type CombatTrace = RoundTrace[];

export interface RoundTrace {
  // squad2 attacks first
  squad2Trace: HalfRoundTrace;
  squad1Trace: HalfRoundTrace;
}

export type HalfRoundTrace = CombatAtomicTrace[];

export interface CombatAtomicTrace {
  initiator: number;
  targets: Target[];
  damage: number;
  multipliers: {
    strength: number;
    group: number;
  };
  newTargetStates: NewTargetState[];
}

export interface Target {
  squadIndex: number;
  squad: number; // 0 or 1
}

export enum StatusEffect {
  STUNT,
  // we can add things later
}

export interface NewTargetState {
  target: Target;
  newLife: number;
  newStatusEffects: StatusEffect[];
}

export interface UnparsedCombatAtomicTrace {
  initiator: number;
  target: number;
  damage: number;
  strengthMultiplier: number;
  groupMultiplier: number;
}

function parseRoundAndGetNewState(
  previousSquad1: Creature[],
  previousSquad2: Creature[],
  { squad1Trace, squad2Trace }: { squad1Trace: UnparsedCombatAtomicTrace[]; squad2Trace: UnparsedCombatAtomicTrace[] }
): { trace: RoundTrace; newSquad1: Creature[]; newSquad2: Creature[] } {
  const newSquad1 = [...previousSquad1];
  const newSquad2 = [...previousSquad2];
  const parsedSquad1Trace: HalfRoundTrace = [];
  const parsedSquad2Trace: HalfRoundTrace = [];
  // TODO: remove the insane redundancy here. factor creating an atomic combat trace + changing state into a function
  // execute squad 2 trace:
  for (const t of squad2Trace) {
    const target: Target = {
      squad: 0,
      squadIndex: t.target,
    };
    // update the state of the target
    newSquad1[t.target].life = newSquad1[t.target].life - t.damage;
    // add the trace
    const atomicTrace: CombatAtomicTrace = {
      damage: t.damage,
      initiator: t.initiator,
      targets: [target],
      multipliers: {
        group: t.groupMultiplier,
        strength: t.strengthMultiplier,
      },
      newTargetStates: [
        {
          newLife: newSquad1[t.target].life,
          newStatusEffects: [],
          target,
        },
      ],
    };
    parsedSquad2Trace.push(atomicTrace);
  }
  for (const t of squad1Trace) {
    const target: Target = {
      squad: 1,
      squadIndex: t.target,
    };
    // update the state of the target
    newSquad2[t.target].life = newSquad2[t.target].life - t.damage;
    // add the trace
    const atomicTrace: CombatAtomicTrace = {
      damage: t.damage,
      initiator: t.initiator,
      targets: [target],
      multipliers: {
        group: t.groupMultiplier,
        strength: t.strengthMultiplier,
      },
      newTargetStates: [
        {
          newLife: newSquad2[t.target].life,
          newStatusEffects: [],
          target,
        },
      ],
    };
    parsedSquad1Trace.push(atomicTrace);
  }
  return {
    newSquad1,
    newSquad2,
    trace: {
      squad1Trace: parsedSquad1Trace,
      squad2Trace: parsedSquad2Trace,
    },
  };
}

export function parseCombatLog(_squad1: any, _squad2: any, _trace: any[]): CombatTrace {
  let squad1: Creature[] = _squad1.map((s: any) => CreatureFromContractData(s));
  let squad2: Creature[] = _squad2.map((s: any) => CreatureFromContractData(s));
  const combatTrace: CombatTrace = [];
  for (const [_, r] of _trace.entries()) {
    const { trace, newSquad1, newSquad2 } = parseRoundAndGetNewState(squad1, squad2, r);
    squad1 = newSquad1;
    squad2 = newSquad2;
    combatTrace.push(trace);
  }
  return combatTrace;
}
