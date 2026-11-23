const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   PharmaSupplyChain – Deployment Script                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  const signers = await hre.ethers.getSigners();
  const [admin, manufacturer, distributor, pharmacy, customer] = signers;

  // ── 1. Deploy ──────────────────────────────────────────────
  console.log("⏳ Deploying PharmaSupplyChain contract...");
  const PharmaSupplyChain = await hre.ethers.getContractFactory("PharmaSupplyChain");
  const contract = await PharmaSupplyChain.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed to: ${contractAddress}`);
  console.log(`   Admin (deployer):     ${admin.address}\n`);

  // ── 2. Register supply-chain participants ──────────────────
  console.log("⏳ Registering supply-chain participants...");

  let tx;
  tx = await contract.registerUser(manufacturer.address, "PharmaCorp India Pvt Ltd", "Mumbai, Maharashtra", 2);
  await tx.wait();
  console.log(`   ✔ Manufacturer : ${manufacturer.address}  (PharmaCorp India Pvt Ltd)`);

  tx = await contract.registerUser(distributor.address, "MedDistribute Logistics", "Delhi, NCR", 3);
  await tx.wait();
  console.log(`   ✔ Distributor  : ${distributor.address}  (MedDistribute Logistics)`);

  tx = await contract.registerUser(pharmacy.address, "HealthPlus Pharmacy", "Bangalore, Karnataka", 4);
  await tx.wait();
  console.log(`   ✔ Pharmacy     : ${pharmacy.address}  (HealthPlus Pharmacy)`);

  tx = await contract.registerUser(customer.address, "Viraj (Customer)", "Bangalore, Karnataka", 5);
  await tx.wait();
  console.log(`   ✔ Customer     : ${customer.address}  (Viraj)`);

  console.log("\n✅ All participants registered!\n");

  // ── 3. Register a sample drug ──────────────────────────────
  console.log("⏳ Registering a sample drug batch...");
  const oneYear = 365 * 24 * 60 * 60;
  const currentBlock = await hre.ethers.provider.getBlock("latest");
  const expiryDate = currentBlock.timestamp + oneYear;

  tx = await contract.connect(manufacturer).registerDrug(
    "Paracetamol 500mg",
    "BATCH-PCM-2024-001",
    expiryDate,
    "Each tablet contains: Paracetamol IP 500mg, Starch, Povidone, Stearic Acid"
  );
  await tx.wait();
  console.log("   ✔ Drug registered: Paracetamol 500mg  |  Batch: BATCH-PCM-2024-001\n");

  // ── 4. Save contract data for the React frontend ──────────
  const artifact = await hre.artifacts.readArtifact("PharmaSupplyChain");

  const contractData = {
    address: contractAddress,
    abi: artifact.abi,
    network: {
      name: hre.network.name,
      chainId: hre.network.config.chainId || 31337,
    },
    accounts: {
      admin: admin.address,
      manufacturer: manufacturer.address,
      distributor: distributor.address,
      pharmacy: pharmacy.address,
      customer: customer.address,
    },
    deployedAt: new Date().toISOString(),
  };

  const frontendSrcDir = path.join(__dirname, "..", "frontend", "src");
  if (!fs.existsSync(frontendSrcDir)) {
    fs.mkdirSync(frontendSrcDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendSrcDir, "contractData.json"),
    JSON.stringify(contractData, null, 2)
  );
  console.log("📄 Contract data saved → frontend/src/contractData.json");

  // ── 5. Summary ─────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║                   DEPLOYMENT COMPLETE                       ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Contract : ${contractAddress}  ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  Admin         : ${admin.address}  ║`);
  console.log(`║  Manufacturer  : ${manufacturer.address}  ║`);
  console.log(`║  Distributor   : ${distributor.address}  ║`);
  console.log(`║  Pharmacy      : ${pharmacy.address}  ║`);
  console.log(`║  Customer      : ${customer.address}  ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  Next steps:                                               ║");
  console.log("║    1. Import accounts into MetaMask (use private keys)      ║");
  console.log("║    2. Connect MetaMask to http://127.0.0.1:8545             ║");
  console.log("║    3. cd frontend && npm install && npm run dev             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
