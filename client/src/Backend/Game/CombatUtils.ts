import { CombatAtomicTrace, CombatTrace, HalfRoundTrace, RoundTrace } from "@latticexyz/ember-combat";
import { Creature, EthAddress } from "../../_types/GlobalTypes";
import { creatureSpeciesToName, creatureTypeToName } from "./Naming";

export function renderCombatTrace(
  squad1: Creature[],
  squad2: Creature[],
  trace: CombatTrace,
  player: EthAddress
): string[] {
  const out: string[] = [];
  for (const [i, r] of trace.entries()) {
    out.push(`Round ${i + 1}`);
    out.push(...renderHalfRoundTrace(squad2, squad1, r.squad2Trace, player));
    out.push(...renderHalfRoundTrace(squad1, squad2, r.squad1Trace, player));
  }
  out.push(...["End of the combat"]);
  return out;
}

function renderHalfRoundTrace(
  attackers: Creature[],
  defenders: Creature[],
  halfRoundTrace: HalfRoundTrace,
  player: EthAddress
): string[] {
  return halfRoundTrace.map((at) => renderAtomicTrace(attackers, defenders, at, player)).flat();
}

function renderAtomicTrace(
  attackers: Creature[],
  defenders: Creature[],
  atomicTrace: CombatAtomicTrace,
  player: EthAddress
): string[] {
  const attacker = attackers[atomicTrace.initiator];
  // TODO: make it work with multiple targets
  const defender = defenders[atomicTrace.targets[0].squadIndex];
  const sentence1 = [
    getCreatureArticle(attacker, player),
    renderCreatureName(attacker),
    "attacks",
    getCreatureArticle(defender, player),
    renderCreatureName(defender),
    "and deals",
    atomicTrace.damage.toString(),
    "damage",
  ];
  const sentence2: string[] = [];
  if (atomicTrace.newTargetStates[0].newLife == 0) {
    sentence2.push(...[getCreatureArticle(defender, player, "the"), renderCreatureName(defender), "dies"]);
  } else {
    sentence2.push(
      ...[
        getCreatureArticle(defender, player, "the"),
        renderCreatureName(defender),
        "is left with",
        atomicTrace.newTargetStates[0].newLife.toString(),
        "life points",
      ]
    );
  }
  return [joinAndCapitalize(sentence1), joinAndCapitalize(sentence2)];
}

function renderCreatureName(c: Creature): string {
  return `${creatureTypeToName[c.creatureType]} ${creatureSpeciesToName[c.species]}`;
}

function getCreatureArticle(c: Creature, player: EthAddress, foreignArticle = "a"): string {
  const determinant = c.owner === player ? "your" : "a";
  return determinant;
}

function joinAndCapitalize(sentence: string[]): string {
  const joined = sentence.join(" ");
  return joined.slice(0, 1).toUpperCase() + joined.slice(1);
}
