// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {VolatilityHelper} from "../src/VolatilityHelper.sol";

contract DeployVolatilityHelper is Script {
    address constant ROUTER_FUJI = 0xF694E193200268f9a4868e4Aa017A0118C9a8177;
    uint64 constant MONAD_SELECTOR = 2183018362218727504;
    address constant VOL_FEED = 0x93b9B82158846cefa8b4040f22A3Bff05c365226; // corrected ETH/USD volatility feed
    address constant LINK_TOKEN = 0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846; // Fuji LINK token

    function run() external {
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");
        address faucetAddr = vm.envAddress("FAUCET_ADDRESS");

        vm.startBroadcast(pk);
        VolatilityHelper helper = new VolatilityHelper(
            ROUTER_FUJI,
            MONAD_SELECTOR,
            faucetAddr,
            VOL_FEED,
            LINK_TOKEN
        );
        vm.stopBroadcast();

        console2.log("VolatilityHelper deployed at", address(helper));
    }
} 
 