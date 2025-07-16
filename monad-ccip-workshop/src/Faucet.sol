// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Chainlink CCIP interfaces (aligned with remappings)
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/**
 * @title Faucet
 * @notice Dual-reservoir faucet for MON & LINK on Monad testnet.
 *         Uses Chainlink CCIP to fetch volatility data from VolatilityHelper on Fuji.
 */
contract Faucet is CCIPReceiver, Ownable(msg.sender) {
    // =============================================================
    // --------------------------- TYPES ---------------------------
    // =============================================================

    struct Reservoir {
        uint256 dispensablePool; // Remaining tokens available for drip
        uint256 dripRate;        // Tokens dispensed per request (dynamic)
    }

    // -------------------------------------------------------------------------
    // Minimal EIP-4337 UserOperation struct (only fields we need).
    // -------------------------------------------------------------------------
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    // =============================================================
    // ----------------------- STATE/IMMUTABLE ---------------------
    // =============================================================

    // Tokens
    // Native MON handled via address(this).balance – no IERC20.
    IERC20 public immutable LINK;

    // Cool-down period (per user per token). Mutable so the owner can adjust.
    uint256 public COOLDOWN = 6 hours;

    /// @notice Emitted whenever the cooldown period is updated.
    /// @param newCooldown The new cooldown value in seconds.
    event CooldownUpdated(uint256 newCooldown);

    // Mapping for last claim timestamp per user per token
    mapping(address => uint256) public lastClaimMon;
    mapping(address => uint256) public lastClaimLink;

    // Reservoirs
    Reservoir private monRes;
    Reservoir private linkRes;
    
    // Configurable reservoir capacities (can be adjusted by owner)
    uint256 public monReservoirCapacity = 100 ether; // MON reservoir capacity
    uint256 public linkReservoirCapacity = 100 ether; // LINK reservoir capacity

    // Refill threshold factor. Reservoir is considered "low" when
    // dispensablePool < dripRate * thresholdFactor.
    uint256 public thresholdFactor = 10; // default same logic as before (dripRate * 10 ~= 20%)

    // Capacity multiplier: reservoirCapacity = dripRate × thresholdFactor × capacityFactor
    uint256 public capacityFactor = 5; // default 5 ⇒ capacity = 5 × threshold

    // Base drip rates set at deployment - these never change and represent the initial values
    uint256 public BASEMONDRIPRATE;  // Initial MON drip rate from deployment
    uint256 public BASELINKDRIPRATE; // Initial LINK drip rate from deployment

    /// @notice Emitted when the threshold factor is updated by the owner.
    event ThresholdFactorUpdated(uint256 newFactor);
    
    /// @notice Emitted when reservoir capacity is updated by the owner.
    event ReservoirCapacityUpdated(address indexed token, uint256 newCapacity);

    /// @notice Emitted when the capacity factor is updated by the owner.
    event CapacityFactorUpdated(uint256 newFactor);
    
    /// @notice Emitted when owner withdraws tokens from treasury.
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

    /// @notice Mutex to prevent multiple concurrent refill requests.
    bool public refillInProgress;

    // Pending messageIds => requested asset flags
    struct PendingFlags { bool mon; bool link; }
    mapping(bytes32 => PendingFlags) public pendingRequests;

    // Cross-chain / CCIP
    IRouterClient public immutable router;
    uint64 public immutable fujiChainSelector; // 14767482510784806043
    mapping(uint64 => address) public trustedSenders; // chainSelector => helper contract

    // Function selectors
    bytes4 private constant REQ_MON_SELECTOR = bytes4(keccak256("requestMonTokens()"));

    // =============================================================
    // ---------------------------- EVENTS -------------------------
    // =============================================================

    event Drip(address indexed user, address indexed token, uint256 amount);
    event RefillTriggered(bytes32 indexed messageId);
    event ReservoirRefilled(address indexed token, uint256 newDripRate, uint256 newPool);

    /// @notice Emitted when a volatility response is received from the helper.
    /// @param responseMessageId  CCIP inbound messageId carrying the volatility data
    /// @param volatilityScore    0-1000 score after clamping/division in helper
    event VolatilityReceived(bytes32 indexed responseMessageId, uint256 volatilityScore);
    event Deposit(address indexed from, uint256 amount);
    event RefillStateReset(uint256 clearedMessageCount);

    // =============================================================
    // ------------------------ CONSTRUCTOR ------------------------
    // =============================================================

    constructor(
        address _router,
        uint64 _fujiSelector,
        address _volatilityHelper,
        address _link,
        uint256 _initialMonDrip,
        uint256 _initialLinkDrip
    ) payable CCIPReceiver(_router) {
        router = IRouterClient(_router);
        fujiChainSelector = _fujiSelector;
        LINK = IERC20(_link);
        trustedSenders[_fujiSelector] = _volatilityHelper;
        monRes.dripRate = _initialMonDrip;
        linkRes.dripRate = _initialLinkDrip;
        BASEMONDRIPRATE = _initialMonDrip;
        BASELINKDRIPRATE = _initialLinkDrip;

        // Derive initial capacities from factors so they start consistent
        _recalculateCaps();
    }

    // =============================================================
    // --------------------- USER-FACING (DRIP) --------------------
    // =============================================================

    function requestMonTokens() external {
        _dripNative();
    }

    /// @notice Request MON tokens to be sent to a specific address (useful for AA)
    /// @param recipient The address that should receive the MON tokens
    function requestMonTokensTo(address payable recipient) external {
        _dripNativeTo(recipient);
    }

    function requestLinkTokens() external {
        _drip(LINK, linkRes, lastClaimLink);
    }

    // =============================================================
    // ----------------------- ADMIN / PUBLIC ----------------------
    // =============================================================

    /// @notice Anyone can call; reverts if refill not required.
    function triggerRefillCheck() external payable {

        // Need refill?
        bool needMon = _belowThreshold(monRes);
        bool needLink = _belowThreshold(linkRes);
        require(needMon || needLink, "Reservoirs sufficiently full");

        // Prevent spamming while a refill CCIP request is still pending
        require(!refillInProgress, "Refill already pending");

        // Build CCIP message – simple empty payload; helper will reply with volatility
        address helper = trustedSenders[fujiChainSelector];
        require(helper != address(0), "Helper not set");

        Client.EVM2AnyMessage memory msgData = Client.EVM2AnyMessage({
            receiver: abi.encode(helper),
            data: bytes(""),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000})),
            feeToken: address(LINK) // pay fee in LINK token
        });

        // ------------------------------------------------------------------
        // Ensure the faucet has granted the router enough LINK allowance to
        // cover the outgoing fee. Approval is done lazily here to avoid an
        // extra constructor call and keeps the contract stateless.
        // ------------------------------------------------------------------
        uint256 fee = router.getFee(fujiChainSelector, msgData);
        if (LINK.allowance(address(this), address(router)) < fee) {
            // Approve max so we don't need to approve again.
            LINK.approve(address(router), type(uint256).max);
        }

        // Send message - this can revert if router rejects
        bytes32 messageId = router.ccipSend(fujiChainSelector, msgData);
        
        // Record which reservoirs need refilling for this message
        refillInProgress = true;
        pendingRequests[messageId] = PendingFlags({mon: needMon, link: needLink});
        emit RefillTriggered(messageId);
    }

    // =============================================================
    // ----------------------- CCIP RECEIVE ------------------------
    // =============================================================

    /// @inheritdoc CCIPReceiver
    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        require(message.sourceChainSelector == fujiChainSelector, "Invalid source chain");
        require(keccak256(message.sender) == keccak256(abi.encode(trustedSenders[fujiChainSelector])), "Invalid sender");

        // Decode (requestId, volatility)
        (bytes32 requestId, uint256 volatility) = abi.decode(message.data, (bytes32, uint256));

        // Ensure this reply corresponds to an outstanding request we actually sent
        PendingFlags memory flags = pendingRequests[requestId];
        require(flags.mon || flags.link, "Unknown requestId");
        
        // Clear the original request from pending and the refill mutex
        delete pendingRequests[requestId];
        refillInProgress = false;

        // Emit the volatility score for the front-end to consume
        emit VolatilityReceived(message.messageId, volatility);

        // Example: Map volatility (0-1000) to dripRate scale
        // Map volatility to drip using **direct** correlation (higher vol => higher drip)
        // Corrected argument order: _mapVolToDrip(vol, maxDrip, minDrip)
        uint256 newMonDrip = _mapVolToDrip(volatility, 2 ether, 0.5 ether); // 0.5 → 2 MON
        uint256 newLinkDrip = _mapVolToDrip(volatility, 10 ether, 2 ether); // 2 → 10 LINK
        
        // Safety checks: ensure drip rates don't exceed reasonable limits
        uint256 maxMonDrip = monReservoirCapacity / (thresholdFactor + 5); // Leave some buffer
        uint256 maxLinkDrip = linkReservoirCapacity / (thresholdFactor + 5);

        if (newMonDrip > maxMonDrip) newMonDrip = maxMonDrip;
        if (newLinkDrip > maxLinkDrip) newLinkDrip = maxLinkDrip;

        // Refill only the reservoirs that were requested
        if (flags.mon) {
            _topUpNativeReservoir();
            monRes.dripRate = newMonDrip;
            emit ReservoirRefilled(address(0), newMonDrip, monRes.dispensablePool); // address(0) for MON
        }

        if (flags.link) {
            _topUpReservoir(linkRes, LINK, linkReservoirCapacity);
            linkRes.dripRate = newLinkDrip;
            emit ReservoirRefilled(address(LINK), newLinkDrip, linkRes.dispensablePool);
        }

        // Update capacities after drip rate changes so ratios hold
        _recalculateCaps();
 
    }

    // =============================================================
    // ------------------------ INTERNALS --------------------------
    // =============================================================

    function _dripNative() internal {
        address user = tx.origin; // Get the actual EOA that initiated the transaction
        require(block.timestamp - lastClaimMon[user] >= COOLDOWN, "Cooldown");
        require(monRes.dispensablePool >= monRes.dripRate, "Reservoir empty");

        monRes.dispensablePool -= monRes.dripRate;
        lastClaimMon[user] = block.timestamp;

        (bool sent, ) = payable(user).call{value: monRes.dripRate}("");
        require(sent, "Transfer failed");
        emit Drip(user, address(0), monRes.dripRate);
    }

    function _dripNativeTo(address payable recipient) internal {
        // Use recipient address for cooldown tracking instead of tx.origin
        // This ensures each user has their own cooldown even when using Account Abstraction
        require(block.timestamp - lastClaimMon[recipient] >= COOLDOWN, "Cooldown");
        require(monRes.dispensablePool >= monRes.dripRate, "Reservoir empty");

        monRes.dispensablePool -= monRes.dripRate;
        lastClaimMon[recipient] = block.timestamp;

        (bool sent, ) = recipient.call{value: monRes.dripRate}("");
        require(sent, "Transfer failed");
        emit Drip(recipient, address(0), monRes.dripRate);
    }

    function _drip(
        IERC20 token,
        Reservoir storage res,
        mapping(address => uint256) storage lastClaim
    ) internal {
        require(block.timestamp - lastClaim[msg.sender] >= COOLDOWN, "Cooldown");
        require(res.dispensablePool >= res.dripRate, "Reservoir empty");

        res.dispensablePool -= res.dripRate;
        lastClaim[msg.sender] = block.timestamp;
        token.transfer(msg.sender, res.dripRate);
        emit Drip(msg.sender, address(token), res.dripRate);
    }

    function _belowThreshold(Reservoir storage res) internal view returns (bool) {
        uint256 threshold = res.dripRate * thresholdFactor;
        return res.dispensablePool < threshold;
    }

    function _topUpReservoir(Reservoir storage res, IERC20 token, uint256 capacity) internal {
        uint256 missing = capacity - res.dispensablePool;
        if (missing == 0) return;

        // How many LINK tokens are actually available in treasury beyond what
        // is already counted in the reservoir?
        uint256 available = token.balanceOf(address(this));

        // Safety: if for some reason the recorded pool is higher than the real
        // balance, treat available as zero.
        if (available <= res.dispensablePool) return;

        uint256 freeBalance = available - res.dispensablePool;
        uint256 toAdd = freeBalance < missing ? freeBalance : missing;
        res.dispensablePool += toAdd;
    }

    /**
     * @dev Top-up MON reservoir with *unallocated* treasury balance only.
     *      This mirrors the LINK logic and prevents the same MON from being
     *      counted twice. The invariant after this function is:
     *      monRes.dispensablePool + (treasury balance) == address(this).balance.
     */
    function _topUpNativeReservoir() internal {
        if (monRes.dispensablePool >= monReservoirCapacity) return;

        uint256 totalBalance = address(this).balance;

        // If somehow recorded pool exceeds or equals real balance, do nothing.
        if (totalBalance <= monRes.dispensablePool) return;

        uint256 freeBalance = totalBalance - monRes.dispensablePool; // Tokens not yet in reservoir
        uint256 missing     = monReservoirCapacity - monRes.dispensablePool;
        uint256 toAdd       = freeBalance < missing ? freeBalance : missing;

        if (toAdd == 0) return;
            monRes.dispensablePool += toAdd;
    }

    function _mapVolToDrip(uint256 vol, uint256 maxDrip, uint256 minDrip) internal pure returns (uint256) {
        // vol assumed 0-1000; higher vol => lower drip
        if (vol > 1000) vol = 1000;
        uint256 range = maxDrip - minDrip;
        uint256 drip = minDrip + (range * vol / 1000);
        return drip;
    }

    // -------------------------------------------------------------
    // Internal helper: recompute MON & LINK reservoir capacities
    // capacity = dripRate × thresholdFactor × capacityFactor
    // -------------------------------------------------------------
    function _recalculateCaps() internal {
        monReservoirCapacity  = monRes.dripRate  * thresholdFactor * capacityFactor;
        linkReservoirCapacity = linkRes.dripRate * thresholdFactor * capacityFactor;
    }

    // =============================================================
    // --------------- EIP-4337 Paymaster Validation ---------------
    // =============================================================

    /// @notice Called by Paymaster during validation phase to determine if gas should be sponsored.
    ///         Allows sponsoring gas for a user's *first* MON claim only.
    /// @param userOp The full UserOperation struct
    /// @param _userOpHash Hash of the UserOperation (unused)
    /// @param _maxCost Maximum cost that the paymaster will pay (unused)
    /// @return context Data to be passed to postOp (empty in our case)
    /// @return validationData Packed validation result (0 = success, 1 = failure)
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 _userOpHash,
        uint256 _maxCost
    ) external view returns (bytes memory context, uint256 validationData) {
        // Silence unused parameter warnings with void statements
        _userOpHash; _maxCost;
        
        // Extract the recipient address from the UserOperation calldata
        // For requestMonTokensTo(address), the recipient is the first parameter
        address recipient = _extractRecipientFromCalldata(userOp.callData);
        
        // Check if this is a valid first-time MON claim for the actual recipient
        bool isValid = _isValidFirstTimeClaim(recipient);
        
        // Return empty context and validation result
        // validationData: 0 = success, 1 = failure
        return ("", isValid ? 0 : 1);
    }

    /// @notice Extract recipient address from UserOperation calldata
    /// @param callData The calldata from the UserOperation
    /// @return recipient The recipient address, or zero address if extraction fails
    function _extractRecipientFromCalldata(bytes calldata callData) internal pure returns (address recipient) {
        // Check if this is a call to requestMonTokensTo(address)
        // Function selector: bytes4(keccak256("requestMonTokensTo(address)"))
        if (callData.length >= 36 && bytes4(callData[:4]) == bytes4(keccak256("requestMonTokensTo(address)"))) {
            // Extract the address parameter (bytes 4-35)
            recipient = address(uint160(uint256(bytes32(callData[4:36]))));
        }
        // If it's not requestMonTokensTo, return zero address (will fail validation)
        return recipient;
    }

    /// @notice Helper function to check if user is eligible for sponsored first MON claim
    function _isValidFirstTimeClaim(address user) internal view returns (bool) {
        // Check the actual user address passed in (which should be the recipient)
        // instead of tx.origin for Account Abstraction compatibility
        
        // User must have never claimed MON before
        if (lastClaimMon[user] != 0) return false;
        
        // User must have zero native balance (truly new user)
        if (user.balance != 0) return false;
        
        // Reservoir must have enough tokens to serve the request
        if (monRes.dispensablePool < monRes.dripRate) return false;
        
        return true;
    }

    // -------------------------------------------------------------
    // Admin: register trusted helper for a source chain
    // -------------------------------------------------------------
    function addChain(uint64 selector, address helper) external onlyOwner {
        trustedSenders[selector] = helper;
    }

    // =============================================================
    // -------------------- FUNDING (receive MON) ------------------
    // =============================================================

    /// @notice Deposit MON into the faucet treasury and (optionally) auto-top-up the reservoir.
    function deposit() public payable {
        require(msg.value > 0, "No MON sent");
        emit Deposit(msg.sender, msg.value);
        // FIXED: Don't auto-top-up reservoir on deposit - keep funds in treasury
        // Treasury represents "deep reserves" that can refill tanks via CCIP
        // _topUpNativeReservoir(); // REMOVED: Let treasury accumulate funds
    }

    /// @dev Fallback MON transfers funnel into deposit()
    receive() external payable {
        emit Deposit(msg.sender, msg.value);
        // FIXED: Don't auto-top-up reservoir on deposit - keep funds in treasury
        // _topUpNativeReservoir(); // REMOVED: Let treasury accumulate funds
    }

    // =============================================================
    // -------------------- MINIMAL VIEW FUNCTIONS -----------------
    // =============================================================

    /// @notice Get reservoir status (only data that can't be computed client-side)
    function getReservoirStatus() external view returns (
        uint256 monPool, uint256 monDripRate,
        uint256 linkPool, uint256 linkDripRate
    ) {
        return (monRes.dispensablePool, monRes.dripRate, linkRes.dispensablePool, linkRes.dripRate);
    }

    /// @notice Diagnostic function to check refill state and pending messages
    /// @param messageIds Array of messageIds to check status for
    /// @return isRefillInProgress Whether a refill is currently in progress
    /// @return pendingStates Array of booleans indicating which messageIds are pending
    function getRefillDiagnostics(bytes32[] calldata messageIds) external view returns (
        bool isRefillInProgress,
        bool[] memory pendingStates
    ) {
        isRefillInProgress = refillInProgress;
        pendingStates = new bool[](messageIds.length);
        
        for (uint256 i = 0; i < messageIds.length; i++) {
            PendingFlags memory flags = pendingRequests[messageIds[i]];
            pendingStates[i] = flags.mon || flags.link;
        }
        
        return (isRefillInProgress, pendingStates);
    }

    // =============================================================
    // -------------------------- ADMIN ----------------------------
    // =============================================================

    /// @notice Allows the contract owner to update the global cooldown period.
    /// @param newCooldown The new cooldown in seconds. Cannot be zero.
    function setCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown > 0, "Cooldown cannot be zero");
        COOLDOWN = newCooldown;
        emit CooldownUpdated(newCooldown);
    }

    /// @notice Owner can update the thresholdFactor.
    function setThresholdFactor(uint256 newFactor) external onlyOwner {
        require(newFactor > 0, "factor zero");
        thresholdFactor = newFactor;
        emit ThresholdFactorUpdated(newFactor);

        // Keep capacities aligned with new threshold
        _recalculateCaps();
    }

    /// @notice Owner can update the capacityFactor (multiplier applied to threshold).
    ///         Reservoir capacity = dripRate × thresholdFactor × capacityFactor.
    function setCapacityFactor(uint256 newFactor) external onlyOwner {
        require(newFactor > 0, "factor zero");
        capacityFactor = newFactor;
        emit CapacityFactorUpdated(newFactor);
        _recalculateCaps();
    }

    /// @notice Emergency function to reset refill state if CCIP gets stuck
    /// @param messageIds Array of messageIds to clear from pending (optional - pass empty array to skip)
    /// @dev Use this if a CCIP message gets stuck and users can't trigger new refills
    function emergencyResetRefillState(bytes32[] calldata messageIds) external onlyOwner {
        // Clear the main mutex
        refillInProgress = false;
        
        // Clear specific pending messages if provided
        for (uint256 i = 0; i < messageIds.length; i++) {
            delete pendingRequests[messageIds[i]];
        }
        
        emit RefillStateReset(messageIds.length);
    }

    /// @notice Update MON reservoir capacity
    /// @param newCapacity New capacity for MON reservoir in wei
    function setMonReservoirCapacity(uint256 newCapacity) external onlyOwner {
        require(newCapacity > 0, "Capacity cannot be zero");
        monReservoirCapacity = newCapacity;
        emit ReservoirCapacityUpdated(address(0), newCapacity); // address(0) for MON
        
        // If new capacity is smaller than current pool, reduce the pool
        if (monRes.dispensablePool > newCapacity) {
            monRes.dispensablePool = newCapacity;
        }
        // FIXED: Don't auto-refill from treasury when capacity increases
        // Owner must manually call refillReservoirFromTreasury if desired
    }

    /// @notice Update LINK reservoir capacity
    /// @param newCapacity New capacity for LINK reservoir in wei
    function setLinkReservoirCapacity(uint256 newCapacity) external onlyOwner {
        require(newCapacity > 0, "Capacity cannot be zero");
        linkReservoirCapacity = newCapacity;
        emit ReservoirCapacityUpdated(address(LINK), newCapacity);
        
        // If new capacity is smaller than current pool, reduce the pool
        if (linkRes.dispensablePool > newCapacity) {
            linkRes.dispensablePool = newCapacity;
        }
        // FIXED: Don't auto-refill from treasury when capacity increases
        // Owner must manually call refillReservoirFromTreasury if desired
    }

    /// @notice Manual function for owner to refill reservoirs from treasury
    /// @param refillMon Whether to refill MON reservoir from treasury
    /// @param refillLink Whether to refill LINK reservoir from treasury
    function refillReservoirFromTreasury(bool refillMon, bool refillLink) external onlyOwner {
        if (refillMon) {
            _topUpNativeReservoir();
        }
        if (refillLink) {
            _topUpReservoir(linkRes, LINK, linkReservoirCapacity);
        }
    }

    /// @notice Emergency withdrawal of MON tokens from treasury (not from reservoir)
    /// @param to Address to send the withdrawn MON
    /// @param amount Amount of MON to withdraw in wei
    /// @dev Only withdraws from treasury balance, not from the reservoir
    function emergencyWithdrawMon(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        // Calculate available treasury balance (total balance minus reservoir)
        uint256 totalBalance = address(this).balance;
        uint256 treasuryBalance = totalBalance > monRes.dispensablePool ? totalBalance - monRes.dispensablePool : 0;
        
        require(treasuryBalance >= amount, "Insufficient treasury balance");
        
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        
        emit EmergencyWithdrawal(address(0), to, amount); // address(0) for MON
    }

    /// @notice Emergency withdrawal of LINK tokens from treasury (not from reservoir)
    /// @param to Address to send the withdrawn LINK
    /// @param amount Amount of LINK to withdraw in wei
    /// @dev Only withdraws from treasury balance, not from the reservoir
    function emergencyWithdrawLink(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        // Calculate available treasury balance (total balance minus reservoir)
        uint256 totalBalance = LINK.balanceOf(address(this));
        uint256 treasuryBalance = totalBalance > linkRes.dispensablePool ? totalBalance - linkRes.dispensablePool : 0;
        
        require(treasuryBalance >= amount, "Insufficient treasury balance");
        
        bool success = LINK.transfer(to, amount);
        require(success, "Transfer failed");
        
        emit EmergencyWithdrawal(address(LINK), to, amount);
    }

    /// @notice Get detailed treasury and reservoir balances for both tokens
    /// @return monTreasury MON treasury balance (total - reservoir)
    /// @return monReservoir MON reservoir balance
    /// @return linkTreasury LINK treasury balance (total - reservoir)  
    /// @return linkReservoir LINK reservoir balance
    /// @return monCapacity MON reservoir capacity
    /// @return linkCapacity LINK reservoir capacity
    function getTreasuryStatus() external view returns (
        uint256 monTreasury,
        uint256 monReservoir,
        uint256 linkTreasury,
        uint256 linkReservoir,
        uint256 monCapacity,
        uint256 linkCapacity
    ) {
        uint256 monTotal = address(this).balance;
        uint256 linkTotal = LINK.balanceOf(address(this));
        
        monReservoir = monRes.dispensablePool;
        linkReservoir = linkRes.dispensablePool;
        
        monTreasury = monTotal > monReservoir ? monTotal - monReservoir : 0;
        linkTreasury = linkTotal > linkReservoir ? linkTotal - linkReservoir : 0;
        
        monCapacity = monReservoirCapacity;
        linkCapacity = linkReservoirCapacity;
        
        return (monTreasury, monReservoir, linkTreasury, linkReservoir, monCapacity, linkCapacity);
    }
} 
