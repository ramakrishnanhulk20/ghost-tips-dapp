const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying GhostTipsSimple contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);

  const GhostTipsSimple = await hre.ethers.getContractFactory("GhostTipsSimple");
  const contract = await GhostTipsSimple.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ GhostTipsSimple deployed to:", address);

  const deploymentInfo = {
    address: address,
    network: hre.network.name,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync("deployment-info.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📝 Deployment info saved to deployment-info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
