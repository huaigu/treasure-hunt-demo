import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact with TreasureHunt Contract
 * ========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the TreasureHunt contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the TreasureHunt contract
 *
 *   npx hardhat --network localhost treasure:create
 *   npx hardhat --network localhost treasure:guess --x 5 --y 7
 *   npx hardhat --network localhost treasure:decrypt-distance
 *   npx hardhat --network localhost treasure:status
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost treasure:address
 *   - npx hardhat --network sepolia treasure:address
 */
task("treasure:address", "Prints the TreasureHunt address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const treasureHunt = await deployments.get("TreasureHunt");

  console.log("TreasureHunt address is " + treasureHunt.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost treasure:create
 *   - npx hardhat --network sepolia treasure:create
 */
task("treasure:create", "Creates a treasure at a random location (owner only)")
  .addOptionalParam("address", "Optionally specify the TreasureHunt contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const treasureHuntDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TreasureHunt");
    console.log(`TreasureHunt: ${treasureHuntDeployment.address}`);

    const signers = await ethers.getSigners();
    const treasureHuntContract = await ethers.getContractAt("TreasureHunt", treasureHuntDeployment.address);

    const tx = await treasureHuntContract.connect(signers[0]).createTreasure();
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log("Treasure created successfully!");
  });

/**
 * Example:
 *   - npx hardhat --network localhost treasure:guess --x 5 --y 7
 *   - npx hardhat --network sepolia treasure:guess --x 10 --y 15
 */
task("treasure:guess", "Submit a guess for the treasure location")
  .addOptionalParam("address", "Optionally specify the TreasureHunt contract address")
  .addParam("x", "The X coordinate guess (0-255)")
  .addParam("y", "The Y coordinate guess (0-255)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const x = parseInt(taskArguments.x);
    const y = parseInt(taskArguments.y);

    if (!Number.isInteger(x) || x < 0 || x > 255) {
      throw new Error("Argument --x must be an integer between 0 and 255");
    }
    if (!Number.isInteger(y) || y < 0 || y > 255) {
      throw new Error("Argument --y must be an integer between 0 and 255");
    }

    await fhevm.initializeCLIApi();

    const treasureHuntDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TreasureHunt");
    console.log(`TreasureHunt: ${treasureHuntDeployment.address}`);

    const signers = await ethers.getSigners();
    const treasureHuntContract = await ethers.getContractAt("TreasureHunt", treasureHuntDeployment.address);

    // Encrypt the coordinates
    const encryptedX = await fhevm
      .createEncryptedInput(treasureHuntDeployment.address, signers[0].address)
      .add8(x)
      .encrypt();

    const encryptedY = await fhevm
      .createEncryptedInput(treasureHuntDeployment.address, signers[0].address)
      .add8(y)
      .encrypt();

    console.log(`Making guess at coordinates (${x}, ${y})...`);

    const tx = await treasureHuntContract
      .connect(signers[0])
      .guess(
        encryptedX.handles[0],
        encryptedY.handles[0],
        encryptedX.inputProof,
        encryptedY.inputProof
      );
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log(`Guess submitted successfully for coordinates (${x}, ${y})!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost treasure:decrypt-distance
 *   - npx hardhat --network sepolia treasure:decrypt-distance
 */
task("treasure:decrypt-distance", "Decrypt your latest distance result")
  .addOptionalParam("address", "Optionally specify the TreasureHunt contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const treasureHuntDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TreasureHunt");
    console.log(`TreasureHunt: ${treasureHuntDeployment.address}`);

    const signers = await ethers.getSigners();
    const treasureHuntContract = await ethers.getContractAt("TreasureHunt", treasureHuntDeployment.address);

    const encryptedDistance = await treasureHuntContract.getMyDistance();
    if (encryptedDistance === ethers.ZeroHash) {
      console.log("No guess has been made yet");
      return;
    }

    const clearDistance = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedDistance,
      treasureHuntDeployment.address,
      signers[0],
    );

    console.log(`Encrypted distance: ${encryptedDistance}`);
    console.log(`Clear distance    : ${clearDistance}`);

    if (clearDistance === 0) {
      console.log("🎉 CONGRATULATIONS! You found the treasure!");
    } else if (clearDistance <= 2) {
      console.log("🔥 Very close! You're getting warmer!");
    } else if (clearDistance <= 5) {
      console.log("🌡️  Getting warmer...");
    } else if (clearDistance <= 10) {
      console.log("❄️  Getting colder...");
    } else {
      console.log("🧊 Very cold! Try a different area.");
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost treasure:status
 *   - npx hardhat --network sepolia treasure:status
 */
task("treasure:status", "Check the current game status")
  .addOptionalParam("address", "Optionally specify the TreasureHunt contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const treasureHuntDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TreasureHunt");
    console.log(`TreasureHunt: ${treasureHuntDeployment.address}`);

    const treasureHuntContract = await ethers.getContractAt("TreasureHunt", treasureHuntDeployment.address);

    const isTreasureReady = await treasureHuntContract.isTreasureReady();

    console.log(`Treasure is ready: ${isTreasureReady ? "Yes" : "No"}`);

    if (!isTreasureReady) {
      console.log("The owner needs to create a treasure first!");
    } else {
      console.log("Game is ready! You can start making guesses.");
    }
  });

/**
 * Example (owner only):
 *   - npx hardhat --network localhost treasure:reset
 *   - npx hardhat --network sepolia treasure:reset
 */
task("treasure:reset", "Reset the game (owner only)")
  .addOptionalParam("address", "Optionally specify the TreasureHunt contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const treasureHuntDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TreasureHunt");
    console.log(`TreasureHunt: ${treasureHuntDeployment.address}`);

    const signers = await ethers.getSigners();
    const treasureHuntContract = await ethers.getContractAt("TreasureHunt", treasureHuntDeployment.address);

    const tx = await treasureHuntContract.connect(signers[0]).resetGame();
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log("Game reset successfully!");
  });