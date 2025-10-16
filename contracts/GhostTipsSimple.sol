// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract GhostTipsSimple is Ownable {
    struct TipJar {
        uint256 id;
        address creator;
        string title;
        string description;
        string category;
        uint256 totalReceived;
        uint256 tipCount;
        bool isActive;
        uint256 createdAt;
    }

    struct Tip {
        uint256 tipJarId;
        uint256 amount;
        uint256 timestamp;
        string message;
        bool isAnonymous;
    }

    uint256 public tipJarCount;
    uint256 public tipCount;

    mapping(uint256 => TipJar) public tipJars;
    mapping(uint256 => Tip) public tips;
    mapping(address => uint256[]) public userTipJars;

    event TipJarCreated(uint256 indexed id, address indexed creator, string title);
    event TipReceived(uint256 indexed tipJarId, uint256 amount, uint256 tipId);

    constructor() Ownable(msg.sender) {}

    function createTipJar(
        string memory _title,
        string memory _description,
        string memory _category
    ) external returns (uint256) {
        tipJarCount++;

        tipJars[tipJarCount] = TipJar({
            id: tipJarCount,
            creator: msg.sender,
            title: _title,
            description: _description,
            category: _category,
            totalReceived: 0,
            tipCount: 0,
            isActive: true,
            createdAt: block.timestamp
        });

        userTipJars[msg.sender].push(tipJarCount);

        emit TipJarCreated(tipJarCount, msg.sender, _title);
        return tipJarCount;
    }

    function sendTip(uint256 _tipJarId, string memory _message) external payable {
        require(tipJars[_tipJarId].isActive, "Tip jar is not active");
        require(msg.value > 0, "Must send ETH with tip");

        tipCount++;

        tips[tipCount] = Tip({
            tipJarId: _tipJarId,
            amount: msg.value,
            timestamp: block.timestamp,
            message: _message,
            isAnonymous: true
        });

        tipJars[_tipJarId].totalReceived += msg.value;
        tipJars[_tipJarId].tipCount++;

        // Transfer to creator
        payable(tipJars[_tipJarId].creator).transfer(msg.value);

        emit TipReceived(_tipJarId, msg.value, tipCount);
    }

    function getTipJarCount() external view returns (uint256) {
        return tipJarCount;
    }

    function getUserTipJars(address _user) external view returns (uint256[] memory) {
        return userTipJars[_user];
    }

    function deactivateTipJar(uint256 _tipJarId) external {
        require(tipJars[_tipJarId].creator == msg.sender, "Not authorized");
        tipJars[_tipJarId].isActive = false;
    }
}
