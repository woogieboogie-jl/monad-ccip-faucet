// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {Faucet} from "../src/Faucet.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploys Faucet.sol on Monad Testnet
contract DeployFaucet is Script {
    // --- constants (update as needed) ---
    address constant ROUTER_MONAD = 0x5f16e51e3Dcb255480F090157DD01bA962a53E54; // CCIP router on Monad
    uint64 constant FUJI_SELECTOR = 14767482510784806043;
    address constant LINK_TOKEN = 0x6fE981Dbd557f81ff66836af0932cba535Cbc343;

    uint256 constant INITIAL_MON_DRIP = 0.5 ether;
    uint256 constant INITIAL_LINK_DRIP = 5 ether;

    uint256 constant MON_FUND = 1 ether; // value sent in deployment to fund reservoir & treasury

    function run() external {
        uint256 pk = vm.envUint("FAUCET_PRIVATE_KEY");
        vm.startBroadcast(pk);

        // Deploy faucet with dummy helper address, will be set later via addChain()
        Faucet faucet = new Faucet{value: MON_FUND}(
            ROUTER_MONAD,
            FUJI_SELECTOR,
            address(0), // to be updated after VolatilityHelper deploy
            LINK_TOKEN,
            INITIAL_MON_DRIP,
            INITIAL_LINK_DRIP
        );

        vm.stopBroadcast();

        console2.log("Faucet deployed at", address(faucet));
        console2.log("Update your .env file with:");
        console2.log("VITE_FAUCET_ADDRESS=", address(faucet));
    }
} 
 