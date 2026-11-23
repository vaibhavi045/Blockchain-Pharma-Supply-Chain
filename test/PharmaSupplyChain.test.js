const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PharmaSupplyChain", function () {
  let contract;
  let admin, manufacturer, distributor, pharmacy, customer, unauthorized;

  const ONE_YEAR = 365 * 24 * 60 * 60;

  async function futureExpiry() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + ONE_YEAR;
  }

  beforeEach(async function () {
    [admin, manufacturer, distributor, pharmacy, customer, unauthorized] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("PharmaSupplyChain");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Register standard participants
    await contract.registerUser(manufacturer.address, "PharmaCorp", "Mumbai", 2);
    await contract.registerUser(distributor.address, "MedDist", "Delhi", 3);
    await contract.registerUser(pharmacy.address, "HealthPlus", "Bangalore", 4);
    await contract.registerUser(customer.address, "John Doe", "Bangalore", 5);
  });

  // ═══════════════════════════════════════════════════════
  //  1. DEPLOYMENT
  // ═══════════════════════════════════════════════════════
  describe("Deployment", function () {
    it("Should set deployer as admin / owner", async function () {
      expect(await contract.owner()).to.equal(admin.address);
      const user = await contract.getUser(admin.address);
      expect(user.role).to.equal(1n); // Admin
      expect(user.isRegistered).to.be.true;
    });

    it("Should initialise counters to correct values", async function () {
      expect(await contract.drugCount()).to.equal(0n);
      expect(await contract.userCount()).to.equal(5n); // admin + 4 registered
    });
  });

  // ═══════════════════════════════════════════════════════
  //  2. USER REGISTRATION
  // ═══════════════════════════════════════════════════════
  describe("User Registration", function () {
    it("Should register users with correct roles and metadata", async function () {
      const mfr = await contract.getUser(manufacturer.address);
      expect(mfr.name).to.equal("PharmaCorp");
      expect(mfr.role).to.equal(2n);
      expect(mfr.isRegistered).to.be.true;
    });

    it("Should reject duplicate registration", async function () {
      await expect(
        contract.registerUser(manufacturer.address, "Dup", "Loc", 2)
      ).to.be.revertedWith("User already registered");
    });

    it("Should reject registration by non-admin", async function () {
      await expect(
        contract
          .connect(manufacturer)
          .registerUser(unauthorized.address, "Test", "Loc", 2)
      ).to.be.revertedWith("Only admin can call this");
    });

    it("Should reject invalid roles (None=0, Admin=1)", async function () {
      const addr = (await ethers.getSigners())[6];
      await expect(
        contract.registerUser(addr.address, "X", "Y", 0)
      ).to.be.revertedWith("Invalid role");
      await expect(
        contract.registerUser(addr.address, "X", "Y", 1)
      ).to.be.revertedWith("Invalid role");
    });

    it("Should emit UserRegistered event", async function () {
      const addr = (await ethers.getSigners())[7];
      await expect(contract.registerUser(addr.address, "New", "Loc", 2))
        .to.emit(contract, "UserRegistered");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  3. DRUG REGISTRATION
  // ═══════════════════════════════════════════════════════
  describe("Drug Registration", function () {
    it("Should register a drug by manufacturer", async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("Paracetamol 500mg", "BATCH-001", expiry, "Paracetamol IP 500mg");

      const drug = await contract.getDrug(1);
      expect(drug.name).to.equal("Paracetamol 500mg");
      expect(drug.batchNumber).to.equal("BATCH-001");
      expect(drug.status).to.equal(0n); // Manufactured
      expect(drug.currentHolder).to.equal(manufacturer.address);
      expect(drug.isRecalled).to.be.false;
    });

    it("Should reject registration by non-manufacturer", async function () {
      const expiry = await futureExpiry();
      await expect(
        contract.connect(distributor).registerDrug("X", "B-002", expiry, "C")
      ).to.be.revertedWith("Only manufacturer can call this");
    });

    it("Should reject duplicate batch numbers", async function () {
      const expiry = await futureExpiry();
      await contract.connect(manufacturer).registerDrug("D1", "BATCH-001", expiry, "C1");
      await expect(
        contract.connect(manufacturer).registerDrug("D2", "BATCH-001", expiry, "C2")
      ).to.be.revertedWith("Batch number already registered");
    });

    it("Should reject empty name or batch number", async function () {
      const expiry = await futureExpiry();
      await expect(
        contract.connect(manufacturer).registerDrug("", "B", expiry, "C")
      ).to.be.revertedWith("Drug name required");
      await expect(
        contract.connect(manufacturer).registerDrug("N", "", expiry, "C")
      ).to.be.revertedWith("Batch number required");
    });

    it("Should reject expiry date in the past", async function () {
      await expect(
        contract.connect(manufacturer).registerDrug("N", "B", 1000, "C")
      ).to.be.revertedWith("Expiry date must be in the future");
    });

    it("Should emit DrugRegistered event", async function () {
      const expiry = await futureExpiry();
      await expect(
        contract.connect(manufacturer).registerDrug("Drug", "B-EVT", expiry, "Comp")
      ).to.emit(contract, "DrugRegistered");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  4. FULL SUPPLY-CHAIN FLOW  (happy path)
  // ═══════════════════════════════════════════════════════
  describe("Supply Chain – Full Flow", function () {
    let expiry;

    beforeEach(async function () {
      expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("Amoxicillin 250mg", "BATCH-AMX-001", expiry, "Amoxicillin Trihydrate IP 250mg");
    });

    it("Should complete Manufacturer → Distributor → Pharmacy → Customer", async function () {
      // Step 1: Ship to distributor
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      let drug = await contract.getDrug(1);
      expect(drug.status).to.equal(1n); // ShippedToDistributor
      expect(drug.currentHolder).to.equal(distributor.address);

      // Step 2: Distributor receives
      await contract.connect(distributor).receiveByDistributor(1);
      drug = await contract.getDrug(1);
      expect(drug.status).to.equal(2n); // ReceivedByDistributor

      // Step 3: Ship to pharmacy
      await contract.connect(distributor).shipToPharmacy(1, pharmacy.address);
      drug = await contract.getDrug(1);
      expect(drug.status).to.equal(3n); // ShippedToPharmacy
      expect(drug.currentHolder).to.equal(pharmacy.address);

      // Step 4: Pharmacy receives
      await contract.connect(pharmacy).receiveByPharmacy(1);
      drug = await contract.getDrug(1);
      expect(drug.status).to.equal(4n); // ReceivedByPharmacy

      // Step 5: Sell to customer
      await contract.connect(pharmacy).sellToCustomer(1, customer.address);
      drug = await contract.getDrug(1);
      expect(drug.status).to.equal(5n); // Sold
      expect(drug.currentHolder).to.equal(customer.address);
    });

    it("Should build a complete transfer history (audit trail)", async function () {
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      await contract.connect(distributor).receiveByDistributor(1);
      await contract.connect(distributor).shipToPharmacy(1, pharmacy.address);

      const history = await contract.getDrugHistory(1);
      // 1=Manufactured + 2=ShipDist + 3=RecvDist + 4=ShipPharm = 4 records
      expect(history.length).to.equal(4);
    });

    it("Should emit DrugTransferred at each step", async function () {
      await expect(
        contract.connect(manufacturer).shipToDistributor(1, distributor.address)
      )
        .to.emit(contract, "DrugTransferred")
        .withArgs(1n, manufacturer.address, distributor.address, 1n, (v) => true);
    });
  });

  // ═══════════════════════════════════════════════════════
  //  5. INVALID STATUS TRANSITIONS  (unhappy path)
  // ═══════════════════════════════════════════════════════
  describe("Supply Chain – Invalid Transitions", function () {
    let expiry;

    beforeEach(async function () {
      expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("TestDrug", "BATCH-INV-001", expiry, "Composition");
    });

    it("Should reject ship-to-pharmacy before distributor receives", async function () {
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      // Distributor tries to forward before confirming receipt
      await expect(
        contract.connect(distributor).shipToPharmacy(1, pharmacy.address)
      ).to.be.revertedWith("Drug must be at distributor");
    });

    it("Should reject sell-to-customer before pharmacy receives", async function () {
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      await contract.connect(distributor).receiveByDistributor(1);
      await contract.connect(distributor).shipToPharmacy(1, pharmacy.address);
      // Pharmacy tries to sell before confirming receipt
      await expect(
        contract.connect(pharmacy).sellToCustomer(1, customer.address)
      ).to.be.revertedWith("Drug must be at pharmacy");
    });

    it("Should reject transfer by wrong role", async function () {
      await expect(
        contract.connect(distributor).shipToDistributor(1, distributor.address)
      ).to.be.revertedWith("Only manufacturer can call this");
    });

    it("Should reject transfer by non-holder", async function () {
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      await contract.connect(distributor).receiveByDistributor(1);
      // A different distributor tries to ship
      const [, , , , , , anotherDist] = await ethers.getSigners();
      await contract.registerUser(anotherDist.address, "OtherDist", "Chennai", 3);
      await expect(
        contract.connect(anotherDist).shipToPharmacy(1, pharmacy.address)
      ).to.be.revertedWith("You are not the current holder");
    });

    it("Should reject sending to wrong role recipient", async function () {
      // Manufacturer tries to ship to a pharmacy instead of distributor
      await expect(
        contract.connect(manufacturer).shipToDistributor(1, pharmacy.address)
      ).to.be.revertedWith("Recipient must be a registered distributor");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  6. TEMPERATURE MONITORING
  // ═══════════════════════════════════════════════════════
  describe("Temperature Monitoring", function () {
    beforeEach(async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("Insulin", "BATCH-INS-001", expiry, "Human Insulin 40 IU/ml");
    });

    it("Should record temperature within safe range (no violation)", async function () {
      await contract.connect(manufacturer).recordTemperature(1, 500, "Cold Storage Unit A");
      const logs = await contract.getTemperatureLogs(1);
      expect(logs.length).to.equal(1);
      expect(logs[0].temperature).to.equal(500n); // 5.00 °C
    });

    it("Should flag temperature violation above 8 °C", async function () {
      await expect(
        contract.connect(manufacturer).recordTemperature(1, 1500, "Transit Vehicle")
      ).to.emit(contract, "TemperatureViolation");

      const drug = await contract.getDrug(1);
      expect(drug.hasTempViolation).to.be.true;
    });

    it("Should flag temperature violation below 2 °C", async function () {
      await expect(
        contract.connect(manufacturer).recordTemperature(1, -100, "Freezer Error")
      ).to.emit(contract, "TemperatureViolation");
    });

    it("Should reject recording by non-holder", async function () {
      await expect(
        contract.connect(distributor).recordTemperature(1, 500, "Location")
      ).to.be.revertedWith("Only current holder can record temperature");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  7. DRUG RECALL
  // ═══════════════════════════════════════════════════════
  describe("Drug Recall", function () {
    beforeEach(async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("RecallDrug", "BATCH-RCL-001", expiry, "Composition");
    });

    it("Should allow admin to recall a drug", async function () {
      await contract.recallDrug(1, "Quality issue detected in lab tests");
      const drug = await contract.getDrug(1);
      expect(drug.isRecalled).to.be.true;
      expect(drug.status).to.equal(6n); // Recalled
    });

    it("Should allow manufacturer to recall own drug", async function () {
      await contract.connect(manufacturer).recallDrug(1, "Contamination in batch");
      const drug = await contract.getDrug(1);
      expect(drug.isRecalled).to.be.true;
    });

    it("Should prevent recalled drug from being transferred", async function () {
      await contract.recallDrug(1, "Recall");
      await expect(
        contract.connect(manufacturer).shipToDistributor(1, distributor.address)
      ).to.be.revertedWith("Drug has been recalled");
    });

    it("Should prevent recalled drug from being sold", async function () {
      // Move to pharmacy first
      await contract.connect(manufacturer).shipToDistributor(1, distributor.address);
      await contract.connect(distributor).receiveByDistributor(1);
      await contract.connect(distributor).shipToPharmacy(1, pharmacy.address);
      await contract.connect(pharmacy).receiveByPharmacy(1);
      // Now recall
      await contract.recallDrug(1, "Safety alert");
      await expect(
        contract.connect(pharmacy).sellToCustomer(1, customer.address)
      ).to.be.revertedWith("Drug has been recalled");
    });

    it("Should reject recall by unauthorized user", async function () {
      await expect(
        contract.connect(distributor).recallDrug(1, "Reason")
      ).to.be.revertedWith("Only admin or the drug manufacturer can recall");
    });

    it("Should emit DrugRecalled event", async function () {
      await expect(contract.recallDrug(1, "Quality issue"))
        .to.emit(contract, "DrugRecalled");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  8. COUNTERFEIT REPORTING
  // ═══════════════════════════════════════════════════════
  describe("Counterfeit Reporting", function () {
    beforeEach(async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("CFDrug", "BATCH-CF-001", expiry, "Composition");
    });

    it("Should accept a counterfeit report from anyone", async function () {
      await contract.connect(customer).reportCounterfeit(1, "Suspicious packaging");
      expect(await contract.reportCount()).to.equal(1n);

      const report = await contract.reports(1);
      expect(report.drugId).to.equal(1n);
      expect(report.reporter).to.equal(customer.address);
      expect(report.reason).to.equal("Suspicious packaging");
      expect(report.resolved).to.be.false;
    });

    it("Should reject empty reason", async function () {
      await expect(
        contract.connect(customer).reportCounterfeit(1, "")
      ).to.be.revertedWith("Reason required");
    });

    it("Should allow admin to resolve report", async function () {
      await contract.connect(customer).reportCounterfeit(1, "Bad packaging");
      await contract.resolveReport(1);
      const report = await contract.reports(1);
      expect(report.resolved).to.be.true;
    });

    it("Should emit CounterfeitReported event", async function () {
      await expect(
        contract.connect(customer).reportCounterfeit(1, "Looks fake")
      ).to.emit(contract, "CounterfeitReported");
    });
  });

  // ═══════════════════════════════════════════════════════
  //  9. VERIFICATION
  // ═══════════════════════════════════════════════════════
  describe("Drug Verification", function () {
    beforeEach(async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("VerifyDrug", "BATCH-VER-001", expiry, "Composition");
    });

    it("Should verify an authentic (non-recalled, non-expired) drug", async function () {
      const result = await contract.verifyDrug(1);
      expect(result.exists).to.be.true;
      expect(result.isAuthentic).to.be.true;
      expect(result.isRecalled).to.be.false;
      expect(result.isExpired).to.be.false;
      expect(result.hasTempViolation).to.be.false;
      expect(result.name).to.equal("VerifyDrug");
    });

    it("Should look up drug by batch number", async function () {
      const result = await contract.verifyByBatch("BATCH-VER-001");
      expect(result.exists).to.be.true;
      expect(result.drugId).to.equal(1n);
    });

    it("Should return false for non-existent batch", async function () {
      const result = await contract.verifyByBatch("DOES-NOT-EXIST");
      expect(result.exists).to.be.false;
    });

    it("Should report recalled drug as not authentic", async function () {
      await contract.recallDrug(1, "Quality issue");
      const result = await contract.verifyDrug(1);
      expect(result.isAuthentic).to.be.false;
      expect(result.isRecalled).to.be.true;
    });

    it("Should reject verification for non-existent drug ID", async function () {
      await expect(contract.verifyDrug(999)).to.be.revertedWith(
        "Drug does not exist"
      );
    });
  });

  // ═══════════════════════════════════════════════════════
  // 10. EDGE CASES & SECURITY
  // ═══════════════════════════════════════════════════════
  describe("Edge Cases & Security", function () {
    it("Should not allow unregistered user to record temperature", async function () {
      const expiry = await futureExpiry();
      await contract
        .connect(manufacturer)
        .registerDrug("Drug", "B-EDGE", expiry, "C");
      await expect(
        contract.connect(unauthorized).recordTemperature(1, 500, "Loc")
      ).to.be.revertedWith("User not registered");
    });

    it("Should handle operations on non-existent drugs", async function () {
      await expect(contract.getDrug(42)).to.be.revertedWith("Drug does not exist");
      await expect(contract.getDrugHistory(42)).to.be.revertedWith("Drug does not exist");
    });

    it("Should correctly count registered users", async function () {
      const count = await contract.getRegisteredUserCount();
      expect(count).to.equal(5n); // admin + 4 registered users
    });

    it("Should return users list", async function () {
      const list = await contract.getUsersList();
      expect(list.length).to.equal(5);
      expect(list[0]).to.equal(admin.address);
    });
  });
});
