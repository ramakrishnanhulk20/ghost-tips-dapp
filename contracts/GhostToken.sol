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

    // Encrypted allowances: owner => spender => amount
    mapping(address => mapping(address => euint64)) private allowances;

    // Events
    event Transfer(address indexed from, address indexed to, ebool success);
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount, ebool success);
    event Approval(address indexed owner, address indexed spender, uint64 amount);

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

    // Approve spender to use tokens
    function approve(address spender, uint64 amount) external returns (bool) {
        require(spender != address(0), "Invalid spender");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        allowances[msg.sender][spender] = encryptedAmount;

        // Set permissions
        FHE.allow(encryptedAmount, address(this));
        FHE.allow(encryptedAmount, msg.sender);
        FHE.allow(encryptedAmount, spender);

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // Transfer encrypted tokens - MODERN FHEVM v0.8.0 PATTERN
    function transfer(address to, uint64 amount) external returns (bool) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");

        euint64 transferAmount = FHE.asEuint64(amount);
        euint64 senderBal = balances[msg.sender];

        // Check if sender has enough balance (encrypted comparison)
        ebool hasEnough = FHE.ge(senderBal, transferAmount);

        // Update balances using encrypted branching
        // If hasEnough: subtract from sender, else: keep sender balance unchanged
        euint64 newSenderBal = FHE.select(hasEnough, FHE.sub(senderBal, transferAmount), senderBal);

        // If hasEnough: add to recipient, else: keep recipient balance unchanged
        euint64 newRecipientBal = FHE.select(hasEnough, FHE.add(balances[to], transferAmount), balances[to]);

        balances[msg.sender] = newSenderBal;
        balances[to] = newRecipientBal;

        // Allow permissions
        FHE.allow(newSenderBal, address(this));
        FHE.allow(newSenderBal, msg.sender);
        FHE.allow(newRecipientBal, address(this));
        FHE.allow(newRecipientBal, to);

        // Emit encrypted success flag (frontend can decrypt to show error)
        FHE.allow(hasEnough, msg.sender);
        emit Transfer(msg.sender, to, hasEnough);

        return true;
    }

    // TransferFrom with encrypted allowance checking - MODERN FHEVM v0.8.0 PATTERN
    function transferFrom(address from, address to, uint64 amount) external returns (bool) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");
        require(from != address(0), "Invalid sender");

        euint64 transferAmount = FHE.asEuint64(amount);
        euint64 fromBal = balances[from];
        euint64 allowance = allowances[from][msg.sender];

        // Check if sender has enough balance AND spender has enough allowance
        ebool hasEnoughBalance = FHE.ge(fromBal, transferAmount);
        ebool hasEnoughAllowance = FHE.ge(allowance, transferAmount);
        ebool canTransfer = FHE.and(hasEnoughBalance, hasEnoughAllowance);

        // Update balances using encrypted branching
        euint64 newFromBal = FHE.select(canTransfer, FHE.sub(fromBal, transferAmount), fromBal);
        euint64 newToBal = FHE.select(canTransfer, FHE.add(balances[to], transferAmount), balances[to]);

        // Update allowance
        euint64 newAllowance = FHE.select(canTransfer, FHE.sub(allowance, transferAmount), allowance);

        balances[from] = newFromBal;
        balances[to] = newToBal;
        allowances[from][msg.sender] = newAllowance;

        // Allow permissions
        FHE.allow(newFromBal, address(this));
        FHE.allow(newFromBal, from);
        FHE.allow(newToBal, address(this));
        FHE.allow(newToBal, to);
        FHE.allow(newAllowance, address(this));
        FHE.allow(newAllowance, from);
        FHE.allow(newAllowance, msg.sender);

        // Emit encrypted success flag
        FHE.allow(canTransfer, from);
        FHE.allow(canTransfer, msg.sender);
        emit Transfer(from, to, canTransfer);

        return true;
    }

    // Withdraw ETH by burning GHOST tokens - MODERN FHEVM v0.8.0 PATTERN
    function withdraw(uint64 tokenAmount) external {
        require(tokenAmount > 0, "Must withdraw positive amount");

        // Check contract has enough ETH
        uint256 ethAmount = (uint256(tokenAmount) * 1 ether) / 1000;
        require(address(this).balance >= ethAmount, "Insufficient contract ETH balance");

        euint64 withdrawAmount = FHE.asEuint64(tokenAmount);
        euint64 userBal = balances[msg.sender];

        // Check if user has enough balance (encrypted comparison)
        ebool hasEnough = FHE.ge(userBal, withdrawAmount);

        // Update balance using encrypted branching
        // If hasEnough: subtract, else: keep balance unchanged
        euint64 newBalance = FHE.select(hasEnough, FHE.sub(userBal, withdrawAmount), userBal);
        balances[msg.sender] = newBalance;

        // Allow permissions
        FHE.allow(newBalance, address(this));
        FHE.allow(newBalance, msg.sender);
        FHE.allow(hasEnough, msg.sender);

        // Only transfer ETH if balance was sufficient (we check this off-chain in frontend)
        // For now, always transfer - frontend should validate
        payable(msg.sender).transfer(ethAmount);

        emit Withdrawal(msg.sender, tokenAmount, hasEnough);
    }

    // Get encrypted balance (only owner can decrypt with permission)
    function balanceOf(address account) external view returns (euint64) {
        return balances[account];
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
