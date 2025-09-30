export function errorNotDeployed(chainId: number | undefined) {
  return (
    <div className="grid w-full gap-4 mx-auto font-semibold bg-background">
      <div className="col-span-full mx-20">
        <p className="text-4xl leading-relaxed text-foreground">
          {" "}
          <span className="font-mono bg-destructive text-destructive-foreground px-2 py-1 rounded">Error</span>:{" "}
          <span className="font-mono bg-primary text-primary-foreground px-2 py-1 rounded">TreasureHunt.sol</span> Contract
          Not Deployed on{" "}
          <span className="font-mono bg-muted text-muted-foreground px-2 py-1 rounded">chainId={chainId}</span>{" "}
          {chainId === 11155111 ? "(Sepolia)" : ""} or Deployment Address
          Missing.
        </p>
        <p className="text-xl leading-relaxed mt-8 text-muted-foreground">
          It appears that the{" "}
          <span className="font-mono bg-primary text-primary-foreground px-2 py-1 rounded">TreasureHunt.sol</span> contract
          has either not been deployed yet, or the deployment address is missing
          from the ABI directory{" "}
          <span className="font-mono bg-muted text-muted-foreground px-2 py-1 rounded">root/packages/site/abi</span>. To
          deploy <span className="font-mono bg-primary text-primary-foreground px-2 py-1 rounded">TreasureHunt.sol</span> on
          Sepolia, run the following command:
        </p>
        <p className="font-mono text-2xl leading-relaxed bg-card text-card-foreground border border-border p-4 mt-12 rounded-lg">
          <span className="opacity-50 italic text-destructive">
            #from &lt;root&gt;/packages/fhevm-hardhat-template
          </span>
          <br />
          npx hardhat deploy --network{" "}
          {chainId === 11155111 ? "sepolia" : "your-network-name"}
        </p>
        <p className="text-xl leading-relaxed mt-12 text-muted-foreground">
          Alternatively, switch to the local{" "}
          <span className="font-mono bg-accent text-accent-foreground px-2 py-1 rounded">Hardhat Node</span> using the
          MetaMask browser extension.
        </p>
      </div>
    </div>
  );
}
