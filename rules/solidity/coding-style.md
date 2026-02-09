# Solidity Coding Style

> This file extends [common/coding-style.md](../common/coding-style.md) with Solidity specific content.

## Immutability (Solidity Context)

**OVERRIDE**: The common immutability rule applies differently in Solidity:

- **State Variables**: Use `immutable` and `constant` keywords where appropriate
- **External Calls**: Patterns like `IOwnable(address).owner()` call functions using the interface ABI on an address - whether they mutate state depends on the function being called
- **Memory vs Storage**: Understand the difference - memory is temporary, storage is persistent
- **View/Pure Functions**: Mark functions that don't modify state as `view` or `pure`

```solidity
// GOOD: Proper use of immutability
contract Token {
    address public immutable owner;
    uint256 public constant MAX_SUPPLY = 1_000_000;

    constructor(address _owner) {
        owner = _owner;
    }

    // External interface call - state mutation depends on the function
    function getOwnerFromExternal(address target) external view returns (address) {
        return IOwnable(target).owner();  // Typically view, but depends on implementation
    }
}

// BAD: Unnecessary state changes
contract BadToken {
    address public owner;

    function updateOwner(address newOwner) external {
        owner = newOwner;  // Should use proper access control
    }
}
```

## File Organization (Contract Size)

**OVERRIDE**: Solidity has unique constraints:

- **Contract Size Limit**: 24KB bytecode limit (EIP-170)
- **No Arbitrary Line Limits**: Don't split contracts just to meet line counts
- **Logical Separation**: Split contracts based on:
  - Functionality (separate concerns)
  - Upgradeability patterns (logic vs storage)
  - Gas optimization (library extraction)
  - Reusability (abstract contracts, interfaces)

```solidity
// GOOD: Logical separation
contract TokenStorage {
    mapping(address => uint256) public balances;
}

contract TokenLogic is TokenStorage {
    function transfer(address to, uint256 amount) external {
        // Implementation
    }
}

// BAD: Splitting just for line count
// Don't do this unless there's a real reason
```

## Naming Conventions

Follow Solidity style guide:
- **Contracts**: PascalCase (`MyContract`)
- **Functions**: camelCase (`transferFrom`)
- **Variables**: camelCase (`totalSupply`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_SUPPLY`)
- **Private/Internal**: Leading underscore (`_internalFunction`)
- **Events**: PascalCase (`Transfer`, `Approval`)

## Error Handling

Use custom errors (gas efficient) over require strings:

```solidity
// GOOD: Custom errors (saves gas)
error InsufficientBalance(uint256 available, uint256 required);
error Unauthorized(address caller);

function transfer(address to, uint256 amount) external {
    if (balances[msg.sender] < amount) {
        revert InsufficientBalance(balances[msg.sender], amount);
    }
}

// ACCEPTABLE: require with string (less gas efficient)
function transferOld(address to, uint256 amount) external {
    require(balances[msg.sender] >= amount, "Insufficient balance");
}
```

## Gas Optimization

ALWAYS consider gas costs:
- Use `uint256` over smaller uints (unless packing)
- Cache storage reads in memory
- Use `calldata` for external function parameters
- Batch operations when possible
- Use events for data that doesn't need on-chain storage

```solidity
// GOOD: Gas optimized
function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
    uint256 senderBalance = balances[msg.sender];  // Cache storage read

    for (uint256 i = 0; i < recipients.length; i++) {
        senderBalance -= amounts[i];
        balances[recipients[i]] += amounts[i];
    }

    balances[msg.sender] = senderBalance;
}

// BAD: Multiple storage reads
function batchTransferBad(address[] calldata recipients, uint256[] calldata amounts) external {
    for (uint256 i = 0; i < recipients.length; i++) {
        balances[msg.sender] -= amounts[i];  // Storage read every iteration
        balances[recipients[i]] += amounts[i];
    }
}
```

## Code Quality Checklist (Solidity)

Before marking work complete:
- [ ] All functions have proper visibility modifiers
- [ ] State-changing functions have access control
- [ ] Custom errors used instead of require strings
- [ ] Gas optimization considered
- [ ] No unused variables or functions
- [ ] Events emitted for important state changes
- [ ] NatSpec comments for public/external functions
- [ ] Reentrancy protection where needed
- [ ] Integer overflow/underflow handled (or using Solidity 0.8+)
