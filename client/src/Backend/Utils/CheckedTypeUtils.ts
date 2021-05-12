import { ethers } from "ethers";
import { EthAddress } from "../../_types/GlobalTypes";

export class CheckedTypeUtils {
  public static EMPTY_ADDRESS = CheckedTypeUtils.address("0000000000000000000000000000000000000000");

  //public static EMPTY_LOCATION_ID = CheckedTypeUtils.locationIdFromHexStr(
  //  '0000000000000000000000000000000000000000000000000000000000000000'
  //);

  //public static locationIdFromHexStr(location: string) {
  //  const locationBI = BigNumber.from(location);
  //  if (locationBI.gte(LOCATION_ID_UB)) throw new Error('not a valid location');
  //  let ret = locationBI.toString(16);
  //  while (ret.length < 64) ret = '0' + ret;
  //  return ret as LocationId;
  //}

  // public static tileIdFromDecimalString(tileId: string | BigNumberish) {
  //   const locationBI = BigNumber.from(tileId);
  //   let ret = locationBI.toHexString();
  //   return ret as TileId;
  // }

  // public static regionIdFromDecimalString(regionId: string | BigNumberish) {
  //   const regionBI = BigNumber.from(regionId);
  //   let ret = regionBI.toHexString();
  //   return ret as RegionId;
  // }

  // public static locationIdFromDecimalString(locationId: string | BigNumberish) {
  //   const regionBI = BigNumber.from(locationId);
  //   let ret = regionBI.toHexString();
  //   return ret as LocationId;
  // }
  //public static artifactIdFromDecStr(artifactId: string): ArtifactId {
  //  const locationBI = bigInt(artifactId);
  //  let ret = locationBI.toString(16);
  //  while (ret.length < 64) ret = '0' + ret;
  //  return ret as ArtifactId;
  //}

  //public static locationIdFromBigInt(location: BigInteger): LocationId {
  //  const locationBI = bigInt(location);
  //  if (locationBI.geq(LOCATION_ID_UB)) throw new Error('not a valid location');
  //  let ret = locationBI.toString(16);
  //  while (ret.length < 64) ret = '0' + ret;
  //  return ret as LocationId;
  //}

  //public static locationIdFromEthersBN(location: EthersBN): LocationId {
  //  return CheckedTypeUtils.locationIdFromDecStr(location.toString());
  //}

  //public static artifactIdFromEthersBN(artifactId: EthersBN): ArtifactId {
  //  return CheckedTypeUtils.artifactIdFromDecStr(artifactId.toString());
  //}

  //public static locationIdToDecStr(locationId: LocationId): string {
  //  return bigInt(locationId, 16).toString(10);
  //}

  //public static artifactIdToDecStr(artifactId: ArtifactId): string {
  //  return bigInt(artifactId, 16).toString(10);
  //}

  public static address(str: string): EthAddress {
    return ethers.utils.getAddress(str) as EthAddress;
  }
}
