// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
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

    /// @notice Creates a treasure at a random encrypted location (only owner)
    /// @dev Uses FHEVM's cryptographically secure random number generation
    function createTreasure() external onlyOwner {
        require(!isTreasureSet, "Treasure is already set!");

        // Generate encrypted random coordinates using FHEVM's secure RNG
        // For a treasure hunt game, we can use coordinates 0-63 (8x8 grid)
        secretX = FHE.randEuint8(64); // Random number between 0-63
        secretY = FHE.randEuint8(64); // Random number between 0-63

        isTreasureSet = true;
        emit TreasureCreated();
    }

    /// @notice Submit an encrypted guess for the treasure location
    /// @param inputX the encrypted X coordinate input
    /// @param inputY the encrypted Y coordinate input
    /// @param proofX the input proof for X coordinate
    /// @param proofY the input proof for Y coordinate
    function guess(
        externalEuint8 inputX,
        externalEuint8 inputY,
        bytes calldata proofX,
        bytes calldata proofY
    ) external {
        require(isTreasureSet, "Treasure has not been set yet!");

        euint8 guessX = FHE.fromExternal(inputX, proofX);
        euint8 guessY = FHE.fromExternal(inputY, proofY);

        // Calculate absolute differences using FHE.max and FHE.sub for X and Y axes
        euint8 distX = FHE.max(FHE.sub(guessX, secretX), FHE.sub(secretX, guessX));
        euint8 distY = FHE.max(FHE.sub(guessY, secretY), FHE.sub(secretY, guessY));

        // Calculate Manhattan distance using FHE.add
        euint8 distance = FHE.add(distX, distY);

        // Critical step: Grant msg.sender permission to decrypt this distance value on-chain
        // Without this line, the Relayer will reject the user's off-chain decryption request
        FHE.allow(distance, msg.sender);
        FHE.allowThis(distance);

        // Store the encrypted distance with decryption permission in the mapping
        userDistances[msg.sender] = distance;

        emit GuessSubmitted(msg.sender);

        // Check if treasure is found (distance == 0)
        // Note: This check happens on encrypted values, maintaining privacy
        euint8 zero = FHE.asEuint8(0);
        // In a more advanced implementation, you could emit TreasureFound event
        // when distance equals zero, but this would require additional FHE operations
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