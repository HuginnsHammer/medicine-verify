
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PackRegistry", function () {
  let registry;
  let deployer;
  let manufacturer;
  let distributor;
  let pharmacy1;
  let pharmacy2;
  let outsider;

  const batchId = "BATCH-TEST-001";
  const packId = "PACK-TEST-001";

  const Role = {
    Manufacturer: 1,
    Distributor: 2,
    Pharmacy: 3,
    Regulator: 4,
  };

  const hashPack = (id) => ethers.id(id);

  beforeEach(async function () {
    [deployer, manufacturer, distributor, pharmacy1, pharmacy2, outsider] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PackRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();

    await registry.addActor(manufacturer.address, Role.Manufacturer);
    await registry.addActor(distributor.address, Role.Distributor);
    await registry.addActor(pharmacy1.address, Role.Pharmacy);
    await registry.addActor(pharmacy2.address, Role.Pharmacy);
  });

  async function registerOnePack(id = packId) {
    await registry.registerPacks(
      batchId,
      [hashPack(id)],
      manufacturer.address
    );
  }

  it("allows the relayer to register a pack", async function () {
    await registerOnePack();

    const pack = await registry.getPack(hashPack(packId));
    expect(pack.registered).to.equal(true);
    expect(pack.holder).to.equal(manufacturer.address);
  });

  it("rejects duplicate pack registration", async function () {
    await registerOnePack();

    await expect(registerOnePack()).to.be.revertedWith("Duplicate hash");
  });

  it("rejects an unregistered manufacturer", async function () {
    await expect(
      registry.registerPacks(batchId, [hashPack(packId)], outsider.address)
    ).to.be.revertedWith("Not a manufacturer");
  });

  it("rejects transactions from a non-relayer", async function () {
    await expect(
      registry.connect(outsider).addActor(outsider.address, Role.Pharmacy)
    ).to.be.revertedWith("Only relayer");
  });

  it("rejects transfer by someone who is not the holder", async function () {
    await registerOnePack();

    await expect(
      registry.transfer(
        hashPack(packId),
        distributor.address,
        pharmacy1.address
      )
    ).to.be.revertedWith("Not the holder");
  });

  it("rejects a recipient without a valid supply-chain role", async function () {
    await registerOnePack();

    await expect(
      registry.transfer(
        hashPack(packId),
        manufacturer.address,
        outsider.address
      )
    ).to.be.revertedWith("Invalid recipient role");
  });

  it("tracks a valid transfer to the distributor", async function () {
    await registerOnePack();

    await registry.transfer(
      hashPack(packId),
      manufacturer.address,
      distributor.address
    );

    const pack = await registry.getPack(hashPack(packId));
    expect(pack.holder).to.equal(distributor.address);
  });

  it("allows first dispensing and rejects a second dispensing logically", async function () {
    await registerOnePack();

    await registry.transfer(
      hashPack(packId),
      manufacturer.address,
      pharmacy1.address
    );

    await expect(
      registry.dispense(hashPack(packId), pharmacy1.address)
    ).to.emit(registry, "Dispensed");

    await expect(
      registry.dispense(hashPack(packId), pharmacy2.address)
    ).to.emit(registry, "ConflictFlagged");

    const pack = await registry.getPack(hashPack(packId));
    expect(pack.dispensedBy).to.equal(pharmacy1.address);
  });

  it("rejects dispensing by an address that is not a pharmacy", async function () {
    await registerOnePack();

    await expect(
      registry.dispense(hashPack(packId), outsider.address)
    ).to.be.revertedWith("Not a pharmacy");
  });
});