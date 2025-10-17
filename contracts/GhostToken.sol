// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract GhostToken is SepoliaConfig {
    string public name = "Ghost Token";
    string public symbol = "GHOST";
    uint8 public decimals = 18;

    mapping(address => euint64) private balances;
    mapping(address => mapping(address => euint64)) private allowances;
    mapping(address => bool) private isInitialized;

    // Track plaintext balances for withdraw validation
    mapping(address => uint64) private plaintextBalances;

    event Transfer(address indexed from, address indexed to, ebool success);
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint64 amount);

    constructor() SepoliaConfig() {}

    function _initializeBalance(address account) private {
        if (!isInitialized[account]) {
            balances[account] = FHE.asEuint64(0);
            FHE.allowThis(balances[account]);
            FHE.allow(balances[account], address(this));
            FHE.allow(balances[account], account);
            isInitialized[account] = true;
        }
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send ETH");

        _initializeBalance(msg.sender);

        uint64 tokenAmount = uint64((msg.value * 1000) / 1 ether);
        euint64 encryptedAmount = FHE.asEuint64(tokenAmount);

        euint64 newBalance = FHE.add(balances[msg.sender], encryptedAmount);
        balances[msg.sender] = newBalance;

        // Update plaintext balance
        plaintextBalances[msg.sender] += tokenAmount;

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, address(this));
        FHE.allow(newBalance, msg.sender);

        emit Deposit(msg.sender, msg.value);
    }

    function approve(address spender, uint64 amount) external returns (bool) {
        require(spender != address(0), "Invalid spender");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        allowances[msg.sender][spender] = encryptedAmount;

        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, address(this));
        FHE.allow(encryptedAmount, msg.sender);
        FHE.allow(encryptedAmount, spender);

        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint64 amount) external returns (bool) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");
        require(plaintextBalances[msg.sender] >= amount, "Insufficient balance");

        _initializeBalance(msg.sender);
        _initializeBalance(to);

        euint64 transferAmount = FHE.asEuint64(amount);
        euint64 senderBal = balances[msg.sender];

        FHE.allowThis(senderBal);

        ebool hasEnough = FHE.ge(senderBal, transferAmount);

        euint64 newSenderBal = FHE.select(hasEnough, FHE.sub(senderBal, transferAmount), senderBal);
        euint64 newRecipientBal = FHE.select(hasEnough, FHE.add(balances[to], transferAmount), balances[to]);

        balances[msg.sender] = newSenderBal;
        balances[to] = newRecipientBal;

        // Update plaintext balances
        plaintextBalances[msg.sender] -= amount;
        plaintextBalances[to] += amount;

        FHE.allowThis(newSenderBal);
        FHE.allowThis(newRecipientBal);
        FHE.allow(newSenderBal, address(this));
        FHE.allow(newSenderBal, msg.sender);
        FHE.allow(newRecipientBal, address(this));
        FHE.allow(newRecipientBal, to);
        FHE.allow(hasEnough, msg.sender);

        emit Transfer(msg.sender, to, hasEnough);
        return true;
    }

    function transferFrom(address from, address to, uint64 amount) external returns (bool) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");
        require(from != address(0), "Invalid sender");
        require(plaintextBalances[from] >= amount, "Insufficient balance");

        _initializeBalance(from);
        _initializeBalance(to);

        euint64 transferAmount = FHE.asEuint64(amount);
        euint64 fromBal = balances[from];
        euint64 allowance = allowances[from][msg.sender];

        FHE.allowThis(fromBal);
        FHE.allowThis(allowance);

        ebool hasEnoughBalance = FHE.ge(fromBal, transferAmount);
        ebool hasEnoughAllowance = FHE.ge(allowance, transferAmount);
        ebool canTransfer = FHE.and(hasEnoughBalance, hasEnoughAllowance);

        euint64 newFromBal = FHE.select(canTransfer, FHE.sub(fromBal, transferAmount), fromBal);
        euint64 newToBal = FHE.select(canTransfer, FHE.add(balances[to], transferAmount), balances[to]);
        euint64 newAllowance = FHE.select(canTransfer, FHE.sub(allowance, transferAmount), allowance);

        balances[from] = newFromBal;
        balances[to] = newToBal;
        allowances[from][msg.sender] = newAllowance;

        // Update plaintext balances
        plaintextBalances[from] -= amount;
        plaintextBalances[to] += amount;

        FHE.allowThis(newFromBal);
        FHE.allowThis(newToBal);
        FHE.allowThis(newAllowance);
        FHE.allow(newFromBal, address(this));
        FHE.allow(newFromBal, from);
        FHE.allow(newToBal, address(this));
        FHE.allow(newToBal, to);
        FHE.allow(newAllowance, address(this));
        FHE.allow(newAllowance, from);
        FHE.allow(newAllowance, msg.sender);
        FHE.allow(canTransfer, from);
        FHE.allow(canTransfer, msg.sender);

        emit Transfer(from, to, canTransfer);
        return true;
    }

    function withdraw(uint64 tokenAmount) external {
        require(tokenAmount > 0, "Must withdraw positive amount");
        require(plaintextBalances[msg.sender] >= tokenAmount, "Insufficient token balance");

        _initializeBalance(msg.sender);

        uint256 ethAmount = (uint256(tokenAmount) * 1 ether) / 1000;
        require(address(this).balance >= ethAmount, "Insufficient contract ETH balance");

        euint64 withdrawAmount = FHE.asEuint64(tokenAmount);
        euint64 userBal = balances[msg.sender];

        FHE.allowThis(userBal);

        ebool hasEnough = FHE.ge(userBal, withdrawAmount);
        euint64 newBalance = FHE.select(hasEnough, FHE.sub(userBal, withdrawAmount), userBal);
        balances[msg.sender] = newBalance;

        // Update plaintext balance
        plaintextBalances[msg.sender] -= tokenAmount;

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, address(this));
        FHE.allow(newBalance, msg.sender);
        FHE.allow(hasEnough, msg.sender);

        payable(msg.sender).transfer(ethAmount);

        emit Withdrawal(msg.sender, tokenAmount);
    }

    function balanceOf(address account) external view returns (euint64) {
        return balances[account];
    }

    function plaintextBalanceOf(address account) external view returns (uint64) {
        return plaintextBalances[account];
    }

    receive() external payable {}
}
