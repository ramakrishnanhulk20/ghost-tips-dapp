// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, eaddress, ebool, externalEuint32, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GhostTips - Private Tipping & Microgrants Platform
 * @dev A privacy-preserving tipping system using FHEVM
 * @author ZAMA Developer Program Participant
 */
contract GhostTips is SepoliaConfig, Ownable {
    // Encrypted data types for privacy
    struct TipJar {
        uint256 id;
        address creator;
        string title;
        string description;
        string category;
        euint64 encryptedBalance;
        euint32 encryptedTipCount;
        bool isActive;
        uint256 createdAt;
    }

    struct EncryptedTip {
        uint256 tipJarId;
        eaddress encryptedSender;
        euint64 encryptedAmount;
        string encryptedMessage;
        bool isClaimed;
        uint256 createdAt;
    }

    // State variables
    uint256 private tipJarCounter;
    uint256 private tipCounter;

    // Mappings
    mapping(uint256 => TipJar) public tipJars;
    mapping(uint256 => EncryptedTip) public tips;
    mapping(address => uint256[]) public userTipJars;

    // Events
    event TipJarCreated(uint256 indexed id, address indexed creator, string title, string category);

    event GhostTipSent(uint256 indexed tipJarId, uint256 indexed tipId, bytes32 encryptedSenderHash);

    // Constructor
    constructor() Ownable(msg.sender) {
        tipJarCounter = 0;
        tipCounter = 0;
    }

    /**
     * @dev Create a new tip jar for receiving anonymous tips
     */
    function createTipJar(
        string memory _title,
        string memory _description,
        string memory _category
    ) external returns (uint256) {
        tipJarCounter++;

        TipJar storage newTipJar = tipJars[tipJarCounter];
        newTipJar.id = tipJarCounter;
        newTipJar.creator = msg.sender;
        newTipJar.title = _title;
        newTipJar.description = _description;
        newTipJar.category = _category;
        newTipJar.encryptedBalance = FHE.asEuint64(0);
        newTipJar.encryptedTipCount = FHE.asEuint32(0);
        newTipJar.isActive = true;
        newTipJar.createdAt = block.timestamp;

        // Allow contract to handle encrypted data
        FHE.allowThis(newTipJar.encryptedBalance);
        FHE.allowThis(newTipJar.encryptedTipCount);

        // Add to user's tip jars
        userTipJars[msg.sender].push(tipJarCounter);

        emit TipJarCreated(tipJarCounter, msg.sender, _title, _category);
        return tipJarCounter;
    }

    /**
     * @dev Send an anonymous tip to a tip jar
     * @param _tipJarId ID of the tip jar
     * @param _encryptedAmount Encrypted tip amount (externalEuint64)
     * @param _encryptedMessage Optional encrypted message
     * @param inputProof Zero-knowledge proof for input validation
     */
    function sendGhostTip(
        uint256 _tipJarId,
        externalEuint64 _encryptedAmount,
        string memory _encryptedMessage,
        bytes calldata inputProof
    ) external payable {
        require(tipJars[_tipJarId].isActive, "Tip jar is not active");
        require(msg.value > 0, "Must send ETH with tip");

        // Validate and convert encrypted amount using fromExternal
        euint64 encAmount = FHE.fromExternal(_encryptedAmount, inputProof);

        tipCounter++;

        // Store encrypted tip
        EncryptedTip storage newTip = tips[tipCounter];
        newTip.tipJarId = _tipJarId;
        newTip.encryptedSender = FHE.asEaddress(msg.sender);
        newTip.encryptedAmount = encAmount;
        newTip.encryptedMessage = _encryptedMessage;
        newTip.isClaimed = false;
        newTip.createdAt = block.timestamp;

        // Update tip jar encrypted balance and count
        TipJar storage jar = tipJars[_tipJarId];
        jar.encryptedBalance = FHE.add(jar.encryptedBalance, encAmount);
        jar.encryptedTipCount = FHE.add(jar.encryptedTipCount, FHE.asEuint32(1));

        // Allow access to encrypted data
        FHE.allowThis(jar.encryptedBalance);
        FHE.allowThis(jar.encryptedTipCount);
        FHE.allow(encAmount, jar.creator);

        emit GhostTipSent(_tipJarId, tipCounter, keccak256(abi.encodePacked(msg.sender, block.timestamp)));
    }

    /**
     * @dev Get tip jar count
     */
    function getTipJarCount() external view returns (uint256) {
        return tipJarCounter;
    }

    /**
     * @dev Get tip count
     */
    function getTipCount() external view returns (uint256) {
        return tipCounter;
    }

    /**
     * @dev Get user's tip jars
     */
    function getUserTipJars(address _user) external view returns (uint256[] memory) {
        return userTipJars[_user];
    }

    /**
     * @dev Get encrypted balance (only for jar creator)
     */
    function getEncryptedBalance(uint256 _tipJarId) external view returns (euint64) {
        require(tipJars[_tipJarId].creator == msg.sender, "Not authorized");
        return tipJars[_tipJarId].encryptedBalance;
    }
}
