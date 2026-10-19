const wrapper = require("./wrapper");

const MANUFACTURER = "0x1000000000000000000000000000000000000001";
const DISTRIBUTOR = "0x1000000000000000000000000000000000000002";
const PHARMACY_1 = "0x1000000000000000000000000000000000000003";
const PHARMACY_2 = "0x1000000000000000000000000000000000000004";

async function main() {
  console.log("=== PackRegistry Demo ===\n");

  // 1. Register 2 packs
  console.log("1. Registering 2 packs...");
  const regResult = await wrapper.registerPacks(
    "BATCH-DEMO-001",
    ["PACK-DEMO-001", "PACK-DEMO-002"],
    MANUFACTURER
  );
  console.log("   Registered. txHash:", regResult.txHash);

  // 2. Transfer one pack to distributor
  console.log("\n2. Transferring PACK-DEMO-001 to distributor...");
  const xferResult = await wrapper.transfer("PACK-DEMO-001", MANUFACTURER, DISTRIBUTOR);
  console.log("   Transferred. txHash:", xferResult.txHash);

  // 3. Transfer from distributor to pharmacy
  console.log("\n3. Transferring PACK-DEMO-001 to pharmacy 1...");
  const xferResult2 = await wrapper.transfer("PACK-DEMO-001", DISTRIBUTOR, PHARMACY_1);
  console.log("   Transferred. txHash:", xferResult2.txHash);

  // 4. Dispense at pharmacy 1
  console.log("\n4. Dispensing PACK-DEMO-001 at pharmacy 1...");
  const dispense1 = await wrapper.dispense("PACK-DEMO-001", PHARMACY_1);
  console.log("   Result:", dispense1.result, "| txHash:", dispense1.txHash);

  // 5. Dispense again at pharmacy 2 (conflict!)
  console.log("\n5. Dispensing PACK-DEMO-001 again at pharmacy 2...");
  const dispense2 = await wrapper.dispense("PACK-DEMO-001", PHARMACY_2);
  console.log("   Result:", dispense2.result, "| txHash:", dispense2.txHash);

  // 6. Get pack state
  console.log("\n6. Getting pack state for PACK-DEMO-001...");
  const pack = await wrapper.getPack("PACK-DEMO-001");
  console.log("   registered:", pack.registered);
  console.log("   holder:", pack.holder);
  console.log("   dispensedBy:", pack.dispensedBy);
  console.log("   dispensedAt:", pack.dispensedAt);

  console.log("\n=== Demo Complete ===");
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});

