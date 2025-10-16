async function main() {
  console.log("🔍 Testing Sepolia connection...\n");

  const [signer] = await ethers.getSigners();
  console.log("✅ Wallet Address:", signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    console.log("⚠️  WARNING: Balance is 0!");
    console.log("   Get testnet ETH from: https://www.alchemy.com/faucets/ethereum-sepolia\n");
  }

  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId.toString());

  if (network.chainId.toString() === "11155111") {
    console.log("\n🎉 Successfully connected to Sepolia testnet!");
  } else {
    console.log("\n❌ Not connected to Sepolia!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
