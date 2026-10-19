// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract PackRegistry {
    enum Role {
        None,
        Manufacturer,
        Distributor,
        Pharmacy,
        Regulator
    }

    struct Pack {
        bool registered;
        address holder;
        address dispensedBy;
        uint64 dispensedAt;
    }

    address public relayer;
    mapping(address => Role) public roles;
    mapping(bytes32 => Pack) public packs;

    event PackRegistered(
        bytes32 indexed serialHash,
        string batchId,
        address indexed manufacturer
    );
    event Transferred(
        bytes32 indexed serialHash,
        address indexed from,
        address indexed to
    );
    event Dispensed(
        bytes32 indexed serialHash,
        address indexed pharmacy,
        uint64 time
    );
    event ConflictFlagged(
        bytes32 indexed serialHash,
        address indexed firstPharmacy,
        address indexed secondPharmacy,
        uint64 time
    );

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Only relayer");
        _;
    }

    constructor() {
        relayer = msg.sender;
    }

    function addActor(address actor, Role role) external onlyRelayer {
        roles[actor] = role;
    }

    function registerPacks(
        string calldata batchId,
        bytes32[] calldata serialHashes,
        address manufacturer
    ) external onlyRelayer {
        require(
            roles[manufacturer] == Role.Manufacturer,
            "Not a manufacturer"
        );

        for (uint256 i = 0; i < serialHashes.length; i++) {
            bytes32 hash = serialHashes[i];
            require(!packs[hash].registered, "Duplicate hash");

            packs[hash] = Pack({
                registered: true,
                holder: manufacturer,
                dispensedBy: address(0),
                dispensedAt: 0
            });

            emit PackRegistered(hash, batchId, manufacturer);
        }
    }

    function transfer(
        bytes32 serialHash,
        address from,
        address to
    ) external onlyRelayer {
        Pack storage pack = packs[serialHash];
        require(pack.registered, "Pack not registered");
        require(pack.dispensedBy == address(0), "Already dispensed");
        require(pack.holder == from, "Not the holder");
        require(
            roles[to] == Role.Distributor || roles[to] == Role.Pharmacy,
            "Invalid recipient role"
        );

        pack.holder = to;
        emit Transferred(serialHash, from, to);
    }

    function dispense(
        bytes32 serialHash,
        address pharmacy
    ) external onlyRelayer returns (bool) {
        Pack storage pack = packs[serialHash];
        require(pack.registered, "Pack not registered");
        require(roles[pharmacy] == Role.Pharmacy, "Not a pharmacy");

        if (pack.dispensedBy == address(0)) {
            pack.dispensedBy = pharmacy;
            pack.dispensedAt = uint64(block.timestamp);
            emit Dispensed(serialHash, pharmacy, pack.dispensedAt);
            return true;
        } else {
            emit ConflictFlagged(
                serialHash,
                pack.dispensedBy,
                pharmacy,
                uint64(block.timestamp)
            );
            return false;
        }
    }

    function getPack(
        bytes32 serialHash
    )
        external
        view
        returns (
            bool registered,
            address holder,
            address dispensedBy,
            uint64 dispensedAt
        )
    {
        Pack storage pack = packs[serialHash];
        return (
            pack.registered,
            pack.holder,
            pack.dispensedBy,
            pack.dispensedAt
        );
    }
}
