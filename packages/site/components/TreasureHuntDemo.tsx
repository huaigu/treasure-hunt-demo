"use client";

import { useFhevm } from "@fhevm/react";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useTreasureHunt } from "../hooks/useTreasureHunt";
import { useState } from "react";
import { errorNotDeployed } from "./ErrorNotDeployed";

// FHEVM Network Configuration
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_HEX = '0xaa36a7';
const SEPOLIA_NETWORK_NAME = 'Sepolia';

// Network validation functions
const isSepoliaNetwork = (chainId: number | undefined): boolean => {
  return chainId === SEPOLIA_CHAIN_ID;
};

/*
 * Main TreasureHunt React component for the encrypted treasure hunt game
 *  - Interactive 8x8 grid for coordinate selection
 *  - "Connect Wallet" integration with MetaMask
 *  - "Create Treasure" button for game owners
 *  - "Make Guess" functionality with encrypted coordinates
 *  - "Decrypt Distance" to reveal proximity feedback
 */
export const TreasureHuntDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const [selectedPosition, setSelectedPosition] = useState<{x: number, y: number} | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);

  const {
    provider,
    chainId,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = useMetaMaskEthersSigner();

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance - Only enable for Sepolia network
  //////////////////////////////////////////////////////////////////////////////

  const isOnSepolia = isSepoliaNetwork(chainId);
  const fhevmEnabled = isConnected && isOnSepolia;

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId: isOnSepolia ? chainId : undefined,
    enabled: fhevmEnabled,
  });

  //////////////////////////////////////////////////////////////////////////////
  // useTreasureHunt contains all the treasure hunt game logic, including:
  // - calling the TreasureHunt contract
  // - encrypting FHE inputs
  // - decrypting FHE distance results
  //////////////////////////////////////////////////////////////////////////////

  const treasureHunt = useTreasureHunt({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  //////////////////////////////////////////////////////////////////////////////
  // UI Components and Styling
  //////////////////////////////////////////////////////////////////////////////

  const titleClass = "font-semibold text-foreground text-lg mt-4";

  // Handle grid cell click - always allow selection, even without wallet
  const handleGridClick = (x: number, y: number) => {
    setSelectedPosition({ x, y });
  };

  // Handle MetaMask connection with loading state
  const handleConnect = async (): Promise<void> => {
    setIsConnecting(true);
    try {
      // Call connect without await since it handles its own async operations
      connect();
    } catch (error) {
      console.error('Failed to connect to MetaMask:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle network switch to Sepolia
  const handleSwitchToSepolia = async (): Promise<void> => {
    if (!provider) return;

    setIsSwitchingNetwork(true);
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
    } catch (error: unknown) {
      console.error('Failed to switch to Sepolia:', error);

      // If the network doesn't exist, add it
      if (error && typeof error === 'object' && 'code' in error && error.code === 4902) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: SEPOLIA_CHAIN_HEX,
              chainName: SEPOLIA_NETWORK_NAME,
              rpcUrls: ['https://sepolia.infura.io/v3/'],
              nativeCurrency: {
                name: 'ETH',
                symbol: 'ETH',
                decimals: 18,
              },
            }],
          });
        } catch (addError) {
          console.error('Failed to add Sepolia network:', addError);
        }
      }
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  // Make guess with selected position
  const makeGuessAtSelectedPosition = async () => {
    if (!selectedPosition) return;
    await treasureHunt.makeGuess(selectedPosition.x, selectedPosition.y);
    setSelectedPosition(null); // Clear selection after guess
  };

  // Convert grid index to x,y coordinates (8x8 grid)
  const indexToCoords = (index: number) => {
    return { x: index % 8, y: Math.floor(index / 8) };
  };

  // Get distance color based on value
  const getDistanceColor = (distance: number) => {
    if (distance === 0) return 'bg-yellow-400 glow-accent'; // Treasure found!
    if (distance === -1) return 'bg-gray-500/50'; // Not decrypted yet
    if (distance <= 2) return 'bg-red-500 glow-destructive'; // Very close
    if (distance <= 5) return 'bg-orange-500'; // Close
    if (distance <= 10) return 'bg-yellow-500'; // Medium
    return 'bg-blue-500'; // Far
  };

  // Check if a position has been guessed
  const getGuessAtPosition = (x: number, y: number) => {
    return treasureHunt.guessHistory.find(guess => guess.x === x && guess.y === y);
  };

  // Show error if contract is not deployed
  if (isConnected && isOnSepolia && treasureHunt.isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
            Experience <span className="gradient-text">FHE Magic</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch how encrypted data is processed by smart contracts without revealing privacy
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Frontend Simulation */}
          <div className="bg-card rounded-lg shadow-lg border border-border p-6">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-6 h-6 bg-primary rounded-full" />
              <h3 className="text-xl font-semibold text-card-foreground">Treasure Hunt DApp</h3>
            </div>
            <div className="space-y-6">
              {/* Game Grid */}
              <div className="bg-muted rounded-lg p-6">
                <div className="text-center mb-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    8×8 Treasure Hunt Grid
                  </h4>
                  {treasureHunt.isTreasureReady && !selectedPosition && (
                    <p className="text-xs text-primary animate-pulse">
                      👆 Click on any square to select coordinates for your guess
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-8 gap-1 max-w-80 mx-auto">
                  {Array.from({ length: 64 }, (_, index) => {
                    const coords = indexToCoords(index);
                    const isSelected = selectedPosition &&
                      selectedPosition.x === coords.x &&
                      selectedPosition.y === coords.y;

                    // Check if this position has been guessed
                    const guess = getGuessAtPosition(coords.x, coords.y);
                    const isGuessed = !!guess;
                    const distance = guess?.distance;

                    return (
                      <div
                        key={index}
                        className={`w-9 h-9 rounded-sm transition-all duration-300 flex items-center justify-center text-xs font-bold cursor-pointer hover:opacity-80 ${
                          isGuessed && distance !== undefined
                            ? getDistanceColor(distance)
                            : isSelected
                            ? 'bg-primary ring-2 ring-primary/30 glow-primary'
                            : 'bg-muted-foreground/30 hover:bg-primary/60'
                        }`}
                        onClick={() => handleGridClick(coords.x, coords.y)}
                        title={
                          isGuessed && distance !== undefined
                            ? distance === 0
                              ? `TREASURE FOUND! (${coords.x}, ${coords.y})`
                              : distance === -1
                              ? `Guessed (${coords.x}, ${coords.y}) - Click "Decrypt Distance"`
                              : `Guessed (${coords.x}, ${coords.y}) - Distance: ${distance}`
                            : `Position (${coords.x}, ${coords.y})`
                        }
                      >
                        {isGuessed && distance !== undefined && (
                          <span className="text-white drop-shadow-md">
                            {distance === 0 ? '🏆' : distance === -1 ? '?' : distance}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 text-center">
                  {selectedPosition && (
                    <div className="text-primary font-medium">
                      Selected: ({selectedPosition.x}, {selectedPosition.y})
                    </div>
                  )}
                  {treasureHunt.decryptedDistance !== undefined && (
                    <div className="text-accent font-medium">
                      🎯 Distance: {treasureHunt.decryptedDistance}
                    </div>
                  )}
                </div>
              </div>

              {/* Connection and Action Buttons */}
              <div className="space-y-3">
                {!isConnected && (
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-colors duration-200 glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConnecting ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                        Connecting...
                      </span>
                    ) : (
                      'Connect to MetaMask'
                    )}
                  </button>
                )}

                {/* Network Switch Warning */}
                {isConnected && !isOnSepolia && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                    <div className="text-center space-y-3">
                      <p className="text-sm text-destructive font-medium">
                        ⚠️ Wrong Network Detected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        FHEVM requires Sepolia network. Current: {chainId === 31337 ? 'Local' : chainId === 1 ? 'Mainnet' : `Chain ${chainId}`}
                      </p>
                      <button
                        onClick={handleSwitchToSepolia}
                        disabled={isSwitchingNetwork}
                        className="w-full bg-destructive hover:bg-destructive/80 text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSwitchingNetwork ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin"></div>
                            Switching to Sepolia...
                          </span>
                        ) : (
                          'Switch to Sepolia Network'
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isOnSepolia && treasureHunt.isTreasureReady && (
                  <button
                    className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 glow-primary"
                    disabled={!isConnected || !isOnSepolia || !treasureHunt.canMakeGuess || !fhevmInstance || !selectedPosition}
                    onClick={makeGuessAtSelectedPosition}
                  >
                    {!isConnected
                      ? "Connect Wallet to Make Guess"
                      : !fhevmInstance
                        ? "FHEVM Loading..."
                        : !selectedPosition
                          ? "Select Coordinates to Make Guess"
                          : treasureHunt.isMakingGuess
                            ? (
                              <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
                                Making Guess...
                              </span>
                            )
                            : `Make Guess at (${selectedPosition.x}, ${selectedPosition.y})`}
                  </button>
                )}

                {treasureHunt.isTreasureReady && (treasureHunt.canDecrypt || treasureHunt.encryptedDistance) && isOnSepolia && (
                  <button
                    className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 glow-accent"
                    disabled={!isConnected || !isOnSepolia || !treasureHunt.canDecrypt || !fhevmInstance}
                    onClick={treasureHunt.decryptDistance}
                  >
                    {!isConnected
                      ? "Connect Wallet to Decrypt Distance"
                      : !fhevmInstance
                        ? "FHEVM Loading..."
                        : treasureHunt.isDecrypting
                          ? "Decrypting..."
                          : "Decrypt Distance"}
                  </button>
                )}

                {isConnected && isOnSepolia && treasureHunt.isTreasureReady === false && (
                  <button
                    className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 glow-primary"
                    disabled={!isConnected || !isOnSepolia || !treasureHunt.canCreateTreasure || !fhevmInstance}
                    onClick={treasureHunt.createTreasure}
                  >
                    {!isConnected
                      ? "Connect Wallet to Create Treasure"
                      : !fhevmInstance
                        ? "FHEVM Loading..."
                        : !treasureHunt.isOwner
                          ? "Create Treasure (Owner Only)"
                          : treasureHunt.isCreatingTreasure
                            ? "Creating Treasure..."
                            : "Create Treasure"}
                  </button>
                )}
              </div>

              {/* Status Message */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <p className="text-sm text-primary">
                  {!isConnected
                    ? "Connect your wallet to start playing the treasure hunt game"
                    : !isOnSepolia
                      ? "Please switch to Sepolia network to enable FHEVM functionality"
                      : !fhevmInstance
                        ? "Initializing FHEVM instance for encrypted computation..."
                        : treasureHunt.message || "FHEVM treasure hunt is ready! Select coordinates to make a guess."}
                </p>
              </div>
            </div>
          </div>

          {/* Game Status and Info */}
          <div className="space-y-6">
            {/* Game Status */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h2 className="text-xl font-semibold mb-4 text-card-foreground">Game Status</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Wallet Connected:</span>
                  <span className={isConnected ? "text-accent font-semibold" : "text-destructive"}>
                    {isConnected ? "Yes" : "No"}
                  </span>
                </div>

                {isConnected && chainId && (
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span className={`font-mono ${isOnSepolia ? "text-accent font-semibold" : "text-destructive"}`}>
                      {chainId === 31337 ? "Local (31337)" :
                       chainId === 11155111 ? "Sepolia (11155111)" :
                       chainId === 1 ? "Mainnet (1)" :
                       `Chain ${chainId}`}
                      {isOnSepolia && " ✅"}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>FHEVM Instance:</span>
                  <span className={fhevmInstance ? "text-accent font-semibold" : "text-destructive"}>
                    {fhevmInstance ? "Ready" : fhevmEnabled ? "Loading..." : "Disabled"}
                  </span>
                </div>

                {fhevmStatus && (
                  <div className="flex justify-between">
                    <span>FHEVM Status:</span>
                    <span className="font-mono text-muted-foreground">
                      {fhevmStatus}
                    </span>
                  </div>
                )}

                {fhevmError && (
                  <div className="flex justify-between">
                    <span>FHEVM Error:</span>
                    <span className="font-mono text-destructive text-xs">
                      {fhevmError.message}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Treasure Ready:</span>
                  <span className={treasureHunt.isTreasureReady ? "text-accent font-semibold" : "text-destructive"}>
                    {treasureHunt.isTreasureReady ? "Yes" : "No"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>You are Owner:</span>
                  <span className={treasureHunt.isOwner ? "text-primary font-semibold" : "text-muted-foreground"}>
                    {treasureHunt.isOwner ? "Yes" : "No"}
                  </span>
                </div>

                {treasureHunt.decryptedDistance !== undefined && (
                  <div className="flex justify-between">
                    <span>Distance to Treasure:</span>
                    <span className="font-semibold text-primary">
                      {treasureHunt.decryptedDistance}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Guess History */}
            {treasureHunt.guessHistory.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-card-foreground">Guess History</h2>
                  <button
                    onClick={treasureHunt.clearHistory}
                    className="text-xs px-3 py-1 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {treasureHunt.guessHistory.slice().reverse().map((guess) => (
                    <div
                      key={`${guess.x}-${guess.y}-${guess.timestamp}`}
                      className="flex justify-between items-center text-sm p-2 bg-muted rounded"
                    >
                      <span className="font-mono text-muted-foreground">
                        ({guess.x}, {guess.y})
                      </span>
                      <span className={`font-bold ${
                        guess.distance === 0 ? 'text-yellow-500' :
                        guess.distance === -1 ? 'text-gray-500' :
                        guess.distance <= 2 ? 'text-red-500' :
                        guess.distance <= 5 ? 'text-orange-500' :
                        guess.distance <= 10 ? 'text-yellow-600' :
                        'text-blue-500'
                      }`}>
                        {guess.distance === 0 ? '🏆 Found!' :
                         guess.distance === -1 ? '? Pending' :
                         `Distance: ${guess.distance}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-primary/5 rounded-lg border border-primary/20 p-6">
              <h2 className="text-xl font-semibold mb-4 text-primary">How to Play</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-primary/80">
                <li>Owner creates a treasure at a random encrypted location</li>
                <li>Players click on grid cells to select coordinates</li>
                <li>Click &ldquo;Make Guess&rdquo; to submit encrypted coordinates</li>
                <li>Click &ldquo;Decrypt Distance&rdquo; to see how close you are</li>
                <li>Distance 0 means you found the treasure! 🎉</li>
              </ol>
            </div>

            {/* Current Message */}
            <div className="bg-muted rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-foreground">Status</h3>
              <p className="text-sm text-muted-foreground">
                {treasureHunt.message}
              </p>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {/* Chain Info */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className={titleClass}>Chain Info</h3>
            {printProperty("Chain ID", chainId)}
            {printProperty("Contract Address", treasureHunt.contractAddress)}
            {printProperty("Is Deployed", treasureHunt.isDeployed)}
          </div>

          {/* FHEVM Instance */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className={titleClass}>FHEVM Instance</h3>
            {printProperty("Instance", fhevmInstance ? "Ready" : "Loading")}
            {printProperty("Status", fhevmStatus)}
            {printProperty("Error", fhevmError ?? "None")}
          </div>

          {/* Game Data */}
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className={titleClass}>Game Data</h3>
            {printProperty("Encrypted Distance", formatEncryptedDistance(treasureHunt.encryptedDistance))}
            {printProperty("Is Decrypted", treasureHunt.isDecrypted)}
            {printProperty("Can Make Guess", treasureHunt.canMakeGuess)}
          </div>
        </div>

        {/* Owner Controls */}
        {treasureHunt.isOwner && (
          <div className="mt-8 bg-accent/5 rounded-lg border border-accent/20 p-6">
            <h3 className="text-xl font-semibold mb-4 text-accent">Owner Controls</h3>
            <div className="flex gap-4">
              <button
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
                onClick={treasureHunt.refreshGameState}
                disabled={!treasureHunt.canRefresh}
              >
                {treasureHunt.isRefreshing ? "Refreshing..." : "Refresh Game"}
              </button>

              <button
                className="inline-flex items-center justify-center rounded-xl bg-destructive px-4 py-3 font-semibold text-destructive-foreground shadow-sm transition-colors duration-200 hover:bg-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50 disabled:pointer-events-none"
                onClick={treasureHunt.resetGame}
                disabled={!isConnected || !treasureHunt.isOwner || treasureHunt.isCreatingTreasure}
                title={!treasureHunt.isOwner ? "Only contract owner can reset the game" : "Reset the treasure hunt game"}
              >
                {!treasureHunt.isOwner ? "Reset Game (Owner Only)" : "Reset Game"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// Helper functions for debug info display
function formatEncryptedDistance(value: string | undefined): string {
  if (!value || value === "None") return "None";
  if (value === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return "0x0000...0000 (Empty)";
  }
  if (value.length > 20) {
    return `${value.substring(0, 10)}...${value.substring(value.length - 6)}`;
  }
  return value;
}

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }

  return (
    <p className="text-card-foreground text-xs">
      {name}:{" "}
      <span className="font-mono font-semibold text-card-foreground">{displayValue}</span>
    </p>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  if (value) {
    return (
      <p className="text-card-foreground text-xs">
        {name}:{" "}
        <span className="font-mono font-semibold text-accent">true</span>
      </p>
    );
  }

  return (
    <p className="text-card-foreground text-xs">
      {name}:{" "}
      <span className="font-mono font-semibold text-destructive">false</span>
    </p>
  );
}