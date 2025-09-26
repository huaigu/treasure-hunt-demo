import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { postDeploy } from "postdeploy";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const chainId = await hre.getChainId();
  const chainName = hre.network.name;

  // Deploy TreasureHunt contract
  const treasureHuntName = "TreasureHunt";
  const treasureHuntDeployed = await deploy(treasureHuntName, {
    from: deployer,
    log: true,
  });

  console.log(`${treasureHuntName} contract address: ${treasureHuntDeployed.address}`);
  console.log(`${treasureHuntName} chainId: ${chainId}`);
  console.log(`${treasureHuntName} chainName: ${chainName}`);

  // Generates:
  //  - <root>/packages/site/abi/TreasureHuntABI.ts
  //  - <root>/packages/site/abi/TreasureHuntAddresses.ts
  postDeploy(chainName, treasureHuntName);
};

export default func;

func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["TreasureHunt"];
