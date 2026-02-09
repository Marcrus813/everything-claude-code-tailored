# Solidity Security

> This file extends [common/security.md](../common/security.md) with Solidity specific content.

## Mandatory Security Checks (Solidity)

Before ANY deployment:
- [ ] Reentrancy protection (checks-effects-interactions pattern)
- [ ] Integer overflow/underflow handled (use Solidity 0.8+ or SafeMath)
- [ ] Access control on all state-changing functions
- [ ] Front-running considerations addressed
- [ ] Gas limit issues considered (loops, external calls)
- [ ] Proper use of `tx.origin` vs `msg.sender`
- [ ] Timestamp dependence avoided for critical logic
- [ ] Delegatecall used safely (storage layout compatibility)
- [ ] External contract calls handled safely
- [ ] Proper event emission for state changes

## Critical Vulnerabilities

### 1. Reentrancy

**ALWAYS** follow checks-effects-interactions pattern:

```solidity
// VULNERABLE
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
    balances[msg.sender] -= amount;  // State change AFTER external call
}

// SECURE
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;  // State change BEFORE external call
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success);
}

// ALSO SECURE: ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    function withdraw(uint256 amount) external nonReentrant {
        // Protected from reentrancy
    }
}
```

### 2. Integer Overflow/Underflow

Use Solidity 0.8+ (automatic checks) or SafeMath:

```solidity
// Solidity 0.8+: Automatic overflow/underflow checks
pragma solidity ^0.8.0;

function add(uint256 a, uint256 b) public pure returns (uint256) {
    return a + b;  // Reverts on overflow
}

// For unchecked operations (when you're sure it's safe)
function addUnchecked(uint256 a, uint256 b) public pure returns (uint256) {
    unchecked {
        return a + b;  // No overflow check (gas savings)
    }
}
```

### 3. Access Control

**NEVER** leave critical functions unprotected:

```solidity
// VULNERABLE
function withdraw() external {
    payable(owner).transfer(address(this).balance);
}

// SECURE
function withdraw() external onlyOwner {
    payable(owner).transfer(address(this).balance);
}

// BETTER: Use OpenZeppelin's AccessControl
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Vault is AccessControl {
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");

    function withdraw() external onlyRole(WITHDRAWER_ROLE) {
        // Protected
    }
}
```

### 4. tx.origin vs msg.sender

**NEVER** use `tx.origin` for authorization:

```solidity
// VULNERABLE: Phishing attack possible
function transfer(address to, uint256 amount) external {
    require(tx.origin == owner, "Not owner");
    // Attacker can trick owner into calling malicious contract
}

// SECURE: Use msg.sender
function transfer(address to, uint256 amount) external {
    require(msg.sender == owner, "Not owner");
}
```

### 5. Delegatecall

Use delegatecall with extreme caution:

```solidity
// VULNERABLE: Storage collision
contract Proxy {
    address public implementation;

    function upgrade(address newImpl) external {
        implementation = newImpl;
    }

    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}

// SECURE: Use established proxy patterns (OpenZeppelin)
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
```

### 6. Front-Running

Be aware of transaction ordering attacks:

```solidity
// VULNERABLE: Front-running possible
mapping(bytes32 => address) public solutions;

function submitSolution(bytes32 hash, uint256 solution) external {
    require(keccak256(abi.encodePacked(solution)) == hash);
    solutions[hash] = msg.sender;
    // Attacker can see solution in mempool and submit first
}

// MITIGATION: Commit-reveal scheme
mapping(address => bytes32) public commits;
mapping(bytes32 => address) public solutions;

function commit(bytes32 hash) external {
    commits[msg.sender] = hash;
}

function reveal(uint256 solution, bytes32 salt) external {
    bytes32 hash = keccak256(abi.encodePacked(solution, salt));
    require(commits[msg.sender] == hash, "Invalid commit");
    solutions[hash] = msg.sender;
}
```

### 7. Timestamp Dependence

Don't rely on `block.timestamp` for critical logic:

```solidity
// VULNERABLE: Miners can manipulate timestamp slightly
function isLotteryOpen() public view returns (bool) {
    return block.timestamp < lotteryEndTime;
}

// BETTER: Use block numbers
function isLotteryOpen() public view returns (bool) {
    return block.number < lotteryEndBlock;
}
```

### 8. Gas Limit Issues

Avoid unbounded loops:

```solidity
// VULNERABLE: Can run out of gas
function distributeRewards(address[] memory recipients) external {
    for (uint256 i = 0; i < recipients.length; i++) {
        payable(recipients[i]).transfer(reward);
    }
}

// SECURE: Batch processing or pull pattern
function claimReward() external {
    uint256 reward = pendingRewards[msg.sender];
    pendingRewards[msg.sender] = 0;
    payable(msg.sender).transfer(reward);
}
```

## Security Tools

Use these tools before deployment:

### Static Analysis
```bash
# Slither (recommended)
slither .

# Mythril
myth analyze contracts/MyContract.sol

# Manticore
manticore contracts/MyContract.sol
```

### Testing
```bash
# Foundry (with fuzzing)
forge test --fuzz-runs 10000

# Hardhat
npx hardhat test
npx hardhat coverage
```

### Formal Verification
- Certora Prover
- K Framework
- SMTChecker (built into Solidity)

## Audit Checklist

Before deployment:
- [ ] All functions have proper access control
- [ ] Reentrancy protection implemented
- [ ] Integer overflow/underflow handled
- [ ] External calls handled safely
- [ ] Events emitted for all state changes
- [ ] Gas optimization doesn't compromise security
- [ ] Upgrade mechanism secure (if upgradeable)
- [ ] Test coverage > 90%
- [ ] Fuzz testing performed
- [ ] Static analysis tools run (Slither, Mythril)
- [ ] External audit completed (for high-value contracts)

## Security Response Protocol

If vulnerability found:
1. **STOP** immediately
2. Assess severity (Critical/High/Medium/Low)
3. For Critical/High:
   - Pause contract if possible
   - Notify stakeholders
   - Prepare fix
   - Deploy fix or upgrade
   - Post-mortem analysis
4. Document incident and lessons learned

## Reference

See OpenZeppelin Contracts for battle-tested implementations:
- Access Control
- Security utilities (ReentrancyGuard, Pausable)
- Token standards (ERC20, ERC721, ERC1155)
- Proxy patterns
