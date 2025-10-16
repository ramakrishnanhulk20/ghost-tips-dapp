const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying GhostToken and GhostTipsFHEVM to Sepolia...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy GhostToken first
  console.log("⚙️  Deploying GhostToken...");
  const GhostToken = await ethers.getContractFactory("GhostToken");
  const ghostToken = await GhostToken.deploy();
  await ghostToken.waitForDeployment();
  const ghostTokenAddress = await ghostToken.getAddress();

  console.log("✅ GhostToken deployed to:", ghostTokenAddress);
  console.log("🔍 Verify on Etherscan: https://sepolia.etherscan.io/address/" + ghostTokenAddress + "\n");

  // Deploy GhostTipsFHEVM with GhostToken address
  console.log("⚙️  Deploying GhostTipsFHEVM...");
  const GhostTipsFHEVM = await ethers.getContractFactory("GhostTipsFHEVM");
  const ghostTips = await GhostTipsFHEVM.deploy(ghostTokenAddress);
  await ghostTips.waitForDeployment();
  const ghostTipsAddress = await ghostTips.getAddress();

  console.log("✅ GhostTipsFHEVM deployed to:", ghostTipsAddress);
  console.log("🔍 Verify on Etherscan: https://sepolia.etherscan.io/address/" + ghostTipsAddress + "\n");

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: "sepolia",
    ghostToken: ghostTokenAddress,
    ghostTips: ghostTipsAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync("deployment-info-token-sepolia.json", JSON.stringify(deploymentInfo, null, 2));
  console.log("📝 Deployment info saved to deployment-info-token-sepolia.json");

  // Update frontend .env.local
  const envPath = "frontend/.env.local";
  let envContent = `NEXT_PUBLIC_CONTRACT_ADDRESS=${ghostTipsAddress}\nNEXT_PUBLIC_GHOST_TOKEN_ADDRESS=${ghostTokenAddress}\n`;

  fs.writeFileSync(envPath, envContent);
  console.log("📝 Frontend .env.local updated\n");

  // Test contracts
  console.log("🧪 Testing contracts...");
  const tipJarCount = await ghostTips.getTipJarCount();
  console.log("✅ GhostTips is working! Tip jar count:", tipJarCount.toString());

  const tokenName = await ghostToken.name();
  console.log("✅ GhostToken is working! Name:", tokenName);

  console.log("\n🎉 Deployment complete!");
  console.log("\n📋 Next Steps:");
  console.log("1. Users deposit ETH to GhostToken contract to get GHOST tokens");
  console.log("2. Users send encrypted GHOST tokens as tips");
  console.log("3. Tip amounts are now ENCRYPTED on-chain! 🔐");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
