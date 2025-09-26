import { FhevmInstance, FhevmDecryptionSignature, type GenericStringStorage } from "@fhevm/react";
import { Contract, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { TreasureHuntABI } from "../abi/TreasureHuntABI";
import { TreasureHuntAddresses } from "../abi/TreasureHuntAddresses";

export interface UseTreasureHuntOptions {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: any;
  chainId: number | undefined;
  ethersSigner: any;
  ethersReadonlyProvider: any;
  sameChain: any;
  sameSigner: any;
}

export interface TreasureHuntHook {
  // Contract Info
  contractAddress: string;
  isDeployed: boolean | undefined;

  // Game State
  isTreasureReady: boolean | undefined;
  isOwner: boolean;

  // Current Distance
  encryptedDistance: string | undefined;
  decryptedDistance: number | undefined;
  isDecrypted: boolean;

  // UI States
  isRefreshing: boolean;
  isDecrypting: boolean;
  isCreatingTreasure: boolean;
  isMakingGuess: boolean;

  // Capabilities
  canCreateTreasure: boolean;
  canMakeGuess: boolean;
  canDecrypt: boolean;
  canRefresh: boolean;

  // Actions
  createTreasure: () => Promise<void>;
  makeGuess: (x: number, y: number) => Promise<void>;
  decryptDistance: () => Promise<void>;
  refreshGameState: () => Promise<void>;
  resetGame: () => Promise<void>;

  // Status
  message: string;
}

export function useTreasureHunt({
  instance,
  fhevmDecryptionSignatureStorage,
  eip1193Provider,
  chainId,
  ethersSigner,
  ethersReadonlyProvider,
  sameChain,
  sameSigner,
}: UseTreasureHuntOptions): TreasureHuntHook {
  // Contract info
  const contractAddress = useMemo(() => {
    if (!chainId) return "";
    const chainIdStr = chainId.toString() as keyof typeof TreasureHuntAddresses;
    return TreasureHuntAddresses[chainIdStr]?.address || "";
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!chainId) return undefined;
    const chainIdStr = chainId.toString() as keyof typeof TreasureHuntAddresses;
    const addr = TreasureHuntAddresses[chainIdStr]?.address;
    return addr ? addr !== "0x0000000000000000000000000000000000000000" : false;
  }, [chainId]);

  // State
  const [isTreasureReady, setIsTreasureReady] = useState<boolean | undefined>(undefined);
  const [isOwner, setIsOwner] = useState(false);
  const [encryptedDistance, setEncryptedDistance] = useState<string | undefined>();
  const [decryptedDistance, setDecryptedDistance] = useState<number | undefined>();
  const [isDecrypted, setIsDecrypted] = useState(false);

  // UI states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isCreatingTreasure, setIsCreatingTreasure] = useState(false);
  const [isMakingGuess, setIsMakingGuess] = useState(false);
  const [message, setMessage] = useState("Connect wallet to start playing");

  // Capabilities
  const canCreateTreasure = useMemo(() => {
    return !isCreatingTreasure && isOwner && isDeployed && sameChain && sameSigner && !isTreasureReady;
  }, [isCreatingTreasure, isOwner, isDeployed, sameChain, sameSigner, isTreasureReady]);

  const canMakeGuess = useMemo(() => {
    return !isMakingGuess && isDeployed && sameChain && sameSigner && isTreasureReady && instance;
  }, [isMakingGuess, isDeployed, sameChain, sameSigner, isTreasureReady, instance]);

  const canDecrypt = useMemo(() => {
    return !isDecrypting && !!encryptedDistance && !isDecrypted && !!instance;
  }, [isDecrypting, encryptedDistance, isDecrypted, instance]);

  const canRefresh = useMemo(() => {
    return !isRefreshing && isDeployed && sameChain;
  }, [isRefreshing, isDeployed, sameChain]);

  // Contract instance
  const contract = useMemo(() => {
    if (!contractAddress || !ethersReadonlyProvider) return null;
    return new Contract(contractAddress, TreasureHuntABI.abi, ethersReadonlyProvider);
  }, [contractAddress, ethersReadonlyProvider]);

  const contractWithSigner = useMemo(() => {
    if (!contractAddress || !ethersSigner) return null;
    return new Contract(contractAddress, TreasureHuntABI.abi, ethersSigner);
  }, [contractAddress, ethersSigner]);

  // Check ownership
  useEffect(() => {
    if (!contract || !ethersSigner) return;

    const checkOwnership = async () => {
      try {
        const owner = await contract.owner();
        const signerAddress = await ethersSigner.getAddress();
        setIsOwner(owner.toLowerCase() === signerAddress.toLowerCase());
      } catch (error) {
        console.error("Error checking ownership:", error);
        setIsOwner(false);
      }
    };

    checkOwnership();
  }, [contract, ethersSigner]);

  // Refresh game state
  const refreshGameState = async () => {
    if (!contract) return;

    setIsRefreshing(true);
    setMessage("Refreshing game state...");

    try {
      // Check if treasure is ready
      const treasureReady = await contract.isTreasureReady();
      setIsTreasureReady(treasureReady);

      if (ethersSigner) {
        // Get user's encrypted distance if exists
        const userAddress = await ethersSigner.getAddress();
        const userDistance = await contract.userDistances(userAddress);

        if (userDistance && userDistance !== "0x0000000000000000000000000000000000000000") {
          setEncryptedDistance(userDistance);
          setIsDecrypted(false);
          setMessage("Click 'Decrypt Distance' to see how close you are");
        } else if (treasureReady) {
          setMessage("Click on the grid to make your guess");
        } else {
          setMessage(isOwner ? "Create treasure to start the game" : "Waiting for treasure to be created");
        }
      }
    } catch (error) {
      console.error("Error refreshing game state:", error);
      setMessage("Error refreshing game state");
    }

    setIsRefreshing(false);
  };

  // Auto-refresh on load
  useEffect(() => {
    if (canRefresh) {
      refreshGameState();
    }
  }, [canRefresh]);

  // Create treasure
  const createTreasure = async () => {
    if (!contractWithSigner || !canCreateTreasure) return;

    setIsCreatingTreasure(true);
    setMessage("Creating treasure...");

    try {
      const tx = await contractWithSigner.createTreasure();
      setMessage("Transaction submitted, waiting for confirmation...");

      await tx.wait();
      setMessage("Treasure created successfully!");

      // Refresh state
      await refreshGameState();
    } catch (error) {
      console.error("Error creating treasure:", error);
      setMessage("Error creating treasure");
    }

    setIsCreatingTreasure(false);
  };

  // Make guess
  const makeGuess = async (x: number, y: number) => {
    if (!contractWithSigner || !instance || !canMakeGuess) return;

    setIsMakingGuess(true);
    setMessage(`Making guess at position (${x}, ${y})...`);

    try {
      // Encrypt coordinates
      const signerAddress = await ethersSigner!.getAddress();

      const encryptedInputX = await instance
        .createEncryptedInput(contractAddress, signerAddress)
        .add8(x)
        .encrypt();

      const encryptedInputY = await instance
        .createEncryptedInput(contractAddress, signerAddress)
        .add8(y)
        .encrypt();

      setMessage("Submitting encrypted guess...");

      const tx = await contractWithSigner.guess(
        encryptedInputX.handles[0],
        encryptedInputY.handles[0],
        encryptedInputX.inputProof,
        encryptedInputY.inputProof
      );

      setMessage("Transaction submitted, waiting for confirmation...");
      await tx.wait();

      setMessage("Guess submitted successfully! Click 'Decrypt Distance' to see the result.");

      // Refresh to get the new encrypted distance
      await refreshGameState();
    } catch (error) {
      console.error("Error making guess:", error);
      setMessage("Error making guess");
    }

    setIsMakingGuess(false);
  };

  // Decrypt distance
  const decryptDistance = async () => {
    if (!instance || !encryptedDistance || !canDecrypt) return;

    setIsDecrypting(true);
    setMessage("Decrypting distance...");

    try {
      const sig: FhevmDecryptionSignature | null = await FhevmDecryptionSignature.loadOrSign(
        instance,
        [contractAddress as `0x${string}`],
        ethersSigner!,
        fhevmDecryptionSignatureStorage
      );

      if (!sig) {
        setMessage("Unable to build FHEVM decryption signature");
        return;
      }

      setMessage("Call FHEVM userDecrypt...");

      const res = await instance.userDecrypt(
        [{ handle: encryptedDistance, contractAddress: contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );

      const decrypted = Number(res[encryptedDistance]);
      setDecryptedDistance(decrypted);
      setIsDecrypted(true);

      setMessage("FHEVM userDecrypt completed!");

      // Set message based on distance
      if (decrypted === 0) {
        setMessage("🎉 CONGRATULATIONS! You found the treasure!");
      } else if (decrypted <= 2) {
        setMessage(`🔥 Very close! Distance: ${decrypted}`);
      } else if (decrypted <= 5) {
        setMessage(`🌡️ Getting warmer... Distance: ${decrypted}`);
      } else if (decrypted <= 10) {
        setMessage(`❄️ Getting colder... Distance: ${decrypted}`);
      } else {
        setMessage(`🧊 Very cold! Distance: ${decrypted}`);
      }
    } catch (error) {
      console.error("Error decrypting distance:", error);
      setMessage("Error decrypting distance");
    }

    setIsDecrypting(false);
  };

  // Reset game (owner only)
  const resetGame = async () => {
    if (!contractWithSigner || !isOwner) return;

    setMessage("Resetting game...");

    try {
      const tx = await contractWithSigner.resetGame();
      await tx.wait();

      setMessage("Game reset successfully!");
      setEncryptedDistance(undefined);
      setDecryptedDistance(undefined);
      setIsDecrypted(false);

      await refreshGameState();
    } catch (error) {
      console.error("Error resetting game:", error);
      setMessage("Error resetting game");
    }
  };

  return {
    // Contract Info
    contractAddress,
    isDeployed,

    // Game State
    isTreasureReady,
    isOwner,

    // Current Distance
    encryptedDistance,
    decryptedDistance,
    isDecrypted,

    // UI States
    isRefreshing,
    isDecrypting,
    isCreatingTreasure,
    isMakingGuess,

    // Capabilities
    canCreateTreasure,
    canMakeGuess,
    canDecrypt,
    canRefresh,

    // Actions
    createTreasure,
    makeGuess,
    decryptDistance,
    refreshGameState,
    resetGame,

    // Status
    message,
  };
}