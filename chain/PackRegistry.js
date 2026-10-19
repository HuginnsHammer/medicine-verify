const { expect } = require("chai");
const hre = require("hardhat");

const ROLE = {
  None: 0,
  Manufacturer: 1,
  Distributor: 2,
  Pharmacy: 3,
  Regulator: 4,
};

describe("PackRegistry", function () {
  let packRegistry;
  let relayer;
  let manufacturer;
  let distributor;
  let pharmacy1;
  let pharmacy2;
  let pharmacy3;
  let regulator;
  let stranger;

  beforeEach(async function () {
    [relayer, manufacturer, distributor, pharmacy1, pharmacy2, pharmacy3, regulator, stranger] =
      await hre.ethers.getSigners();

    const PackRegistry = await hre.ethers.getContractFactory("PackRegistry");
    packRegistry = await PackRegistry.connect(relayer).deploy();
    await packRegistry.waitForDeployment();

    // Register actors
    await packRegistry.connect(relayer).addActor(manufacturer.address, ROLE.Manufacturer);
    await packRegistry.connect(relayer).addActor(distributor.address, ROLE.Distributor);
    await packRegistry.connect(relayer).addActor(pharmacy1.address, ROLE.Pharmacy);
    await packRegistry.connect(relayer).addActor(pharmacy2.address, ROLE.Pharmacy);
    await packRegistry.connect(relayer).addActor(pharmacy3.address, ROLE.Pharmacy);
    await packRegistry.connect(relayer).addActor(regulator.address, ROLE.Regulator);
  });

  function hashSerial(serial) {
    return hre.ethers.keccak256(hre.ethers.toUtf8Bytes(serial));
  }

  describe("registerPacks", function () {
    it("should register packs successfully", async function () {
      const serials = [hashSerial("PACK-001"), hashSerial("PACK-002")];
      await expect(
        packRegistry.connect(relayer).registerPacks("BATCH-A", serials, manufacturer.address)
      )
        .to.emit(packRegistry, "PackRegistered")
        .withArgs(serials[0], "BATCH-A", manufacturer.address)
        .to.emit(packRegistry, "PackRegistered")
        .withArgs(serials[1], "BATCH-A", manufacturer.address);

      const pack = await packRegistry.getPack(serials[0]);
      expect(pack.registered).to.be.true;
      expect(pack.holder).to.equal(manufacturer.address);
    });

    it("should revert when registering a duplicate hash", async function () {
      const serials = [hashSerial("PACK-001")];
      await packRegistry.connect(relayer).registerPacks("BATCH-A", serials, manufacturer.address);

      await expect(
        packRegistry.connect(relayer).registerPacks("BATCH-B", serials, manufacturer.address)
      ).to.be.revertedWith("Duplicate hash");
    });

    it("should revert when manufacturer has wrong role", async function () {
      const serials = [hashSerial("PACK-001")];
      await expect(
        packRegistry.connect(relayer).registerPacks("BATCH-A", serials, distributor.address)
      ).to.be.revertedWith("Not a manufacturer");
    });
  });

  describe("transfer", function () {
    beforeEach(async function () {
      const serials = [hashSerial("PACK-001")];
      await packRegistry.connect(relayer).registerPacks("BATCH-A", serials, manufacturer.address);
    });

    it("should transfer from manufacturer to distributor", async function () {
      const serial = hashSerial("PACK-001");
      await expect(
        packRegistry.connect(relayer).transfer(serial, manufacturer.address, distributor.address)
      )
        .to.emit(packRegistry, "Transferred")
        .withArgs(serial, manufacturer.address, distributor.address);

      const pack = await packRegistry.getPack(serial);
      expect(pack.holder).to.equal(distributor.address);
    });

    it("should transfer from distributor to pharmacy", async function () {
      const serial = hashSerial("PACK-001");
      await packRegistry.connect(relayer).transfer(serial, manufacturer.address, distributor.address);
      await expect(
        packRegistry.connect(relayer).transfer(serial, distributor.address, pharmacy1.address)
      )
        .to.emit(packRegistry, "Transferred")
        .withArgs(serial, distributor.address, pharmacy1.address);
    });

    it("should revert when non-holder tries to transfer", async function () {
      const serial = hashSerial("PACK-001");
      await expect(
        packRegistry.connect(relayer).transfer(serial, stranger.address, distributor.address)
      ).to.be.revertedWith("Not the holder");
    });

    it("should revert when recipient has wrong role", async function () {
      const serial = hashSerial("PACK-001");
      await expect(
        packRegistry.connect(relayer).transfer(serial, manufacturer.address, stranger.address)
      ).to.be.revertedWith("Invalid recipient role");
    });

    it("should revert when transferring unregistered pack", async function () {
      const serial = hashSerial("PACK-999");
      await expect(
        packRegistry.connect(relayer).transfer(serial, manufacturer.address, distributor.address)
      ).to.be.revertedWith("Pack not registered");
    });
  });

  describe("dispense", function () {
    beforeEach(async function () {
      const serials = [hashSerial("PACK-001")];
      await packRegistry.connect(relayer).registerPacks("BATCH-A", serials, manufacturer.address);
      await packRegistry.connect(relayer).transfer(hashSerial("PACK-001"), manufacturer.address, pharmacy1.address);
    });

    it("should dispense successfully on first call", async function () {
      const serial = hashSerial("PACK-001");
      const tx = await packRegistry.connect(relayer).dispense(serial, pharmacy1.address);
      const receipt = await tx.wait();

      expect(receipt.logs.length).to.be.greaterThan(0);

      const pack = await packRegistry.getPack(serial);
      expect(pack.dispensedBy).to.equal(pharmacy1.address);
      expect(pack.dispensedAt).to.be.greaterThan(0);
    });

    it("should emit ConflictFlagged and return false on second dispense without reverting", async function () {
      const serial = hashSerial("PACK-001");
      await packRegistry.connect(relayer).dispense(serial, pharmacy1.address);

      await expect(
        packRegistry.connect(relayer).dispense(serial, pharmacy2.address)
      )
        .to.emit(packRegistry, "ConflictFlagged")
        .withArgs(serial, pharmacy1.address, pharmacy2.address, await hre.ethers.provider.getBlock("latest").then(b => b.timestamp + 1));

      const pack = await packRegistry.getPack(serial);
      expect(pack.dispensedBy).to.equal(pharmacy1.address);
    });

    it("should revert when dispensing unregistered pack", async function () {
      const serial = hashSerial("PACK-999");
      await expect(
        packRegistry.connect(relayer).dispense(serial, pharmacy1.address)
      ).to.be.revertedWith("Pack not registered");
    });

    it("should revert when dispenser is not a pharmacy", async function () {
      const serial = hashSerial("PACK-001");
      await expect(
        packRegistry.connect(relayer).dispense(serial, distributor.address)
      ).to.be.revertedWith("Not a pharmacy");
    });
  });

  describe("access control", function () {
    it("should revert when non-relayer calls addActor", async function () {
      await expect(
        packRegistry.connect(stranger).addActor(stranger.address, ROLE.Pharmacy)
      ).to.be.revertedWith("Only relayer");
    });

    it("should revert when non-relayer calls registerPacks", async function () {
      const serials = [hashSerial("PACK-001")];
      await expect(
        packRegistry.connect(stranger).registerPacks("BATCH-A", serials, manufacturer.address)
      ).to.be.revertedWith("Only relayer");
    });
  });
});
