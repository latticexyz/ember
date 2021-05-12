// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./libraries/LibAppStorage.sol";
import "./libraries/LibDiamond.sol";
import "./libraries/LibTypes.sol";
import "./libraries/LibMana.sol";

/// @title Getter Facet
/// @notice EIP-2535 Facet for Getters used to access various data in Ember.
contract GetterFacet {
    AppStorage internal s;

    /*///////////////////////////////////////////////////////////////
                            CONSTANTS GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the boundaries of the universe as coordinates.
    /// @return maxX The maximum x coordinate of the universe,
    /// maxY The maximum y coordinate of the universe.
    function getUniverseBoundaries() external view returns (uint256 maxX, uint256 maxY) {
        maxX = uint256(s.MAX_X);
        maxY = uint256(s.MAX_Y);
    }

    /// @notice Returns the LibTypes.GameConstants of this instance of Ember.
    /// @return constants The LibTypes.GameConstants of this instance of Ember.
    function getGameConstants() external view returns (LibTypes.GameConstants memory constants) {
        constants = s.gameConstants;
    }

    /// @notice Retuns the trusted forwarder
    /// @return trustedForwarder the GSN trusted forwarder
    function getConstantTrustedForwarder() external view returns (address trustedForwarder) {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        trustedForwarder = ds.trustedForwarder;
    }

    /*///////////////////////////////////////////////////////////////
                            TILE GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the number of tiles in the universe.
    /// @return number Number of tiles in the universe.
    function getNTiles() external view returns (uint256 number) {
        number = s.tileIds.length;
    }

    /// @notice Returns the LibTypes.Tile of the tile id given in the parameter.
    /// @param id The id of the tile to get.
    /// @return tile The LibTypes.Tile of the tile id given in the parameter.
    function getTile(uint256 id) external view returns (LibTypes.Tile memory tile) {
        tile = s.tiles[id];
    }

    /// @notice Returns tile ids from a given start and end index.
    /// @param startIdx The start index of the tile ids to get.
    /// @param endIdx The end index of the tile ids to get.
    /// @return ret The tile ids from the given start and end index.
    function bulkGetTileIds(uint256 startIdx, uint256 endIdx) public view returns (uint256[] memory ret) {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tileIds[i];
        }
    }

    /// @notice Returns an array of type LibTypes.Tile[] of tiles matching the tile ids given in the parameter.
    /// @param ids The tiles to get.
    /// @return ret The array of type LibTypes.Tile[] of tiles matching the tile ids given in the parameter.
    function bulkGetTilesByIds(uint256[] calldata ids) public view returns (LibTypes.Tile[] memory ret) {
        ret = new LibTypes.Tile[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.tiles[ids[i]];
        }
    }

    /// @notice Returns an array of type LibTypes.Tile[] of tiles from a given start and end index.
    /// @param startIdx The start index of the tiles to get.
    /// @param endIdx The end index of the tiles to get.
    /// @return ret The array of type LibTypes.Tile[] of tiles from a given start and end index.
    function bulkGetTiles(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Tile[] memory ret) {
        ret = new LibTypes.Tile[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.tiles[s.tileIds[i]];
        }
    }

    /// @notice Returns the number of tiles with harvestable ground resources.
    /// @return number Number of tiles with harvestable ground resources.
    function getNTilesWithHarvestableGroundResources() external view returns (uint256 number) {
        number = s.tilesWithHarvestableGroundResources.length;
    }

    /// @notice Returns the tile ids of tiles with harvestable ground resources
    /// from the given start index to an end index.
    /// @param startIdx The start index of the tile ids to get.
    /// @param endIdx The end index of the tile ids to get.
    /// @return ret The tile ids of tiles with harvestable ground resources from startIdx to endIdx.
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

    /// @notice Returns an harvestable ground resource tiles in an array of type
    /// LibTypes.HarvestableTile[] given an array of tile ids.
    /// @param ids The tile ids to get.
    /// @return ret The array of type LibTypes.HarvestableTile[] of harvestable ground resource tiles.
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

    /*///////////////////////////////////////////////////////////////
                            REGION GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the number of regions in the universe.
    /// @return number Number of regions in the universe.
    function getNRegions() external view returns (uint256 number) {
        number = s.regionIds.length;
    }

    /// @notice Returns the LibTypes.Region of the region id given in the parameter.
    /// @param id The id of the region to get.
    /// @return region The LibTypes.Region of the region id given in the parameter.
    function getRegion(uint256 id) external view returns (LibTypes.Region memory region) {
        region = s.regions[id];
    }

    /// @notice Returns region ids from a given start and end index.
    /// @param startIdx The start index of the region ids to get.
    /// @param endIdx The end index of the region ids to get.
    /// @return ret The region ids from the given start and end index.
    function bulkGetRegionIds(uint256 startIdx, uint256 endIdx) public view returns (uint256[] memory ret) {
        ret = new uint256[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.regionIds[i];
        }
    }

    /// @notice Returns an array of type LibTypes.Region[] of regions matching the region ids given in the parameter.
    /// @param ids The regions to get.
    /// @return ret The array of type LibTypes.Region[] of regions matching the region ids given in the parameter.
    function bulkGetRegionsByIds(uint256[] calldata ids) public view returns (LibTypes.Region[] memory ret) {
        ret = new LibTypes.Region[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.regions[ids[i]];
        }
    }

    /// @notice Returns an array of type LibTypes.Region[] of regions matching the given start and end index.
    /// @param startIdx The start index of the regions to get.
    /// @param endIdx The end index of the regions to get.
    /// @return ret The array of type LibTypes.Region[] of regions matching the given start and end index.
    function bulkGetRegions(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Region[] memory ret) {
        ret = new LibTypes.Region[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.regions[s.regionIds[i]];
        }
    }

    /*///////////////////////////////////////////////////////////////
                            PLAYER GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the number of players in the universe.
    /// @return number Number of players in the universe.
    function getNPlayers() external view returns (uint256 number) {
        number = s.playerIds.length;
    }

    /// @notice Returns the LibTypes.Player matching the address given in the parameter.
    /// @param id The address of the player to get.
    /// @return player The LibTypes.Player matching the address given in the parameter.
    function getPlayer(address id) external view returns (LibTypes.Player memory player) {
        player = s.players[id];
    }

    /// @notice Returns an array of player addresses matching the given start and end index of player ids.
    /// @param startIdx The start index of the player addresses to get.
    /// @param endIdx The end index of the player addresses to get.
    /// @return ret The array of player addresses matching the given start and end index of player ids.
    function bulkGetPlayerIds(uint256 startIdx, uint256 endIdx) public view returns (address[] memory ret) {
        ret = new address[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.playerIds[i];
        }
    }

    /// @notice Returns an array of type LibTypes.Player[] of players matching the player addresses given in the parameter.
    /// @param ids The player addresses to get.
    /// @return ret The array of type LibTypes.Player[] of players matching the player addresses given in the parameter.
    function bulkGetPlayersByIds(address[] calldata ids) public view returns (LibTypes.Player[] memory ret) {
        ret = new LibTypes.Player[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.players[ids[i]];
        }
    }

    /// @notice Returns an array of type LibTypes.Player[] of players matching the given start and end index of players.
    /// @param startIdx The start index of the players to get.
    /// @param endIdx The end index of the players to get.
    /// @return ret The array of type LibTypes.Player[] of players matching the given start and end index of players.
    function bulkGetPlayers(uint256 startIdx, uint256 endIdx) public view returns (LibTypes.Player[] memory ret) {
        ret = new LibTypes.Player[](endIdx - startIdx);
        for (uint256 i = startIdx; i < endIdx; i++) {
            ret[i - startIdx] = s.players[s.playerIds[i]];
        }
    }

    /*///////////////////////////////////////////////////////////////
                        TILE DELAYED ACTION GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the number of delayed actions in the universe.
    /// @return number Number of delayed actions in the universe.
    function getNTilesWithDelayedActions() external view returns (uint256 number) {
        number = s.tilesWithDelayedActions.length;
    }

    /// @notice Returns an array of tile ids of tiles with delayed actions
    /// matching the given start and end index.
    /// @param startIdx The start index of the tile ids to get.
    /// @param endIdx The end index of the tile ids to get.
    /// @return ret The array of tile ids of tiles with delayed actions
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

    /// @notice Returns an array of type LibTypes.TileDelayedAction[] of tiles with delayed actions
    /// matching the tile ids given in the parameter.
    /// @param ids The tile ids to get.
    /// @return ret The array of type LibTypes.TileDelayedAction[] of tiles with delayed actions
    /// matching the tile ids given in the parameter.
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

    /*///////////////////////////////////////////////////////////////
                            OTHER GETTERS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns an array of type LibTypes.InfluenceData[] of influence data
    /// matching the region ids provided in the parameter.
    /// @param ids The region ids to get.
    /// @return ret The array of type LibTypes.InfluenceData[] of influence data
    /// matching the region ids provided in the parameter.
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

    /// @notice Returns an array of type LibTypes.Creature[] of creatures
    /// matching the creature ids provided in the parameter.
    /// @param ids The creature ids to get.
    /// @return ret The array of type LibTypes.Creature[] of creatures
    /// matching the creature ids provided in the parameter.
    function bulkGetCreaturesByIds(uint256[] calldata ids) public view returns (LibTypes.Creature[] memory ret) {
        ret = new LibTypes.Creature[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            ret[i] = s.creatures[ids[i]];
        }
    }
}
