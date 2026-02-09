# Solidity Testing

> This file extends [common/testing.md](../common/testing.md) with Solidity specific content.

## Minimum Test Coverage: 90%

**OVERRIDE**: Solidity requires higher coverage due to immutability of deployed contracts.

Test Types (ALL required):
1. **Unit Tests** - Individual functions, modifiers, edge cases
2. **Integration Tests** - Contract interactions, external calls
3. **Fuzz Tests** - Property-based testing with random inputs
4. **Invariant Tests** - System-wide properties that must always hold
5. **Fork Tests** - Testing against mainnet state (when integrating with existing protocols)

## Testing Frameworks

### Foundry (Recommended)

Fast, modern testing framework with built-in fuzzing:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token token;
    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        token = new Token("Test", "TST");
        token.mint(alice, 1000 ether);
    }

    function testTransfer() public {
        vm.prank(alice);
        token.transfer(bob, 100 ether);

        assertEq(token.balanceOf(alice), 900 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function testCannotTransferMoreThanBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 2000 ether);
    }

    // Fuzz test: test with random inputs
    function testFuzzTransfer(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount <= 1000 ether);

        vm.prank(alice);
        token.transfer(to, amount);

        assertEq(token.balanceOf(alice), 1000 ether - amount);
        assertEq(token.balanceOf(to), amount);
    }

    // Invariant test: total supply never changes
    function invariant_totalSupply() public {
        assertEq(token.totalSupply(), 1000 ether);
    }
}
```

### Hardhat

Alternative framework with JavaScript/TypeScript tests:

```typescript
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Token", function () {
  let token;
  let owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Test", "TST");
    await token.mint(alice.address, ethers.parseEther("1000"));
  });

  it("should transfer tokens", async function () {
    await token.connect(alice).transfer(bob.address, ethers.parseEther("100"));

    expect(await token.balanceOf(alice.address)).to.equal(ethers.parseEther("900"));
    expect(await token.balanceOf(bob.address)).to.equal(ethers.parseEther("100"));
  });

  it("should revert when transferring more than balance", async function () {
    await expect(
      token.connect(alice).transfer(bob.address, ethers.parseEther("2000"))
    ).to.be.reverted;
  });
});
```

## Test-Driven Development (Solidity)

MANDATORY workflow:
1. Write test first (RED)
2. Run test - it should FAIL
3. Write minimal implementation (GREEN)
4. Run test - it should PASS
5. Refactor (IMPROVE)
6. Verify coverage (90%+)
7. Run fuzz tests
8. Run invariant tests

## Testing Best Practices

### 1. Test All Edge Cases

```solidity
function testEdgeCases() public {
    // Zero amount
    vm.prank(alice);
    token.transfer(bob, 0);

    // Transfer to self
    vm.prank(alice);
    token.transfer(alice, 100 ether);

    // Transfer entire balance
    vm.prank(alice);
    token.transfer(bob, token.balanceOf(alice));

    // Transfer to zero address (should revert)
    vm.prank(alice);
    vm.expectRevert();
    token.transfer(address(0), 100 ether);
}
```

### 2. Test Access Control

```solidity
function testOnlyOwnerCanMint() public {
    vm.prank(alice);
    vm.expectRevert("Ownable: caller is not the owner");
    token.mint(bob, 100 ether);
}
```

### 3. Test Events

```solidity
function testTransferEmitsEvent() public {
    vm.prank(alice);
    vm.expectEmit(true, true, false, true);
    emit Transfer(alice, bob, 100 ether);
    token.transfer(bob, 100 ether);
}
```

### 4. Test Reentrancy

```solidity
contract ReentrancyAttacker {
    Vault vault;
    uint256 public attackCount;

    constructor(Vault _vault) {
        vault = _vault;
    }

    function attack() external payable {
        vault.deposit{value: msg.value}();
        vault.withdraw(msg.value);
    }

    receive() external payable {
        if (attackCount < 2) {
            attackCount++;
            vault.withdraw(msg.value);
        }
    }
}

function testReentrancyProtection() public {
    ReentrancyAttacker attacker = new ReentrancyAttacker(vault);
    vm.deal(address(attacker), 1 ether);

    vm.expectRevert();
    attacker.attack();
}
```

### 5. Fuzz Testing

```solidity
// Test with random inputs
function testFuzzMint(address to, uint256 amount) public {
    vm.assume(to != address(0));
    vm.assume(amount < type(uint256).max / 2);

    uint256 totalSupplyBefore = token.totalSupply();
    token.mint(to, amount);

    assertEq(token.balanceOf(to), amount);
    assertEq(token.totalSupply(), totalSupplyBefore + amount);
}
```

### 6. Invariant Testing

```solidity
contract TokenInvariantTest is Test {
    Token token;
    Handler handler;

    function setUp() public {
        token = new Token("Test", "TST");
        handler = new Handler(token);
        targetContract(address(handler));
    }

    // Invariant: sum of all balances equals total supply
    function invariant_balancesEqualTotalSupply() public {
        assertEq(handler.sumBalances(), token.totalSupply());
    }

    // Invariant: total supply never decreases
    function invariant_totalSupplyNeverDecreases() public {
        assertGe(token.totalSupply(), handler.initialTotalSupply());
    }
}
```

### 7. Fork Testing

Test against mainnet state:

```solidity
function testForkUniswapSwap() public {
    // Fork mainnet at specific block
    vm.createSelectFork("mainnet", 18_000_000);

    address WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;

    // Test interaction with real Uniswap contracts
    // ...
}
```

## Coverage Requirements

```bash
# Foundry coverage
forge coverage

# Minimum requirements:
# - Line coverage: 90%+
# - Branch coverage: 85%+
# - Function coverage: 95%+
```

## Gas Optimization Testing

```solidity
function testGasOptimization() public {
    uint256 gasBefore = gasleft();
    token.transfer(bob, 100 ether);
    uint256 gasUsed = gasBefore - gasleft();

    // Assert gas usage is within acceptable range
    assertLt(gasUsed, 50_000);
}
```

## Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
      - name: Run tests
        run: forge test -vvv
      - name: Check coverage
        run: forge coverage --report lcov
      - name: Run Slither
        run: slither .
```

## Test Organization

```
test/
├── unit/
│   ├── Token.t.sol
│   └── Vault.t.sol
├── integration/
│   └── TokenVault.t.sol
├── fuzz/
│   └── TokenFuzz.t.sol
├── invariant/
│   └── TokenInvariant.t.sol
└── fork/
    └── UniswapIntegration.t.sol
```

## Troubleshooting Test Failures

1. Check test isolation (setUp runs before each test)
2. Verify vm.prank/vm.startPrank usage
3. Check for state changes between tests
4. Verify expectRevert is immediately before the call
5. Check gas limits for complex operations
6. Verify fork block number is correct
