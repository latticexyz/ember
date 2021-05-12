pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

// SPDX-License-Identifier: GPL-3.0
import "@opengsn/contracts/src/utils/GsnTypes.sol";
import "@opengsn/contracts/src/interfaces/IPaymaster.sol";
import "@opengsn/contracts/src/interfaces/IRelayHub.sol";
import "@opengsn/contracts/src/utils/GsnEip712Library.sol";
import "@opengsn/contracts/src/forwarder/IForwarder.sol";

contract Paymaster is IPaymaster {
    address[] public targets;
    mapping(address => bool) allowedTargets;

    event TargetAdded(address target);

    function addTarget(address target) external onlyOwner {
        targets.push(target);
        allowedTargets[target] = true;
        emit TargetAdded(target);
    }

    event PreRelayed(uint256);
    event PostRelayed(uint256);

    IRelayHub internal relayHub;
    IForwarder public override trustedForwarder;

    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function owner() public view returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function setOwner(address o) public {
        require(_owner == address(0), "owner has already been set");
        _owner = o;
    }

    function getHubAddr() public view override returns (address) {
        return address(relayHub);
    }

    //overhead of forwarder verify+signature, plus hub overhead.
    uint256 public constant FORWARDER_HUB_OVERHEAD = 50000;

    //These parameters are documented in IPaymaster.GasAndDataLimits
    uint256 public constant PRE_RELAYED_CALL_GAS_LIMIT = 100000;
    uint256 public constant POST_RELAYED_CALL_GAS_LIMIT = 110000;
    uint256 public constant PAYMASTER_ACCEPTANCE_BUDGET = PRE_RELAYED_CALL_GAS_LIMIT + FORWARDER_HUB_OVERHEAD;
    uint256 public constant CALLDATA_SIZE_LIMIT = 10500;

    function getGasAndDataLimits() public view virtual override returns (IPaymaster.GasAndDataLimits memory limits) {
        return
            IPaymaster.GasAndDataLimits(
                PAYMASTER_ACCEPTANCE_BUDGET,
                PRE_RELAYED_CALL_GAS_LIMIT,
                POST_RELAYED_CALL_GAS_LIMIT,
                CALLDATA_SIZE_LIMIT
            );
    }

    // this method must be called from preRelayedCall to validate that the forwarder
    // is approved by the paymaster as well as by the recipient contract.
    function _verifyForwarder(GsnTypes.RelayRequest calldata relayRequest) public view {
        require(address(trustedForwarder) == relayRequest.relayData.forwarder, "Forwarder is not trusted");
        GsnEip712Library.verifyForwarderTrusted(relayRequest);
    }

    /*
     * modifier to be used by recipients as access control protection for preRelayedCall & postRelayedCall
     */
    modifier relayHubOnly() {
        require(msg.sender == getHubAddr(), "can only be called by RelayHub");
        _;
    }

    function setRelayHub(IRelayHub hub) public onlyOwner {
        relayHub = hub;
    }

    function setTrustedForwarder(IForwarder forwarder) public onlyOwner {
        trustedForwarder = forwarder;
    }

    /// check current deposit on relay hub.
    function getRelayHubDeposit() public view override returns (uint256) {
        return relayHub.balanceOf(address(this));
    }

    // any money moved into the paymaster is transferred as a deposit.
    // This way, we don't need to understand the RelayHub API in order to replenish
    // the paymaster.
    receive() external payable virtual {
        require(address(relayHub) != address(0), "relay hub address not set");
        relayHub.depositFor{value: msg.value}(address(this));
    }

    /// withdraw deposit from relayHub
    function withdrawRelayHubDepositTo(uint256 amount, address payable target) public onlyOwner {
        relayHub.withdraw(amount, target);
    }

    function preRelayedCall(
        GsnTypes.RelayRequest calldata relayRequest,
        bytes calldata signature,
        bytes calldata approvalData,
        uint256 maxPossibleGas
    ) external virtual override returns (bytes memory context, bool) {
        _verifyForwarder(relayRequest);
        (signature, approvalData, maxPossibleGas);

        require(allowedTargets[relayRequest.request.to]);
        emit PreRelayed(block.timestamp);
        return (abi.encode(block.timestamp), false);
    }

    function postRelayedCall(
        bytes calldata context,
        bool success,
        uint256 gasUseWithoutPost,
        GsnTypes.RelayData calldata relayData
    ) external virtual override {
        (context, success, gasUseWithoutPost, relayData);
        emit PostRelayed(abi.decode(context, (uint256)));
    }

    function versionPaymaster() external view virtual override returns (string memory) {
        return "2.2.0";
    }
}
