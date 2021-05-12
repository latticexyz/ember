import React, { useMemo } from "react";
import { useGameManager } from "../Hooks/useGameManager";
import { Icon, RegularText, ToastText } from "./InputStatusToast";
import { claimResources } from "../../Assets/tools";
import { observer } from "mobx-react-lite";
import { useSelectionManager } from "../Hooks/useSelectionManager";
import { ButtonWrapper, Button } from "./Common/SkeuomorphicButton";

enum ClaimType {
  ImmediateClaim,
  NeedSpace,
  Uncontrolled,
}

export const DroppedResources = observer(() => {
  const gm = useGameManager();
  const selectionManager = useSelectionManager();
  const firstSelectedRegion = selectionManager?.firstSelectedRegion

  const controller = gm?.extendedDungeon.getRegionController(firstSelectedRegion!).controller;
  const disputed = gm?.extendedDungeon.getRegionController(firstSelectedRegion!).disputed;
  const region = gm?.extendedDungeon.regions.get(firstSelectedRegion!);

  const hasRegionResources = useMemo(() => {
    if (!selectionManager) return false;
    if (!gm) return false;

    const { firstSelectedRegion } = selectionManager;
    if (!firstSelectedRegion) return false;

    const reg = gm.extendedDungeon.regions.get(firstSelectedRegion);
    if (reg) {
      return reg.souls > 0 || reg.gold > 0;
    }
    return false;
  }, [gm && gm.net.blockNumber]);

  const claimData = useMemo(() => {
    if (!selectionManager) return null;
    if (!gm) return null;

    const player = gm.extendedDungeon.players.get(gm.address);
    if (player && region) {
      const regionHasGold = region.gold > 0;
      const regionHasSouls = region.souls > 0;
      const hasGoldSpace = player.gold < player.maxGold;
      const hasSoulSpace = player.souls < player.maxSouls;
      const needsGoldSpace = regionHasGold && !hasGoldSpace;
      const needsSoulSpace = regionHasSouls && !hasSoulSpace;
      const controlsRegion = !disputed && controller === gm.address;
      if ((regionHasGold || regionHasSouls) && controlsRegion) {
        if (needsGoldSpace || needsSoulSpace) {
          return {
            type: ClaimType.NeedSpace,
            gold: region.gold,
            souls: region.souls,
          };
        } else {
          return {
            type: ClaimType.ImmediateClaim,
            gold: region.gold,
            souls: region.souls,
          };
        }
      }
      if ((regionHasGold || regionHasSouls) && !controlsRegion) {
        return {
          type: ClaimType.Uncontrolled,
          gold: region.gold,
          souls: region.souls,
        };
      }
    }
  }, [region, controller, gm && gm.net.blockNumber]);

  if (!hasRegionResources || !claimData) return null;
  if (claimData.type === ClaimType.ImmediateClaim) {
    return (
      <ButtonWrapper row={false}>
        <Button className="toast-content" onClick={() => gm?.claimResourcesOnRegion(firstSelectedRegion!)}>
          <Icon src={claimResources} />
          <ToastText>
            {`Claim ${claimData.gold > 0 ? claimData.gold + " gold" : ""} ${claimData.souls > 0 ? claimData.souls + " souls" : ""
              }`}
          </ToastText>
        </Button>
      </ButtonWrapper>
    );
  } else if (claimData.type === ClaimType.NeedSpace) {
    return (
      <div>
        {claimData.gold > 0 && (
          <RegularText
            style={{ paddingBottom: "8px" }}
          >{`Build more storage to collect ${claimData.gold} excess gold`}</RegularText>
        )}
        {claimData.souls > 0 && (
          <RegularText>{`Build more storage to collect ${claimData.souls} excess souls`}</RegularText>
        )}
      </div>
    );
  } else if (claimData.type === ClaimType.Uncontrolled) {
    return (
      <div>
        {claimData.gold > 0 && (
          <RegularText
            style={{ paddingBottom: "8px" }}
          >{`Control this region to collect ${claimData.gold} gold`}</RegularText>
        )}
        {claimData.souls > 0 && <RegularText>{`Control this region to collect ${claimData.souls} souls`}</RegularText>}
      </div>
    );
  } else {
    return null;
  }
});
