// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IGhostToken {
    function transferFrom(address from, address to, uint64 amount) external returns (bool);
}

contract GhostTipsFHEVM is SepoliaConfig {
    IGhostToken public ghostToken;

    struct TipJar {
        address owner;
        string name;
        euint64 encryptedTotalAmount;
        uint256 totalTipsReceived;
        bool exists;
    }

    struct Tip {
        address sender;
        euint64 encryptedAmount;
        string message;
        uint256 timestamp;
    }

    mapping(uint256 => TipJar) public tipJars;
    mapping(uint256 => Tip[]) public tipsByJar;
    mapping(address => uint256[]) public jarsByOwner;
    mapping(address => euint64) public totalTipsReceived;

    uint256 public nextJarId = 1;

    event TipJarCreated(uint256 indexed jarId, address indexed owner, string name);
    event TipSent(
        uint256 indexed jarId,
        address indexed sender,
        euint64 encryptedAmount,
        string message,
        uint256 timestamp
    );

    constructor(address _ghostToken) SepoliaConfig() {
        ghostToken = IGhostToken(_ghostToken);
    }

    function createTipJar(string memory name) external returns (uint256) {
        uint256 jarId = nextJarId++;

        tipJars[jarId] = TipJar({
            owner: msg.sender,
            name: name,
            encryptedTotalAmount: FHE.asEuint64(0),
            totalTipsReceived: 0,
            exists: true
        });

        jarsByOwner[msg.sender].push(jarId);

        FHE.allowThis(tipJars[jarId].encryptedTotalAmount);
        FHE.allow(tipJars[jarId].encryptedTotalAmount, address(this));
        FHE.allow(tipJars[jarId].encryptedTotalAmount, msg.sender);

        emit TipJarCreated(jarId, msg.sender, name);
        return jarId;
    }

    function sendTip(uint256 jarId, uint64 amount, string memory message) external {
        require(tipJars[jarId].exists, "Tip jar does not exist");
        require(amount > 0, "Amount must be positive");
        require(bytes(message).length <= 280, "Message too long");

        address recipient = tipJars[jarId].owner;

        bool success = ghostToken.transferFrom(msg.sender, recipient, amount);
        require(success, "Token transfer failed");

        euint64 encryptedAmount = FHE.asEuint64(amount);

        // Store the tip
        tipsByJar[jarId].push(
            Tip({sender: msg.sender, encryptedAmount: encryptedAmount, message: message, timestamp: block.timestamp})
        );

        // Update jar stats
        tipJars[jarId].encryptedTotalAmount = FHE.add(tipJars[jarId].encryptedTotalAmount, encryptedAmount);
        tipJars[jarId].totalTipsReceived++;

        // Update receiver's total
        totalTipsReceived[recipient] = FHE.add(totalTipsReceived[recipient], encryptedAmount);

        // Permissions
        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, address(this));
        FHE.allow(encryptedAmount, recipient);
        FHE.allowThis(tipJars[jarId].encryptedTotalAmount);
        FHE.allow(tipJars[jarId].encryptedTotalAmount, address(this));
        FHE.allow(tipJars[jarId].encryptedTotalAmount, recipient);
        FHE.allowThis(totalTipsReceived[recipient]);
        FHE.allow(totalTipsReceived[recipient], address(this));
        FHE.allow(totalTipsReceived[recipient], recipient);

        emit TipSent(jarId, msg.sender, encryptedAmount, message, block.timestamp);
    }

    function getMyTips(
        uint256 jarId
    )
        external
        view
        returns (
            address[] memory senders,
            euint64[] memory encryptedAmounts,
            string[] memory messages,
            uint256[] memory timestamps
        )
    {
        require(tipJars[jarId].owner == msg.sender, "Not jar owner");

        Tip[] memory tips = tipsByJar[jarId];
        uint256 tipCount = tips.length;

        senders = new address[](tipCount);
        encryptedAmounts = new euint64[](tipCount);
        messages = new string[](tipCount);
        timestamps = new uint256[](tipCount);

        for (uint256 i = 0; i < tipCount; i++) {
            senders[i] = tips[i].sender;
            encryptedAmounts[i] = tips[i].encryptedAmount;
            messages[i] = tips[i].message;
            timestamps[i] = tips[i].timestamp;
        }

        return (senders, encryptedAmounts, messages, timestamps);
    }

    function getMyJars() external view returns (uint256[] memory) {
        return jarsByOwner[msg.sender];
    }

    function getTipJarInfo(
        uint256 jarId
    ) external view returns (address owner, string memory name, euint64 encryptedTotal, uint256 tipCount) {
        require(tipJars[jarId].exists, "Jar does not exist");
        TipJar memory jar = tipJars[jarId];
        return (jar.owner, jar.name, jar.encryptedTotalAmount, jar.totalTipsReceived);
    }

    function getLeaderboard(
        uint256 limit
    ) external view returns (address[] memory addresses, euint64[] memory encryptedTotals, uint256[] memory tipCounts) {
        // Simplified version - returns first N jar owners
        uint256 count = nextJarId - 1;
        if (limit < count) count = limit;

        addresses = new address[](count);
        encryptedTotals = new euint64[](count);
        tipCounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            addresses[i] = tipJars[i + 1].owner;
            encryptedTotals[i] = totalTipsReceived[addresses[i]];
            tipCounts[i] = tipJars[i + 1].totalTipsReceived;
        }

        return (addresses, encryptedTotals, tipCounts);
    }
}
