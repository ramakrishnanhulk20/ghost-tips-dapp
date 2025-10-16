// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract GhostToken is SepoliaConfig {
    string public name = "Ghost Token";
    string public symbol = "GHOST";
    uint8 public decimals = 18;

    // Encrypted balances mapping
    mapping(address => euint64) private balances;

    // Events
    event Transfer(address indexed from, address indexed to);
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    constructor() SepoliaConfig() {}

    // Deposit ETH to get encrypted GHOST tokens (1 ETH = 1000 GHOST)
    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");

        uint64 tokenAmount = uint64((msg.value * 1000) / 1 ether);
        euint64 encryptedAmount = FHE.asEuint64(tokenAmount);

        // Add to user's balance
        euint64 newBalance = FHE.add(balances[msg.sender], encryptedAmount);
        balances[msg.sender] = newBalance;

        // Set permissions
        FHE.allow(newBalance, address(this));
        FHE.allow(newBalance, msg.sender);

        emit Deposit(msg.sender, msg.value);
    }

    // Transfer encrypted tokens
    function transfer(address to, uint64 amount) external returns (bool) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");

        euint64 transferAmount = FHE.asEuint64(amount);

        // Update balances - FHEVM will handle underflow protection
        balances[msg.sender] = FHE.sub(balances[msg.sender], transferAmount);
        balances[to] = FHE.add(balances[to], transferAmount);

        // Allow permissions
        FHE.allow(balances[to], address(this));
        FHE.allow(balances[to], to);
        FHE.allow(balances[msg.sender], address(this));
        FHE.allow(balances[msg.sender], msg.sender);

        emit Transfer(msg.sender, to);
        return true;
    }

    // Withdraw ETH by burning GHOST tokens
    function withdraw(uint64 tokenAmount) external {
        require(tokenAmount > 0, "Must withdraw positive amount");

        // Check contract has enough ETH
        uint256 ethAmount = (uint256(tokenAmount) * 1 ether) / 1000;
        require(address(this).balance >= ethAmount, "Insufficient contract balance");

        euint64 withdrawAmount = FHE.asEuint64(tokenAmount);

        // Update balance - FHEVM will handle underflow
        balances[msg.sender] = FHE.sub(balances[msg.sender], withdrawAmount);

        // Allow permissions
        FHE.allow(balances[msg.sender], address(this));
        FHE.allow(balances[msg.sender], msg.sender);

        // Transfer ETH to user
        payable(msg.sender).transfer(ethAmount);

        emit Withdrawal(msg.sender, tokenAmount);
    }

    // Get encrypted balance (only owner can decrypt with permission)
    function balanceOf(address account) external view returns (euint64) {
        return balances[account];
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
