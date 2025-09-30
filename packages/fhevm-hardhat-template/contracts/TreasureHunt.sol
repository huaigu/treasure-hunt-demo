// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title A treasure hunt game using fully homomorphic encryption
/// @author ZAMA FHEVM Treasure Hunt Demo
/// @notice Players guess encrypted coordinates to find a hidden treasure, with encrypted distance feedback
contract TreasureHunt is Ownable, SepoliaConfig {
    euint8 private secretX;
    euint8 private secretY;
    bool private isTreasureSet; // Flag to track if treasure has been created

    // Mapping to store each player's latest encrypted distance
    // Declared as public so Solidity automatically creates a getter function
    mapping(address => euint8) public userDistances;

    event TreasureCreated();
    event GuessSubmitted(address indexed player);
    event TreasureFound(address indexed winner);

    // Constructor calls Ownable constructor, setting the deployer as owner
    constructor() Ownable(msg.sender) {}

   function createTreasure() external onlyOwner {
        require(!isTreasureSet, "Treasure is already set!");

        // Generate full-domain random and reduce to 0..7 so it's in same domain as later computations
        // randEuint8() -> full-domain euint8; rem expects a plaintext divisor
        secretX = FHE.rem(FHE.randEuint8(), 8);
        secretY = FHE.rem(FHE.randEuint8(), 8);

        isTreasureSet = true;
        emit TreasureCreated();
    }

    /// @notice Submit an encrypted guess for the treasure location
    function guess(
        externalEuint8 inputX,
        externalEuint8 inputY,
        bytes calldata proofX,
        bytes calldata proofY
    ) external {
        require(isTreasureSet, "Treasure has not been set yet!");

        // Convert external inputs and reduce them to 0..7 to match secretX/secretY domain
        euint8 guessX = FHE.rem(FHE.fromExternal(inputX, proofX), 8);
        euint8 guessY = FHE.rem(FHE.fromExternal(inputY, proofY), 8);

        // X-axis absolute diff: do both orders and select based on comparison
        euint8 diffX1 = FHE.sub(guessX, secretX);
        euint8 diffX2 = FHE.sub(secretX, guessX);
        ebool condX = FHE.gt(guessX, secretX); // true when guessX > secretX
        euint8 distX = FHE.select(condX, diffX1, diffX2);

        // Y-axis absolute diff
        euint8 diffY1 = FHE.sub(guessY, secretY);
        euint8 diffY2 = FHE.sub(secretY, guessY);
        ebool condY = FHE.gt(guessY, secretY);
        euint8 distY = FHE.select(condY, diffY1, diffY2);

        // Manhattan distance
        euint8 distance = FHE.add(distX, distY);

        // Grant the caller persistent permission to decrypt/use the distance, and
        // optionally grant this contract permission to store/use it later.
        FHE.allow(distance, msg.sender);
        FHE.allow(distance, address(this));

        // Store distance handle in mapping (handle is encrypted)
        userDistances[msg.sender] = distance;

        emit GuessSubmitted(msg.sender);

        // Determine whether distance == 0 (treasure found) as encrypted boolean
        euint8 zero = FHE.asEuint8(0);
        ebool treasureFound = FHE.eq(distance, zero);

        // If you want to trigger an on-chain action when treasureFound is true,
        // remember you cannot `if (treasureFound)` on-chain — comparisons yield encrypted booleans.
        // Use FHE.select to create a side-effect-free encrypted value, or request decryption to learn plaintext.
    }


    /// @notice Simple test function that just adds coordinates together (for testing)
    /// @param inputX the encrypted X coordinate input
    /// @param inputY the encrypted Y coordinate input
    /// @param proofX the input proof for X coordinate
    /// @param proofY the input proof for Y coordinate
    function guessSimple(
        externalEuint8 inputX,
        externalEuint8 inputY,
        bytes calldata proofX,
        bytes calldata proofY
    ) external {
        require(isTreasureSet, "Treasure has not been set yet!");

        euint8 guessX = FHE.fromExternal(inputX, proofX);
        euint8 guessY = FHE.fromExternal(inputY, proofY);

        // SIMPLIFIED TEST VERSION: Just add the coordinates together
        euint8 simpleResult = FHE.add(guessX, guessY);

        // Grant permissions for decryption
        FHE.allow(simpleResult, msg.sender);
        FHE.allowThis(simpleResult);

        // Store the simple result as "distance" for testing
        userDistances[msg.sender] = simpleResult;

        emit GuessSubmitted(msg.sender);
    }

    /// @notice Get the encrypted distance for the caller
    /// @return The encrypted distance from the caller's last guess
    function getMyDistance() external view returns (euint8) {
        return userDistances[msg.sender];
    }

    /// @notice Check if treasure has been set by owner
    /// @return True if treasure location has been established
    function isTreasureReady() external view returns (bool) {
        return isTreasureSet;
    }

    /// @notice Reset the game (only owner)
    /// @dev Clears the treasure location and allows a new game to start
    function resetGame() external onlyOwner {
        // Note: We cannot easily clear the encrypted values or mappings
        // In a production contract, you might want to implement a game round system
        isTreasureSet = false;
    }

    /// @notice Get treasure coordinates (only owner, for testing)
    /// @dev This should only be used for testing/debugging purposes
    /// @return The encrypted X and Y coordinates of the treasure
    function getTreasureLocation() external view onlyOwner returns (euint8, euint8) {
        require(isTreasureSet, "Treasure not set yet");
        return (secretX, secretY);
    }
}