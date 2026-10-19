const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const DEPLOYMENTS_PATH = path.join(__dirname, "..", "deployments.json");

function loadContract() {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    throw new Error(
      `Deployments file not found: ${DEPLOYMENTS_PATH}. Run deploy.js first.`
    );
  }

  const deployments = JSON.parse(
    fs.readFileSync(DEPLOYMENTS_PATH, "utf8")
  );

  const deployment = deployments.localhost;

  if (!deployment?.address || !deployment?.abi) {
    throw new Error("No localhost contract deployment found.");
  }

  return deployment;
}

async function getContract() {
  const deployment = loadContract();
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = await provider.getSigner();

  return new ethers.Contract(
    deployment.address,
    deployment.abi,
    signer
  );
}

// Convert a readable medicine pack ID to bytes32.
function serialHash(serialId) {
  return ethers.id(serialId);
}

async function registerPacks(batchId, packIds, manufacturer) {
  const contract = await getContract();

  const hashes = packIds.map(serialHash);
  const tx = await contract.registerPacks(
    batchId,
    hashes,
    manufacturer
  );

  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    serialHashes: hashes
  };
}

async function transfer(packId, from, to) {
  const contract = await getContract();

  const tx = await contract.transfer(
    serialHash(packId),
    from,
    to
  );

  const receipt = await tx.wait();

  return { txHash: receipt.hash };
}

async function dispense(packId, pharmacy) {
  const contract = await getContract();
  const hash = serialHash(packId);

  // Preview the result, then submit the transaction so its event is recorded.
  const result = await contract.dispense.staticCall(hash, pharmacy);

  const tx = await contract.dispense(hash, pharmacy);
  const receipt = await tx.wait();

  return {
    result,
    txHash: receipt.hash
  };
}

async function getPack(packId) {
  const contract = await getContract();

  const pack = await contract.getPack(serialHash(packId));

  return {
    registered: pack[0],
    holder: pack[1],
    dispensedBy: pack[2],
    dispensedAt: pack[3].toString()
  };
}

module.exports = {
  registerPacks,
  transfer,
  dispense,
  getPack
};
