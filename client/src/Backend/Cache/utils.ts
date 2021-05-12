import { EthAddress } from "../../_types/GlobalTypes";

export function getDungeonHeartCacheKey(player: EthAddress, diamond: EthAddress) {
  return player + diamond;
}
