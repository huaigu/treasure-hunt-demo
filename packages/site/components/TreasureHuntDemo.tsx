"use client";

import { useFhevm } from "@fhevm/react";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useTreasureHunt } from "../hooks/useTreasureHunt";
import { useState } from "react";

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

  const {
    provider,
    chainId,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
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

  const titleClass = "font-semibold text-black text-lg mt-4";

  // Handle grid cell click - always allow selection, even without wallet
  const handleGridClick = (x: number, y: number) => {
    setSelectedPosition({ x, y });
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

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Experience <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">FHE Magic</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Watch how encrypted data is processed by smart contracts without revealing privacy
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Frontend Simulation */}
          <div className="bg-white rounded-lg shadow-lg border p-6">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-6 h-6 bg-blue-600 rounded-full" />
              <h3 className="text-xl font-semibold">Treasure Hunt DApp</h3>
            </div>
            <div className="space-y-6">
              {/* Game Grid */}
              <div className="bg-gray-100 rounded-lg p-6">
                <div className="grid grid-cols-8 gap-1 max-w-64 mx-auto">
                  {Array.from({ length: 64 }, (_, index) => {
                    const coords = indexToCoords(index);
                    const isSelected = selectedPosition &&
                      selectedPosition.x === coords.x &&
                      selectedPosition.y === coords.y;

                    // Show treasure at position 29 (for demo purposes)
                    const isTreasure = index === 29;

                    return (
                      <div
                        key={index}
                        className={`w-6 h-6 rounded-sm transition-all duration-300 ${
                          isTreasure ? 'bg-yellow-500 animate-pulse' :
                          isSelected ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-gray-300'
                        } cursor-pointer hover:bg-blue-400`}
                        onClick={() => handleGridClick(coords.x, coords.y)}
                        title={`Position (${coords.x}, ${coords.y})`}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 text-center">
                  {selectedPosition && (
                    <div className="text-blue-600 font-medium">
                      Selected: ({selectedPosition.x}, {selectedPosition.y})
                    </div>
                  )}
                  {treasureHunt.decryptedDistance !== undefined && (
                    <div className="text-green-600 font-medium">
                      🎯 Distance: {treasureHunt.decryptedDistance}
                    </div>
                  )}
                </div>
              </div>

              {/* Connection and Action Buttons */}
              <div className="space-y-3">
                {!isConnected && (
                  <button
                    onClick={connect}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
                  >
                    Connect to MetaMask
                  </button>
                )}

                {selectedPosition && (
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    disabled={!isConnected || !treasureHunt.canMakeGuess}
                    onClick={makeGuessAtSelectedPosition}
                  >
                    {!isConnected
                      ? `Connect Wallet to Guess at (${selectedPosition.x}, ${selectedPosition.y})`
                      : treasureHunt.isMakingGuess
                        ? "Making Guess..."
                        : `Make Guess at (${selectedPosition.x}, ${selectedPosition.y})`}
                  </button>
                )}

                {(treasureHunt.canDecrypt || treasureHunt.encryptedDistance) && (
                  <button
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    disabled={!isConnected || !treasureHunt.canDecrypt}
                    onClick={treasureHunt.decryptDistance}
                  >
                    {!isConnected
                      ? "Connect Wallet to Decrypt Distance"
                      : treasureHunt.isDecrypting
                        ? "Decrypting..."
                        : "Decrypt Distance"}
                  </button>
                )}

                {(treasureHunt.canCreateTreasure || treasureHunt.isOwner) && (
                  <button
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
                    disabled={!isConnected || !treasureHunt.canCreateTreasure}
                    onClick={treasureHunt.createTreasure}
                  >
                    {!isConnected
                      ? "Connect Wallet to Create Treasure"
                      : treasureHunt.isCreatingTreasure
                        ? "Creating Treasure..."
                        : "Create Treasure"}
                  </button>
                )}
              </div>

              {/* Status Message */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  {isConnected
                    ? treasureHunt.message
                    : "Connect your wallet to start playing the treasure hunt game"}
                </p>
              </div>
            </div>
          </div>

          {/* Game Status and Info */}
          <div className="space-y-6">
            {/* Game Status */}
            <div className="bg-white rounded-lg border-2 border-black p-6">
              <h2 className="text-xl font-semibold mb-4">Game Status</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Treasure Ready:</span>
                  <span className={treasureHunt.isTreasureReady ? "text-green-600 font-semibold" : "text-red-600"}>
                    {treasureHunt.isTreasureReady ? "Yes" : "No"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>You are Owner:</span>
                  <span className={treasureHunt.isOwner ? "text-blue-600 font-semibold" : "text-gray-600"}>
                    {treasureHunt.isOwner ? "Yes" : "No"}
                  </span>
                </div>

                {treasureHunt.decryptedDistance !== undefined && (
                  <div className="flex justify-between">
                    <span>Distance to Treasure:</span>
                    <span className="font-semibold text-blue-600">
                      {treasureHunt.decryptedDistance}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-6">
              <h2 className="text-xl font-semibold mb-4 text-blue-800">How to Play</h2>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                <li>Owner creates a treasure at a random encrypted location</li>
                <li>Players click on grid cells to select coordinates</li>
                <li>Click &ldquo;Make Guess&rdquo; to submit encrypted coordinates</li>
                <li>Click &ldquo;Decrypt Distance&rdquo; to see how close you are</li>
                <li>Distance 0 means you found the treasure! 🎉</li>
              </ol>
            </div>

            {/* Current Message */}
            <div className="bg-gray-100 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Status</h3>
              <p className="text-sm text-gray-700">
                {treasureHunt.message}
              </p>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {/* Chain Info */}
          <div className="bg-white rounded-lg border-2 border-black p-4">
            <h3 className={titleClass}>Chain Info</h3>
            {printProperty("Chain ID", chainId)}
            {printProperty("Contract Address", treasureHunt.contractAddress)}
            {printProperty("Is Deployed", treasureHunt.isDeployed)}
          </div>

          {/* FHEVM Instance */}
          <div className="bg-white rounded-lg border-2 border-black p-4">
            <h3 className={titleClass}>FHEVM Instance</h3>
            {printProperty("Instance", fhevmInstance ? "Ready" : "Loading")}
            {printProperty("Status", fhevmStatus)}
            {printProperty("Error", fhevmError ?? "None")}
          </div>

          {/* Game Data */}
          <div className="bg-white rounded-lg border-2 border-black p-4">
            <h3 className={titleClass}>Game Data</h3>
            {printProperty("Encrypted Distance", treasureHunt.encryptedDistance ?? "None")}
            {printProperty("Is Decrypted", treasureHunt.isDecrypted)}
            {printProperty("Can Make Guess", treasureHunt.canMakeGuess)}
          </div>
        </div>

        {/* Owner Controls */}
        {treasureHunt.isOwner && (
          <div className="mt-8 bg-yellow-50 rounded-lg border-2 border-yellow-200 p-6">
            <h3 className="text-xl font-semibold mb-4 text-yellow-800">Owner Controls</h3>
            <div className="flex gap-4">
              <button
                className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                onClick={treasureHunt.refreshGameState}
                disabled={!treasureHunt.canRefresh}
              >
                {treasureHunt.isRefreshing ? "Refreshing..." : "Refresh Game"}
              </button>

              <button
                className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-3 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                onClick={treasureHunt.resetGame}
                disabled={treasureHunt.isCreatingTreasure}
              >
                Reset Game
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// Helper functions for debug info display
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
    <p className="text-black text-xs">
      {name}:{" "}
      <span className="font-mono font-semibold text-black">{displayValue}</span>
    </p>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  if (value) {
    return (
      <p className="text-black text-xs">
        {name}:{" "}
        <span className="font-mono font-semibold text-green-500">true</span>
      </p>
    );
  }

  return (
    <p className="text-black text-xs">
      {name}:{" "}
      <span className="font-mono font-semibold text-red-500">false</span>
    </p>
  );
}