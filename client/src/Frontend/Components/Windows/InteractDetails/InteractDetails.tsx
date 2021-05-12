import { useUIState } from "../../../Hooks/useUIState";
import { useGameManager } from "../../../Hooks/useGameManager";
import React, { useState, useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { getRegionDetails } from "./Utils/getRegionDetails";
import { getTileDetails } from "./Utils/getTileDetails";
import { InteractType } from "../../../UIManager";
import { getResourceDetails } from "./Utils/getResourceDetails";
import { getHarvestableGroundResourcesDetails } from "./Utils/getHarvestableGroundResourcesDetails";
import { getUpgradeDetailsAndActions } from "./Utils/getUpgradeDetailsAndActions";
import { CreatureSpecies, Resource, TileUpgrade } from "../../../../_types/ContractTypes";
import { ResourceType } from "../../../../_types/GlobalTypes";
import { DungeonHeartPanel } from "./Components/DungeonHeartPanel";
import { DetailsList } from "../../Common/DetailsList";
import { InfoModal } from "../../Common/InfoModal";
import { observer } from "mobx-react-lite";
import { chebyshev, tileCoordToRegionCoord, tilesInRegion } from "../../../../Backend/Utils/Utils";
import { REGION_LENGTH } from "../../../../Backend/Utils/Defaults";

export const InteractDetails: React.FC = observer(() => {
  const uiState = useUIState();
  const gm = useGameManager();

  const [moreDetails, setMoreDetails] = useState(false);

  const { title, details, actions } = useMemo(() => {
    if (!gm) return { undefined };

    const nq = gm.services.nameQueue;

    const data = uiState.interactData;
    const numSelectedTiles = data.selectedCoords.length;

    // We need to pass unobfuscated dungeon and take changing data like influence from there instead the fixed UIState.interactData
    const regionDetails = data.region ? getRegionDetails(data, gm.extendedDungeon, nq) : [];
    const tileDetails = data.tile ? getTileDetails(data, gm.extendedDungeon, nq) : [];

    const resourceDetails = data.type === InteractType.Resource ? getResourceDetails(data) : [];

    const harvestableGroundResourcesDetails =
      data.type === InteractType.HarvestableGroundResources ? getHarvestableGroundResourcesDetails(data) : [];

    const {
      details: upgradeDetails = [],
      actions: upgradeActions = [],
      hiddenDetails: hiddenUpgradeDetails = [],
    } = data.type === InteractType.Upgrade ? getUpgradeDetailsAndActions(data) : {};

    const getTitle = () => {
      if (data.type === InteractType.Upgrade) {
        if (data.subtype === TileUpgrade.GOLD_GENERATOR) {
          return `Gold Generator${numSelectedTiles > 1 ? " Field" : ""}`;
        }
        if (data.subtype === TileUpgrade.GOLD_STORAGE) {
          return `Gold ${numSelectedTiles > 1 ? "Treasury" : "Chest"}`;
        }
        if (data.subtype === TileUpgrade.SOUL_GENERATOR) {
          return `Soul Extractor${numSelectedTiles > 1 ? " Field" : ""}`;
        }
        if (data.subtype === TileUpgrade.SOUL_STORAGE) {
          return `Soul ${numSelectedTiles > 1 ? "Treasury" : "Chest"}`;
        }
        if (data.subtype === TileUpgrade.LAIR) {
          return `Lair${numSelectedTiles > 1 ? "s" : ""}`;
        }
        if (data.subtype === TileUpgrade.TRAINING_ROOM) {
          return `Training Room${numSelectedTiles > 1 ? "s" : ""}`;
        }
        if (data.subtype === TileUpgrade.DUNGEON_HEART) {
          return "Dungeon Heart";
        }
      }

      if (data.type === InteractType.Resource) {
        if (data.subtype === ResourceType.Gold) {
          return `Gold ${numSelectedTiles > 1 ? "vein" : "block"}`;
        }
        if (data.subtype === ResourceType.Soul) {
          return `Soul ${numSelectedTiles > 1 ? "vein" : "block"}`;
        }
      }

      if (data.type === InteractType.HarvestableGroundResources) {
        if (data.subtype.souls) {
          return `Soul ${numSelectedTiles > 1 ? "pit" : "pit"}`;
        }
      }

      if (numSelectedTiles === 1) {
        return "Tile";
      }

      return "Region";
    };

    const getDetails = () => {
      const generalDetails = numSelectedTiles > 1 ? regionDetails : [...tileDetails, ...regionDetails];

      if (data.type === InteractType.Upgrade) {
        return moreDetails ? [...upgradeDetails, ...hiddenUpgradeDetails, ...generalDetails] : upgradeDetails;
      }

      if (data.type === InteractType.Resource) {
        return [...resourceDetails, ...generalDetails];
      }

      if (data.type === InteractType.HarvestableGroundResources) {
        return [...harvestableGroundResourcesDetails, ...generalDetails];
      }

      return generalDetails;
    };

    const getActions = () => {
      const moreDetailsAction = {
        title: moreDetails ? "Hide Details" : "Details",
        onClick: () => {
          setMoreDetails(!moreDetails);
        },
      };
      if (data.type === InteractType.Upgrade) {
        const { controller, disputed } = gm.extendedDungeon.getRegionController(
          tileCoordToRegionCoord(data.selectedCoords[0])
        );
        const removeUpgradesAction = {
          title: data.selectedCoords.length > 1 ? "🗑️" : "🗑️",
          onClick: () => {
            if (confirm("Remove upgrade(s)?")) {
              for (const c of data.selectedCoords) {
                gm.removeUpgrade(c);
              }
            }
          },
        };
        const isDungeonHeart =
          gm.extendedDungeon.getTileAt(data.selectedCoords[0]).upgrade === TileUpgrade.DUNGEON_HEART;
        return [
          moreDetailsAction,
          ...upgradeActions,
          ...(!isDungeonHeart && controller === gm.address && !disputed ? [removeUpgradesAction] : []),
        ];
      }
      if (data.type === InteractType.Generic && data.tile?.isWalled) {
        const removeWallAction = {
          title: "Remove Wall",
          onClick: () => {
            gm.removeWall(data.selectedCoords[0]);
          },
        };
        return [removeWallAction];
      }
      if (data.type === InteractType.Generic && data.region && numSelectedTiles > 1) {
        const regionActions: {
          title: string;
          subtitle?: React.ReactChild;
          onClick?: () => void;
        }[] = [];
        const { controller, disputed } = gm.extendedDungeon.getRegionController(data.region.coord);
        if ((data.region.gold > 0 || data.region.souls > 0) && controller === gm.address && !disputed) {
          regionActions.push({
            title: "Claim resources",
            onClick: () => {
              if (data.region) {
                gm.claimResourcesOnRegion(data.region.coord);
              }
            },
          });
        }
        const creaturesInRegion = gm.extendedDungeon.getCreaturesInRegion(data.region.coord);
        const ts = tilesInRegion(data.region.coord);
        const centerTilesAreMined =
          ts.filter((t) => {
            const { x, y } = t;
            const i = x - data.region!.coord.x * REGION_LENGTH;
            const j = y - data.region!.coord.y * REGION_LENGTH;
            if (
              (i == REGION_LENGTH / 2 || i == REGION_LENGTH / 2 - 1) &&
              (j == REGION_LENGTH / 2 || j == REGION_LENGTH / 2 - 1)
            ) {
              return (
                gm.extendedDungeon.getTileAt(t).isMined && gm.extendedDungeon.getTileAt(t).upgrade === TileUpgrade.NONE
              );
            } else {
              return false;
            }
          }).length === 4;
        const numberOfSettlementsOwnedByPlayer = [...gm.extendedDungeon.settlements.values()].filter(
          (s) => s.owner === gm.address
        ).length;
        const priceIncrease =
          gm.constants.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT[numberOfSettlementsOwnedByPlayer - 1] /
          100;
        const goldCost = Math.floor(
          priceIncrease * gm.constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[0][Resource.GOLD]
        );
        const soulCost = Math.floor(
          priceIncrease * gm.constants.gameConstants.SETTLEMENT_PRICE_PER_LEVEL[0][Resource.SOULS]
        );
        const MAX_NUMBER_OF_SETTLEMENTS = gm.constants.gameConstants.SETTLEMENT_PRICE_PERCENT_INCREASE_PER_UNIT.length;
        const notTooManySettlements = numberOfSettlementsOwnedByPlayer < MAX_NUMBER_OF_SETTLEMENTS;
        const settlementsTooClose =
          gm.extendedDungeon.settlements.coords().filter((c) => chebyshev(c, data.region!.coord) <= 2).length > 0;
        if (
          creaturesInRegion.find((c) => c.species === CreatureSpecies.HERO && c.owner === gm.address) &&
          !settlementsTooClose
        ) {
          regionActions.push({
            title: `Create settlement (${goldCost} gold and ${soulCost} souls) ${
              !centerTilesAreMined ? "⚠ Need to mine the 4 center tiles" : ""
            } ${!notTooManySettlements ? "⚠ Too many settlements!" : ""}`,
            onClick:
              centerTilesAreMined && notTooManySettlements
                ? () => {
                    if (data.region) {
                      gm.createSettlement(data.region.coord);
                    }
                  }
                : undefined,
          });
        }
        return regionActions;
      }
      return [];
    };

    return {
      title: getTitle(),
      details: getDetails(),
      actions: getActions(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState.interactData, moreDetails, gm?.net.blockNumber, gm?.net.syncedBlockNumber, gm?.net.predictedChainTime]);

  const body = useMemo(() => {
    const data = uiState.interactData;
    const components: React.ReactChild[] = [];

    if (data.type === InteractType.Upgrade && data.subtype === TileUpgrade.DUNGEON_HEART) {
      components.push(<DungeonHeartPanel data={data} key={"dungeon-heart-panel"} />);
    }

    if (details) {
      components.push(<DetailsList details={details} key={"details-list"} />);
    }

    if (data.type === InteractType.Upgrade && data.subtype === TileUpgrade.DUNGEON_HEART && details) {
      return (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <DungeonHeartPanel data={data} key={"dungeon-heart-panel"} />
          <DetailsList details={details} key={"details-list"} />
        </div>
      );
    }

    return <>{components}</>;
  }, [details, uiState.interactData]);

  const modal = useMemo(() => {
    if (!title) return null;

    if (uiState.interactData.type !== InteractType.Empty) {
      return <InfoModal title={title} body={body} actions={actions} />;
    }
    return null;
  }, [uiState.interactData.type, title, body, actions]);

  return modal;
});
