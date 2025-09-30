import { TreasureHuntDemo } from "@/components/TreasureHuntDemo";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-zama-hero">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            FHEVM Treasure Hunt
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience Fully Homomorphic Encryption in action with this interactive treasure hunt game
          </p>
        </div>

        {/* Demo Content */}
        <div className="w-full">
          <TreasureHuntDemo />
        </div>
      </div>
    </main>
  );
}
