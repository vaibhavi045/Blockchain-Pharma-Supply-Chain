// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PharmaSupplyChain
 * @author Pharma-Chain Team
 * @dev Pharmaceutical Drug Supply-Chain Traceability and Anti-Counterfeit System
 * @notice Tracks medicines from manufacturer → distributor → pharmacy → customer
 *         using blockchain for transparency and counterfeit detection.
 *
 * KEY BLOCKCHAIN CONCEPTS DEMONSTRATED:
 *   - Immutability: Once a drug transfer is recorded, it cannot be altered.
 *   - Distributed Ledger: Every node holds the same copy of supply-chain records.
 *   - Cryptographic Hashing: Block hashes secure each transaction.
 *   - Smart Contracts: Business rules (role checks, status transitions) are
 *     enforced automatically without a central authority.
 *   - Events & Audit Trail: Every state change emits an event, creating a
 *     tamper-evident log.
 */
contract PharmaSupplyChain {

    // ════════════════════════════════════════════
    //                   ENUMS
    // ════════════════════════════════════════════

    /// @notice Roles that participants can hold in the supply chain
    enum Role {
        None,           // 0 - Unregistered
        Admin,          // 1 - System administrator
        Manufacturer,   // 2 - Drug manufacturer
        Distributor,    // 3 - Wholesale distributor
        Pharmacy,       // 4 - Retail pharmacy
        Customer        // 5 - End consumer
    }

    /// @notice Status of a drug as it moves through the supply chain
    enum DrugStatus {
        Manufactured,           // 0 - Freshly manufactured
        ShippedToDistributor,   // 1 - In transit to distributor
        ReceivedByDistributor,  // 2 - Received at distributor warehouse
        ShippedToPharmacy,      // 3 - In transit to pharmacy
        ReceivedByPharmacy,     // 4 - Available at pharmacy shelf
        Sold,                   // 5 - Sold to end customer
        Recalled                // 6 - Recalled from supply chain
    }

    // ════════════════════════════════════════════
    //                  STRUCTS
    // ════════════════════════════════════════════

    struct User {
        address userAddress;
        string  name;
        string  location;
        Role    role;
        bool    isRegistered;
    }

    struct Drug {
        uint256    id;
        string     name;
        string     batchNumber;
        address    manufacturer;
        string     manufacturerName;
        uint256    manufactureDate;
        uint256    expiryDate;
        string     composition;
        DrugStatus status;
        address    currentHolder;
        bool       isRecalled;
        bool       hasTempViolation;
    }

    /// @notice A single link in the supply-chain audit trail
    struct TransferRecord {
        uint256    timestamp;
        address    fromAddress;
        address    toAddress;
        DrugStatus status;
        string     location;
    }

    /// @notice Cold-chain temperature reading
    struct TemperatureRecord {
        uint256 timestamp;
        int256  temperature;   // Celsius × 100 (e.g. 500 = 5.00 °C)
        address recorder;
        string  location;
    }

    /// @notice A report filed when a counterfeit is suspected
    struct CounterfeitReport {
        uint256 id;
        uint256 drugId;
        address reporter;
        string  reason;
        uint256 timestamp;
        bool    resolved;
    }

    // ════════════════════════════════════════════
    //              STATE VARIABLES
    // ════════════════════════════════════════════

    address public owner;          // Contract deployer / primary admin
    uint256 public drugCount;      // Auto-increment drug ID
    uint256 public userCount;      // Total registered users
    uint256 public reportCount;    // Total counterfeit reports

    mapping(address => User)               public users;
    mapping(uint256 => Drug)               public drugs;
    mapping(uint256 => TransferRecord[])   private transferHistory;
    mapping(uint256 => TemperatureRecord[]) private temperatureLogs;
    mapping(uint256 => CounterfeitReport)  public reports;
    mapping(string  => uint256)            public batchToDrugId;

    address[] public registeredUsers;

    // ════════════════════════════════════════════
    //                  EVENTS
    // ════════════════════════════════════════════

    event UserRegistered(
        address indexed userAddress,
        string  name,
        Role    role,
        uint256 timestamp
    );

    event DrugRegistered(
        uint256 indexed drugId,
        string  name,
        string  batchNumber,
        address indexed manufacturer,
        uint256 timestamp
    );

    event DrugTransferred(
        uint256    indexed drugId,
        address    indexed from,
        address    indexed to,
        DrugStatus newStatus,
        uint256    timestamp
    );

    event TemperatureRecorded(
        uint256 indexed drugId,
        int256  temperature,
        address indexed recorder,
        uint256 timestamp
    );

    event TemperatureViolation(
        uint256 indexed drugId,
        int256  temperature,
        string  alert,
        uint256 timestamp
    );

    event DrugRecalled(
        uint256 indexed drugId,
        string  reason,
        address recalledBy,
        uint256 timestamp
    );

    event CounterfeitReported(
        uint256 indexed reportId,
        uint256 indexed drugId,
        address indexed reporter,
        string  reason,
        uint256 timestamp
    );

    // ════════════════════════════════════════════
    //                 MODIFIERS
    // ════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner can call this");
        _;
    }

    modifier onlyAdmin() {
        require(users[msg.sender].role == Role.Admin, "Only admin can call this");
        _;
    }

    modifier onlyManufacturer() {
        require(users[msg.sender].role == Role.Manufacturer, "Only manufacturer can call this");
        _;
    }

    modifier onlyDistributor() {
        require(users[msg.sender].role == Role.Distributor, "Only distributor can call this");
        _;
    }

    modifier onlyPharmacy() {
        require(users[msg.sender].role == Role.Pharmacy, "Only pharmacy can call this");
        _;
    }

    modifier onlyRegistered() {
        require(users[msg.sender].isRegistered, "User not registered");
        _;
    }

    modifier drugExists(uint256 _drugId) {
        require(_drugId > 0 && _drugId <= drugCount, "Drug does not exist");
        _;
    }

    modifier notRecalled(uint256 _drugId) {
        require(!drugs[_drugId].isRecalled, "Drug has been recalled");
        _;
    }

    // ════════════════════════════════════════════
    //                CONSTRUCTOR
    // ════════════════════════════════════════════

    /**
     * @dev Deploys the contract and registers the deployer as the system admin.
     *      Demonstrates: genesis block concept – the first record on the ledger.
     */
    constructor() {
        owner = msg.sender;
        users[msg.sender] = User({
            userAddress: msg.sender,
            name:        "System Admin",
            location:    "Headquarters",
            role:        Role.Admin,
            isRegistered: true
        });
        registeredUsers.push(msg.sender);
        userCount = 1;

        emit UserRegistered(msg.sender, "System Admin", Role.Admin, block.timestamp);
    }

    // ════════════════════════════════════════════
    //             USER MANAGEMENT
    // ════════════════════════════════════════════

    /**
     * @notice Register a new supply-chain participant.
     * @dev    Only admin can call. Demonstrates access-control via modifiers.
     */
    function registerUser(
        address _address,
        string  memory _name,
        string  memory _location,
        Role    _role
    ) public onlyAdmin {
        require(!users[_address].isRegistered, "User already registered");
        require(_role != Role.None && _role != Role.Admin, "Invalid role");

        users[_address] = User({
            userAddress: _address,
            name:        _name,
            location:    _location,
            role:        _role,
            isRegistered: true
        });
        registeredUsers.push(_address);
        userCount++;

        emit UserRegistered(_address, _name, _role, block.timestamp);
    }

    // ════════════════════════════════════════════
    //            DRUG REGISTRATION
    // ════════════════════════════════════════════

    /**
     * @notice Manufacturer registers a new drug batch on-chain.
     * @return The auto-incremented drug ID.
     */
    function registerDrug(
        string  memory _name,
        string  memory _batchNumber,
        uint256 _expiryDate,
        string  memory _composition
    ) public onlyManufacturer returns (uint256) {
        require(bytes(_name).length > 0,          "Drug name required");
        require(bytes(_batchNumber).length > 0,    "Batch number required");
        require(_expiryDate > block.timestamp,     "Expiry date must be in the future");
        require(batchToDrugId[_batchNumber] == 0,  "Batch number already registered");

        drugCount++;

        drugs[drugCount] = Drug({
            id:               drugCount,
            name:             _name,
            batchNumber:      _batchNumber,
            manufacturer:     msg.sender,
            manufacturerName: users[msg.sender].name,
            manufactureDate:  block.timestamp,
            expiryDate:       _expiryDate,
            composition:      _composition,
            status:           DrugStatus.Manufactured,
            currentHolder:    msg.sender,
            isRecalled:       false,
            hasTempViolation: false
        });

        batchToDrugId[_batchNumber] = drugCount;

        // First link of the audit trail
        transferHistory[drugCount].push(TransferRecord({
            timestamp:   block.timestamp,
            fromAddress: address(0),          // genesis
            toAddress:   msg.sender,
            status:      DrugStatus.Manufactured,
            location:    users[msg.sender].location
        }));

        emit DrugRegistered(drugCount, _name, _batchNumber, msg.sender, block.timestamp);
        return drugCount;
    }

    // ════════════════════════════════════════════
    //          SUPPLY-CHAIN TRANSFERS
    // ════════════════════════════════════════════

    /// @notice Manufacturer ships drug to a registered distributor.
    function shipToDistributor(uint256 _drugId, address _distributor)
        public
        onlyManufacturer
        drugExists(_drugId)
        notRecalled(_drugId)
    {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender,              "You are not the current holder");
        require(drug.status == DrugStatus.Manufactured,        "Drug must be in Manufactured status");
        require(users[_distributor].role == Role.Distributor,   "Recipient must be a registered distributor");

        drug.status        = DrugStatus.ShippedToDistributor;
        drug.currentHolder = _distributor;

        _recordTransfer(_drugId, msg.sender, _distributor, DrugStatus.ShippedToDistributor);
    }

    /// @notice Distributor confirms receipt of drug shipment.
    function receiveByDistributor(uint256 _drugId)
        public
        onlyDistributor
        drugExists(_drugId)
        notRecalled(_drugId)
    {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender,                       "You are not the designated receiver");
        require(drug.status == DrugStatus.ShippedToDistributor,         "Drug must be in ShippedToDistributor status");

        drug.status = DrugStatus.ReceivedByDistributor;

        _recordTransfer(_drugId, msg.sender, msg.sender, DrugStatus.ReceivedByDistributor);
    }

    /// @notice Distributor ships drug to a registered pharmacy.
    function shipToPharmacy(uint256 _drugId, address _pharmacy)
        public
        onlyDistributor
        drugExists(_drugId)
        notRecalled(_drugId)
    {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender,                "You are not the current holder");
        require(drug.status == DrugStatus.ReceivedByDistributor, "Drug must be at distributor");
        require(users[_pharmacy].role == Role.Pharmacy,          "Recipient must be a registered pharmacy");

        drug.status        = DrugStatus.ShippedToPharmacy;
        drug.currentHolder = _pharmacy;

        _recordTransfer(_drugId, msg.sender, _pharmacy, DrugStatus.ShippedToPharmacy);
    }

    /// @notice Pharmacy confirms receipt of drug shipment.
    function receiveByPharmacy(uint256 _drugId)
        public
        onlyPharmacy
        drugExists(_drugId)
        notRecalled(_drugId)
    {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender,                   "You are not the designated receiver");
        require(drug.status == DrugStatus.ShippedToPharmacy,        "Drug must be in ShippedToPharmacy status");

        drug.status = DrugStatus.ReceivedByPharmacy;

        _recordTransfer(_drugId, msg.sender, msg.sender, DrugStatus.ReceivedByPharmacy);
    }

    /// @notice Pharmacy sells drug to end customer.
    function sellToCustomer(uint256 _drugId, address _customer)
        public
        onlyPharmacy
        drugExists(_drugId)
        notRecalled(_drugId)
    {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender,             "You are not the current holder");
        require(drug.status == DrugStatus.ReceivedByPharmacy, "Drug must be at pharmacy");
        require(block.timestamp < drug.expiryDate,            "Drug has expired and cannot be sold");

        drug.status        = DrugStatus.Sold;
        drug.currentHolder = _customer;

        _recordTransfer(_drugId, msg.sender, _customer, DrugStatus.Sold);
    }

    // ════════════════════════════════════════════
    //         TEMPERATURE  MONITORING
    // ════════════════════════════════════════════

    /**
     * @notice Record a cold-chain temperature reading.
     * @param _temperature Celsius × 100 (e.g. 500 = 5.00 °C).
     *        Safe range for most vaccines / biologics: 2–8 °C → 200–800.
     */
    function recordTemperature(
        uint256 _drugId,
        int256  _temperature,
        string  memory _location
    ) public onlyRegistered drugExists(_drugId) {
        Drug storage drug = drugs[_drugId];
        require(drug.currentHolder == msg.sender, "Only current holder can record temperature");

        temperatureLogs[_drugId].push(TemperatureRecord({
            timestamp:   block.timestamp,
            temperature: _temperature,
            recorder:    msg.sender,
            location:    _location
        }));

        emit TemperatureRecorded(_drugId, _temperature, msg.sender, block.timestamp);

        // Cold-chain violation check
        if (_temperature < 200 || _temperature > 800) {
            drug.hasTempViolation = true;
            emit TemperatureViolation(
                _drugId,
                _temperature,
                "Temperature outside safe cold-chain range (2-8 C)",
                block.timestamp
            );
        }
    }

    // ════════════════════════════════════════════
    //              DRUG RECALL
    // ════════════════════════════════════════════

    /**
     * @notice Recall a drug from the supply chain.
     * @dev    Only admin or the drug's original manufacturer can recall.
     */
    function recallDrug(uint256 _drugId, string memory _reason)
        public
        drugExists(_drugId)
    {
        require(
            users[msg.sender].role == Role.Admin ||
            (users[msg.sender].role == Role.Manufacturer && drugs[_drugId].manufacturer == msg.sender),
            "Only admin or the drug manufacturer can recall"
        );

        Drug storage drug = drugs[_drugId];
        require(!drug.isRecalled, "Drug already recalled");

        drug.isRecalled = true;
        drug.status     = DrugStatus.Recalled;

        transferHistory[_drugId].push(TransferRecord({
            timestamp:   block.timestamp,
            fromAddress: drug.currentHolder,
            toAddress:   address(0),          // pulled from supply chain
            status:      DrugStatus.Recalled,
            location:    "RECALLED"
        }));

        emit DrugRecalled(_drugId, _reason, msg.sender, block.timestamp);
    }

    // ════════════════════════════════════════════
    //          COUNTERFEIT REPORTING
    // ════════════════════════════════════════════

    /**
     * @notice Anyone can report a suspected counterfeit drug.
     */
    function reportCounterfeit(uint256 _drugId, string memory _reason)
        public
        drugExists(_drugId)
    {
        require(bytes(_reason).length > 0, "Reason required");

        reportCount++;
        reports[reportCount] = CounterfeitReport({
            id:        reportCount,
            drugId:    _drugId,
            reporter:  msg.sender,
            reason:    _reason,
            timestamp: block.timestamp,
            resolved:  false
        });

        emit CounterfeitReported(reportCount, _drugId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice Admin marks a counterfeit report as resolved.
     */
    function resolveReport(uint256 _reportId) public onlyAdmin {
        require(_reportId > 0 && _reportId <= reportCount, "Report does not exist");
        reports[_reportId].resolved = true;
    }

    // ════════════════════════════════════════════
    //             VERIFICATION
    // ════════════════════════════════════════════

    /**
     * @notice Verify drug authenticity by ID.
     */
    function verifyDrug(uint256 _drugId)
        public
        view
        drugExists(_drugId)
        returns (
            bool       exists,
            bool       isAuthentic,
            bool       isRecalled,
            bool       isExpired,
            bool       hasTempViolation,
            string memory name,
            string memory batchNumber,
            string memory manufacturer,
            uint256    manufactureDate,
            uint256    expiryDate,
            DrugStatus status
        )
    {
        Drug storage drug = drugs[_drugId];
        bool expired = block.timestamp >= drug.expiryDate;

        return (
            true,
            !drug.isRecalled && !expired,
            drug.isRecalled,
            expired,
            drug.hasTempViolation,
            drug.name,
            drug.batchNumber,
            drug.manufacturerName,
            drug.manufactureDate,
            drug.expiryDate,
            drug.status
        );
    }

    /**
     * @notice Look up a drug by its batch number.
     */
    function verifyByBatch(string memory _batchNumber)
        public
        view
        returns (uint256 drugId, bool exists)
    {
        drugId = batchToDrugId[_batchNumber];
        exists = drugId > 0;
    }

    // ════════════════════════════════════════════
    //                GETTERS
    // ════════════════════════════════════════════

    function getDrugHistory(uint256 _drugId)
        public view drugExists(_drugId)
        returns (TransferRecord[] memory)
    {
        return transferHistory[_drugId];
    }

    function getTemperatureLogs(uint256 _drugId)
        public view drugExists(_drugId)
        returns (TemperatureRecord[] memory)
    {
        return temperatureLogs[_drugId];
    }

    function getDrug(uint256 _drugId)
        public view drugExists(_drugId)
        returns (Drug memory)
    {
        return drugs[_drugId];
    }

    function getUser(address _address)
        public view
        returns (User memory)
    {
        return users[_address];
    }

    function getUsersList()
        public view
        returns (address[] memory)
    {
        return registeredUsers;
    }

    function getRegisteredUserCount()
        public view
        returns (uint256)
    {
        return registeredUsers.length;
    }

    // ════════════════════════════════════════════
    //           INTERNAL HELPERS
    // ════════════════════════════════════════════

    /**
     * @dev Appends a transfer record and emits the DrugTransferred event.
     */
    function _recordTransfer(
        uint256    _drugId,
        address    _from,
        address    _to,
        DrugStatus _status
    ) internal {
        transferHistory[_drugId].push(TransferRecord({
            timestamp:   block.timestamp,
            fromAddress: _from,
            toAddress:   _to,
            status:      _status,
            location:    users[_from].location
        }));

        emit DrugTransferred(_drugId, _from, _to, _status, block.timestamp);
    }
}
