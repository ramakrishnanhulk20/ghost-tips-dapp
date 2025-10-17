// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./GhostToken.sol";

contract GhostTipsFHEVM is SepoliaConfig {
    GhostToken public ghostToken;

    struct TipJar {
        uint256 id;
        address creator;
        string title;
        string description;
        string category;
        euint64 encryptedBalance;
        uint256 tipCount;
        bool isActive;
        uint256 createdAt;
    }

    uint256 public tipJarCount;
    mapping(uint256 => TipJar) public tipJars;
    mapping(address => uint256[]) public userTipJars;

    event TipJarCreated(uint256 indexed id, address indexed creator, string title);
    event TipSent(uint256 indexed tipJarId, uint256 amount, uint256 newTipCount, string message);
    event TipJarWithdrawal(uint256 indexed tipJarId, address indexed creator, uint256 amount, ebool success);

    constructor(address payable _ghostToken) SepoliaConfig() {
        ghostToken = GhostToken(_ghostToken);
    }

    function createTipJar(
        string memory _title,
        string memory _description,
        string memory _category
    ) external returns (uint256) {
        tipJarCount++;

        euint64 initialBalance = FHE.asEuint64(0);

        tipJars[tipJarCount] = TipJar({
            id: tipJarCount,
            creator: msg.sender,
            title: _title,
            description: _description,
            category: _category,
            encryptedBalance: initialBalance,
            tipCount: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        FHE.allow(initialBalance, address(this));
        FHE.allow(initialBalance, msg.sender);

        userTipJars[msg.sender].push(tipJarCount);

        emit TipJarCreated(tipJarCount, msg.sender, _title);
        return tipJarCount;
    }

    function sendTip(uint256 _tipJarId, uint64 _amount, string memory _message) external {
        require(_tipJarId > 0 && _tipJarId <= tipJarCount, "Invalid tip jar ID");
        require(_amount > 0, "Tip amount must be greater than 0");
        require(tipJars[_tipJarId].isActive, "Tip jar is not active");

        TipJar storage jar = tipJars[_tipJarId];

        // Transfer GhostTokens from sender to contract using transferFrom
        // User must approve this contract first!
        ghostToken.transferFrom(msg.sender, address(this), _amount);

        // Encrypt the tip amount and add to balance
        euint64 encryptedTipAmount = FHE.asEuint64(_amount);
        jar.encryptedBalance = FHE.add(jar.encryptedBalance, encryptedTipAmount);
        jar.tipCount++;

        // Allow permissions
        FHE.allow(jar.encryptedBalance, address(this));
        FHE.allow(jar.encryptedBalance, jar.creator);

        emit TipSent(_tipJarId, _amount, jar.tipCount, _message);
    }

    // Withdraw tips from tip jar - MODERN FHEVM v0.8.0 PATTERN
    function withdrawFromTipJar(uint256 _tipJarId, uint64 _amount) external {
        require(_tipJarId > 0 && _tipJarId <= tipJarCount, "Invalid tip jar ID");
        TipJar storage jar = tipJars[_tipJarId];
        require(msg.sender == jar.creator, "Only creator can withdraw");
        require(_amount > 0, "Amount must be positive");

        euint64 withdrawAmount = FHE.asEuint64(_amount);
        euint64 jarBal = jar.encryptedBalance;

        // Check if jar has enough balance (encrypted comparison)
        ebool hasEnough = FHE.ge(jarBal, withdrawAmount);

        // Update balance using encrypted branching
        // If hasEnough: subtract, else: keep balance unchanged
        euint64 newBalance = FHE.select(hasEnough, FHE.sub(jarBal, withdrawAmount), jarBal);
        jar.encryptedBalance = newBalance;

        // Allow permissions
        FHE.allow(newBalance, address(this));
        FHE.allow(newBalance, jar.creator);
        FHE.allow(hasEnough, jar.creator);

        // Transfer GHOST tokens to creator
        ghostToken.transfer(jar.creator, _amount);

        emit TipJarWithdrawal(_tipJarId, jar.creator, _amount, hasEnough);
    }

    // Get leaderboard - returns tip counts (public) sorted by popularity
    function getLeaderboard(uint256 limit) external view returns (uint256[] memory, uint256[] memory) {
        uint256 count = tipJarCount > limit ? limit : tipJarCount;
        uint256[] memory ids = new uint256[](count);
        uint256[] memory tipCounts = new uint256[](count);

        // Simple implementation: get top jars by tip count
        for (uint256 i = 1; i <= tipJarCount && i <= limit; i++) {
            ids[i - 1] = i;
            tipCounts[i - 1] = tipJars[i].tipCount;
        }

        // Bubble sort by tip count (descending)
        for (uint256 i = 0; i < count; i++) {
            for (uint256 j = i + 1; j < count; j++) {
                if (tipCounts[j] > tipCounts[i]) {
                    // Swap
                    uint256 tempCount = tipCounts[i];
                    tipCounts[i] = tipCounts[j];
                    tipCounts[j] = tempCount;

                    uint256 tempId = ids[i];
                    ids[i] = ids[j];
                    ids[j] = tempId;
                }
            }
        }

        return (ids, tipCounts);
    }

    function getTipJarCount() external view returns (uint256) {
        return tipJarCount;
    }

    function getUserTipJars(address _user) external view returns (uint256[] memory) {
        return userTipJars[_user];
    }

    function getTipCount(uint256 _tipJarId) external view returns (uint256) {
        require(_tipJarId > 0 && _tipJarId <= tipJarCount, "Invalid tip jar ID");
        return tipJars[_tipJarId].tipCount;
    }

    // Get encrypted balance (requires permission to decrypt)
    function getEncryptedBalance(uint256 _tipJarId) external view returns (euint64) {
        require(_tipJarId > 0 && _tipJarId <= tipJarCount, "Invalid tip jar ID");
        return tipJars[_tipJarId].encryptedBalance;
    }
}
