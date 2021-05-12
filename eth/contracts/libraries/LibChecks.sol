// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;
import "./LibTypes.sol";
import "./LibAppStorage.sol";
import "./LibUtils.sol";

library LibChecks {
    function getAppStorage() internal pure returns (AppStorage storage ret) {
        ret = LibAppStorage.diamondStorage();
    }

    function _checkPathTiles(
        uint256[] memory path,
        address player,
        bool checkOwner,
        bool checkLastTile,
        bool checkUpdates,
        bool checkConnected,
        bool checkWalls
    ) public view {
        AppStorage storage s = getAppStorage();
        for (uint256 i = 0; i < (checkLastTile ? path.length : path.length - 1); i++) {
            if (checkConnected && i > 0) {
                // Check path is connected
                require(
                    LibUtils.manhattan(LibUtils.idToCoord(path[i - 1]), LibUtils.idToCoord(path[i])) <= 1,
                    "tiles are not connected to a path"
                );
            }

            // 1) Check that the tile is within the max bounds
            requireInBounds(LibUtils.idToCoord(path[i]));

            // 2) Check all tiles are mined
            require(s.tiles[path[i]].isMined, "one tile in the path is not mined");

            if (checkWalls) {
                // 3) Check no tiles are walled by other players
                require(
                    !s.tiles[path[i]].isWalled || s.tiles[path[i]].owner == player,
                    "one tile in the path is walled by another player"
                );
            }

            if (checkOwner) {
                // 4) Check player owns all tiles on the path
                require(s.tiles[path[i]].owner == player, "one tile in the path is not owned by you");
            }

            if (checkUpdates) {
                // 5) Check all upgrades are the same
                require(s.tiles[path[0]].upgrade == s.tiles[path[i]].upgrade, "upgrades are not the same");
            }
        }
    }

    function _checkConnection(uint256[] memory _tiles) public pure {
        uint256 tilesToVisit = _tiles.length;

        // Make a copy of the input array because it will be modified
        LibTypes.Coord[] memory tiles = new LibTypes.Coord[](_tiles.length);
        for (uint256 i = 0; i < _tiles.length; i++) {
            tiles[i] = LibUtils.idToCoord(_tiles[i]);
        }

        // The queue contains tiles whose neighbors havent been checked yet
        LibTypes.Coord[] memory queue = new LibTypes.Coord[](tiles.length);

        // Init the queue with the first tile and ignore this tile in future iterations
        queue[0] = tiles[0];
        uint256 queueLength = 1;
        tilesToVisit--;
        tiles[0] = tiles[tilesToVisit];

        while (queueLength > 0) {
            queueLength--;
            LibTypes.Coord memory current = queue[queueLength];

            uint256 addedToQueue = 0;
            for (uint256 i = 0; i < tilesToVisit - addedToQueue; i++) {
                // Add all tiles that are adjacent to this tile and have not been visited yet to the queue
                if (LibUtils.manhattan(current, tiles[i]) == 1) {
                    // Add tile to queue
                    queue[queueLength] = tiles[i];
                    queueLength++;
                    // Ignore this tile in future iterations
                    tiles[i] = tiles[tilesToVisit - addedToQueue - 1];
                    addedToQueue++;
                    // Check the index again that we've just moved a tile to
                    i--;
                }
            }
            // Reduce list size, tiles in the end have been moved to the front
            tilesToVisit -= addedToQueue;
        }

        require(tilesToVisit == 0, "given tiles are not connected");
    }

    function requireInBounds(LibTypes.Coord memory coord) public view {
        AppStorage storage s = getAppStorage();
        require(
            coord.x < s.MAX_X && coord.x > -s.MAX_X && coord.y < s.MAX_Y && coord.y > -s.MAX_Y,
            "coord is out of bounds"
        );
    }

    function checkHeroOnFirstTileOfPath(uint256[] memory path, address player) public view {
        AppStorage storage s = getAppStorage();
        uint256 fromRegion = LibUtils.coordToId(LibUtils.toRegionCoord(LibUtils.idToCoord(path[0]), s.REGION_LENGTH));
        bool found;
        require(s.regions[fromRegion].creatures.length > 0);
        LibTypes.Creature storage hero = s.creatures[s.regions[fromRegion].creatures[0]];
        for (uint256 i = 0; i < s.regions[fromRegion].creatures.length; i++) {
            if (s.creatures[s.regions[fromRegion].creatures[i]].species == LibTypes.CreatureSpecies.HERO) {
                found = true;
                hero = s.creatures[s.regions[fromRegion].creatures[i]];
            }
        }
        require(found, "no hero was found on the fromRegion");
        require(hero.tileId == path[0], "hero is not on the first tile");
        require(hero.owner == player, "hero is no the player's hero");
    }
}
