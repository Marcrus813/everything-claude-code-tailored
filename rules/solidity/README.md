# Solidity Rules Summary

This directory contains Solidity-specific rules that extend the common rules with smart contract development best practices.

## Key Overrides from Common Rules

### 1. Immutability (coding-style.md)
- **Common rule**: Never mutate objects
- **Solidity override**: Immutability applies differently
  - Use `immutable` and `constant` keywords for state variables
  - External calls like `IOwnable(address).owner()` call functions using the interface ABI - state mutation depends on the function being called
  - Focus on `view`/`pure` functions and memory vs storage

### 2. File Organization (coding-style.md)
- **Common rule**: 200-400 lines typical, 800 max
- **Solidity override**: No arbitrary line limits
  - Split contracts based on functionality, not line count
  - Consider 24KB bytecode limit (EIP-170)
  - Logical separation for upgradeability, gas optimization, reusability

### 3. Test Coverage (testing.md)
- **Common rule**: 80% minimum coverage
- **Solidity override**: 90% minimum coverage
  - Higher requirement due to immutability of deployed contracts
  - Includes unit, integration, fuzz, invariant, and fork tests

## Files Included

### coding-style.md
- Solidity naming conventions
- Gas optimization patterns
- Custom errors over require strings
- Contract size considerations
- Code quality checklist

### patterns.md
- **CRITICAL**: Always use OpenZeppelin instead of custom implementations
- Access control patterns (Ownable, RBAC)
- Upgradeability patterns (UUPS, Storage Gap)
- Token standards (ERC20, ERC721, ERC1155)
- Checks-Effects-Interactions pattern (reentrancy prevention)
- Pull over Push pattern
- Factory and Multicall patterns

### security.md
- Critical vulnerabilities:
  1. Reentrancy
  2. Integer overflow/underflow
  3. Access control
  4. tx.origin vs msg.sender
  5. Delegatecall
  6. Front-running
  7. Timestamp dependence
  8. Gas limit issues
- Security tools (Slither, Mythril, Manticore)
- Audit checklist
- Security response protocol

### testing.md
- Foundry testing framework (recommended)
- Hardhat alternative
- Test types: unit, integration, fuzz, invariant, fork
- Testing best practices
- Coverage requirements (90%+)
- Gas optimization testing
- CI/CD integration

### hooks.md
- Pre-commit hook to run tests before committing
- CI/CD integration for automated testing
- Simple and fast - only blocks on test failures
- Optional manual test commands for development

## Installation

To use these rules:

```bash
# Copy to your global Claude configuration
cp -r rules/solidity ~/.claude/rules/solidity

# Or use the install script
./install.sh solidity
```

## When These Rules Apply

These rules automatically apply when:
1. The directory `~/.claude/rules/solidity` exists
2. You're working with `.sol` files
3. Common practices are preserved for other languages

## Key Solidity Principles

1. **Use OpenZeppelin**: Always prefer OpenZeppelin implementations over custom code
2. **Security First**: Smart contracts are immutable once deployed
3. **Gas Optimization**: Every operation costs gas
4. **Test Thoroughly**: 90%+ coverage with fuzz and invariant tests
5. **Follow Checks-Effects-Interactions**: Prevent reentrancy attacks
6. **Emit Events**: For off-chain indexing and monitoring
7. **Access Control**: Protect all state-changing functions
8. **Static Analysis**: Run Slither before every deployment

## Recommended Tools

- **Framework**: Foundry (fast, modern, built-in fuzzing)
- **Formatter**: forge fmt
- **Linter**: Solhint
- **Security**: Slither, Mythril
- **Libraries**: OpenZeppelin Contracts
- **Testing**: Foundry with fuzz and invariant tests

## Example Project Structure

```
project/
├── src/
│   ├── Token.sol
│   └── Vault.sol
├── test/
│   ├── unit/
│   │   ├── Token.t.sol
│   │   └── Vault.t.sol
│   ├── integration/
│   │   └── TokenVault.t.sol
│   ├── fuzz/
│   │   └── TokenFuzz.t.sol
│   └── invariant/
│       └── TokenInvariant.t.sol
├── script/
│   └── Deploy.s.sol
├── foundry.toml
└── .claude.json  # Project-specific hooks
```

## Next Steps

1. Install the rules to your global configuration
2. Configure hooks in `~/.claude/settings.json` or project `.claude.json`
3. Set up pre-commit hooks for automatic checks
4. Run `forge init` to start a new Foundry project
5. Follow TDD: write tests first, then implementation
