const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 Deploying GhostTipsFHEVM contract to Sepolia...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", hre.ethers.formatEther(balance), "ETH\n");

  if (balance < hre.ethers.parseEther("0.05")) {
    throw new Error("❌ Insufficient balance! Need at least 0.05 ETH");
  }

  console.log("⚙️  Deploying GhostTipsFHEVM...\n");

  const GhostTipsFHEVM = await hre.ethers.getContractFactory("GhostTipsFHEVM");

  const contract = await GhostTipsFHEVM.deploy({
    gasLimit: 5000000,
  });

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("✅ GhostTipsFHEVM deployed to:", address);
  console.log("🔍 Verify on Etherscan:", `https://sepolia.etherscan.io/address/${address}\n`);

  const deploymentInfo = {
    contractName: "GhostTipsFHEVM",
    address: address,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    etherscanUrl: `https://sepolia.etherscan.io/address/${address}`,
  };

  fs.writeFileSync("deployment-info-sepolia.json", JSON.stringify(deploymentInfo, null, 2));

  fs.writeFileSync(
    "frontend/.env.local",
    `NEXT_PUBLIC_CONTRACT_ADDRESS=${address}\nNEXT_PUBLIC_NETWORK=sepolia\nNEXT_PUBLIC_CHAIN_ID=11155111`,
  );

  console.log("📝 Deployment info saved to deployment-info-sepolia.json");
  console.log("📝 Frontend .env.local updated\n");

  console.log("🧪 Testing contract...");
  try {
    const tipJarCount = await contract.getTipJarCount();
    console.log("✅ Contract is working! Tip jar count:", tipJarCount.toString());
  } catch (error) {
    console.log("⚠️  Test failed but deployment succeeded");
  }

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
