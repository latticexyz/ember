// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./libraries/LibTypes.sol";
import "./libraries/LibMana.sol";

contract GetterFacet {
    AppStorage internal s;

    // Constants
    function getUniverseBoundaries() external view returns (uint256 maxX, uint256 maxY) {
        maxX = uint256(s.MAX_X);
        maxY = uint256(s.MAX_Y);
    }

    function getGameConstants() external view returns (LibTypes.GameConstants memory constants) {
        constants = s.gameConstants;
    }

    function getConstantTrustedForwarder() external view returns (address trustedForwarder) {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        trustedForwarder = ds.trustedForwarder;
    }

    function getNTiles() external view returns (uint256 number) {
        number = s.tileIds.length;
    }

    function getTile(uint256 id) external view returns (LibTypes.Tile memory tile) {
        tile = s.tiles[id];
    }

    function bulkGetTileIds(uint256 startIdx, uint256 endIdx) public view returns (uint256[] memory ret) {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tileIds[i];
        }
    }

    function bulkGetTilesByIds(uint256[] calldata ids) public view returns (LibTypes.Tile[] memory ret) {
        ret = new LibTypes.Tile[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.tiles[ids[i]];
        }
    }

    function bulkGetTiles(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Tile[] memory ret) {
        ret = new LibTypes.Tile[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tiles[s.tileIds[i]];
        }
    }

    function getNTilesWithHarvestableGroundResources() external view returns (uint256 number) {
        number = s.tilesWithHarvestableGroundResources.length;
    }

    function bulkGetTilesWithHarvestableGroundResources(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tilesWithHarvestableGroundResources[i];
        }
    }

    function bulkGetTileHarvestableGroundResourcesByIds(uint256[] calldata ids)
        public
        view
        returns (LibTypes.HarvestableGroundResources[] memory ret)
    {
        ret = new LibTypes.HarvestableGroundResources[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.tileHarvestableGroundResources[ids[i]];
        }
    }

    function getNRegions() external view returns (uint256 number) {
        number = s.regionIds.length;
    }

    function getRegion(uint256 id) external view returns (LibTypes.Region memory region) {
        region = s.regions[id];
    }

    function bulkGetRegionIds(uint256 startIdx, uint256 endIdx) public view returns (uint256[] memory ret) {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.regionIds[i];
        }
    }

    function bulkGetRegionsByIds(uint256[] calldata ids) public view returns (LibTypes.Region[] memory ret) {
        ret = new LibTypes.Region[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.regions[ids[i]];
        }
    }

    function bulkGetRegions(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Region[] memory ret) {
        ret = new LibTypes.Region[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.regions[s.regionIds[i]];
        }
    }

    function getNPlayers() external view returns (uint256 number) {
        number = s.playerIds.length;
    }

    function getPlayer(address id) external view returns (LibTypes.Player memory player) {
        player = s.players[id];
    }

    function bulkGetPlayerIds(uint256 startIdx, uint256 endIdx) public view returns (address[] memory ret) {
        ret = new address[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.playerIds[i];
        }
    }

    function bulkGetPlayersByIds(address[] calldata ids) public view returns (LibTypes.Player[] memory ret) {
        ret = new LibTypes.Player[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.players[ids[i]];
        }
    }

    function bulkGetPlayers(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Player[] memory ret) {
        ret = new LibTypes.Player[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.players[s.playerIds[i]];
        }
    }

    function getNTilesWithDelayedActions() external view returns (uint256 number) {
        number = s.tilesWithDelayedActions.length;
    }

    function bulkGetTilesWithDelayedActions(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (uint256[] memory ret)
    {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tilesWithDelayedActions[i];
        }
    }

    function bulkGetTileDelayedActionsByTileIds(uint256[] calldata ids)
        public
        view
        returns (LibTypes.TileDelayedAction[] memory ret)
    {
        uint256 counter = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            for (uint256 j = 0; j < s.tileToTileDelayedActions[ids[i]].length; j++) {
                if (
                    block.timestamp - s.tileToTileDelayedActions[ids[i]][j].submittedTimestamp <
                    s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION
                ) {
                    counter++;
                }
            }
        }
        ret = new LibTypes.TileDelayedAction[](counter);
        uint256 currentCounter = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            for (uint256 j = 0; j < s.tileToTileDelayedActions[ids[i]].length; j++) {
                if (
                    block.timestamp - s.tileToTileDelayedActions[ids[i]][j].submittedTimestamp <
                    s.gameConstants.SECONDS_UNTIL_EXPIRED_DELAYED_ACTION
                ) {
                    ret[currentCounter] = s.tileToTileDelayedActions[ids[i]][j];
                    currentCounter++;
                }
            }
        }
    }

    function bulkGetInfluenceDataByRegionIds(uint256[] calldata ids)
        public
        view
        returns (LibTypes.InfluenceData[] memory ret)
    {
        ret = new LibTypes.InfluenceData[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.influenceDataInRegion[ids[i]];
        }
    }

    function bulkGetCreaturesByIds(uint256[] calldata ids) public view returns (LibTypes.Creature[] memory ret) {
        ret = new LibTypes.Creature[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.creatures[ids[i]];
        }
    }

    function getNSettlements() external view returns (uint256 number) {
        number = s.settlementIds.length;
    }

    function getSettlement(uint256 id) external view returns (LibTypes.Settlement memory settlement) {
        settlement = s.settlements[id];
    }

    function bulkGetSettlementIds(uint256 startIdx, uint256 endIdx) public view returns (uint256[] memory ret) {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.settlementIds[i];
        }
    }

    function bulkGetSettlementByIds(uint256[] calldata ids) public view returns (LibTypes.Settlement[] memory ret) {
        ret = new LibTypes.Settlement[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.settlements[ids[i]];
        }
    }

    function bulkGetSettlements(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (LibTypes.Settlement[] memory ret)
    {
        ret = new LibTypes.Settlement[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.settlements[s.settlementIds[i]];
        }
    }
}
