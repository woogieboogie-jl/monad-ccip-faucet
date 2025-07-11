// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VolatilityHelper
 * @notice Stateless CCIP application deployed on Avalanche Fuji. Responds with ETH/USD 24h realized volatility.
 */
contract VolatilityHelper is CCIPReceiver {
    // =============================================================
    // ----------------------- STATE/IMMUTABLE ---------------------
    // =============================================================

    IRouterClient public immutable router;
    uint64 public immutable monadChainSelector; // 2183018362218727504
    address public immutable faucet;            // Faucet address on Monad
    IERC20 public immutable LINK;

    AggregatorV3Interface public immutable volatilityFeed; // ETH/USD 24h Realised Volatility feed

    event Deposit(address indexed from, uint256 amount);

    // ✅ NEW: Event to track response messages sent back to Monad
    event VolatilityResponseSent(
        bytes32 indexed responseMessageId,
        bytes32 indexed originalRequestId, 
        uint256 volatilityValue,
        address indexed faucetAddress
    );

    // =============================================================
    // ------------------------ CONSTRUCTOR ------------------------
    // =============================================================

    constructor(
        address _router,
        uint64 _monadSelector,
        address _faucet,
        address _volatilityFeed,
        address _link
    ) CCIPReceiver(_router) {
        router = IRouterClient(_router);
        monadChainSelector = _monadSelector;
        faucet = _faucet;
        volatilityFeed = AggregatorV3Interface(_volatilityFeed);
        LINK = IERC20(_link);
    }

    // =============================================================
    // ----------------------- CCIP RECEIVE ------------------------
    // =============================================================

    /// @inheritdoc CCIPReceiver
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        require(message.sourceChainSelector == monadChainSelector, "Invalid source chain");
        require(keccak256(message.sender) == keccak256(abi.encode(faucet)), "Invalid sender");

        // Fetch volatility value (scaled by 1e8 like price feeds)
        (, int256 vol,,,) = volatilityFeed.latestRoundData();
        // The feed is scaled by 1e2 (two implied decimals). Convert to an
        // integer score in the 0-1000 range expected by the Monad faucet.
        uint256 valueRaw = uint256(vol);
        uint256 score = valueRaw / 100;            // eg 67415 → 674
        if (score > 1000) score = 1000;           // clamp just in case

        // Build response message with (requestId, volatility) so the faucet
        // can correlate the reply.
        Client.EVM2AnyMessage memory response = Client.EVM2AnyMessage({
            receiver: message.sender, // faucet encoded bytes
            data: abi.encode(message.messageId, score),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 150_000})),
            feeToken: address(LINK) // pay fee in LINK token
        });

        // Ensure sufficient allowance for LINK fee
        uint256 fee = router.getFee(monadChainSelector, response);
        if (LINK.allowance(address(this), address(router)) < fee) {
            LINK.approve(address(router), type(uint256).max);
        }

        // Send back to Monad and capture the response messageId
        bytes32 responseMessageId = router.ccipSend(monadChainSelector, response);
        
        // ✅ NEW: Emit event to track the response messageId
        emit VolatilityResponseSent(
            responseMessageId,
            message.messageId, // Original request ID from Monad
            score,             // Scaled volatility score being sent
            faucet            // Destination faucet address on Monad
        );
    }

    /// @notice Accept native AVAX just in case someone funds it; not used in logic.
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }
} 
 