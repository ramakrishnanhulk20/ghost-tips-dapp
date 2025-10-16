import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployGhostTips: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("🚀 Deploying GhostTips contract...");
  console.log("📍 Deployer address:", deployer);

  const ghostTips = await deploy("GhostTips", {
    from: deployer,
    log: true,
  });

  console.log("✅ GhostTips deployed to:", ghostTips.address);

  // Save deployment info to a file for frontend
  const fs = require("fs");
  const deploymentInfo = {
    address: ghostTips.address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer,
  };

  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));

  console.log("📝 Deployment info saved to deployment-info.json");
};

deployGhostTips.tags = ["GhostTips"];

export default deployGhostTips;
