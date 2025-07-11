// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";

contract ConfigureFaucet is Script {
    uint64 constant FUJI_SELECTOR = 14767482510784806043;

    function run() external {
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");
        address payable faucetAddr = payable(vm.envAddress("FAUCET_ADDRESS"));
        address helperAddr = vm.envAddress("HELPER_ADDRESS");

        vm.startBroadcast(pk);
        Faucet(faucetAddr).addChain(FUJI_SELECTOR, helperAddr);
        vm.stopBroadcast();

        console2.log("Faucet configured with helper", helperAddr);
    }
} 
 