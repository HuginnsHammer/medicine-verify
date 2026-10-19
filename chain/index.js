require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const deploymentsPath = path.join(__dirname, "..", "deployments.json");
const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

const network = process.env.CHAIN_NETWORK || "localhost";
const deployment = deployments[network];

if (!deployment) {
  throw new Error(`No deployment found for network: ${network}`);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(deployment.address, deployment.abi, wallet);

function hashSerial(serial) {
  return ethers.keccak256(ethers.toUtf8Bytes(serial));
}

async function addActor(address, role) {
  const tx = await contract.addActor(address, role);
  await tx.wait();
  return { txHash: tx.hash };
}

async function registerPacks(batchId, serials, manufacturerAddr) {
  const serialHashes = serials.map(hashSerial);
  const tx = await contract.registerPacks(batchId, serialHashes, manufacturerAddr);
  await tx.wait();
  return { txHash: tx.hash };
}

async function transfer(serial, fromAddr, toAddr) {
  const serialHash = hashSerial(serial);
  const tx = await contract.transfer(serialHash, fromAddr, toAddr);
  await tx.wait();
  return { txHash: tx.hash };
}

async function dispense(serial, pharmacyAddr) {
  const serialHash = hashSerial(serial);
  const tx = await contract.dispense(serialHash, pharmacyAddr);
  const receipt = await tx.wait();

  // Check for ConflictFlagged event in receipt logs
  const conflictEvent = receipt.logs.find((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return parsed && parsed.name === "ConflictFlagged";
    } catch {
      return false;
    }
  });

  const result = conflictEvent ? "conflict" : "ok";
  return { result, txHash: tx.hash };
}

async function getPack(serial) {
  const serialHash = hashSerial(serial);
  const [registered, holder, dispensedBy, dispensedAt] = await contract.getPack(serialHash);
  return {
    registered,
    holder,
    dispensedBy,
    dispensedAt: Number(dispensedAt),
  };
}

module.exports = {
  addActor,
  registerPacks,
  transfer,
  dispense,
  getPack,
};
