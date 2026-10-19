const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const ROLE = {
  None: 0,
  Manufacturer: 1,
  Distributor: 2,
  Pharmacy: 3,
  Regulator: 4,
};

const ACTORS = [
  { address: "0x1000000000000000000000000000000000000001", role: ROLE.Manufacturer },
  { address: "0x1000000000000000000000000000000000000002", role: ROLE.Distributor },
  { address: "0x1000000000000000000000000000000000000003", role: ROLE.Pharmacy },
  { address: "0x1000000000000000000000000000000000000004", role: ROLE.Pharmacy },
  { address: "0x1000000000000000000000000000000000000005", role: ROLE.Pharmacy },
  { address: "0x1000000000000000000000000000000000000006", role: ROLE.Regulator },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const PackRegistry = await hre.ethers.getContractFactory("PackRegistry");
  const packRegistry = await PackRegistry.deploy();
  await packRegistry.waitForDeployment();

  const address = await packRegistry.getAddress();
  console.log("PackRegistry deployed to:", address);

  // Register demo actors
  for (const actor of ACTORS) {
    const tx = await packRegistry.addActor(actor.address, actor.role);
    await tx.wait();
    console.log(`Registered actor ${actor.address} with role ${actor.role}`);
  }

  // Write deployments.json
  const artifact = await hre.artifacts.readArtifact("PackRegistry");
  const deployments = {
    [hre.network.name]: {
      address: address,
      abi: artifact.abi,
    },
  };

  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log("Deployments written to:", deploymentsPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
