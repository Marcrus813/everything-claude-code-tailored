# Solidity Patterns

> This file extends [common/patterns.md](../common/patterns.md) with Solidity specific content.

## CRITICAL: Use OpenZeppelin Contracts

**ALWAYS use OpenZeppelin implementations instead of writing your own:**

- OpenZeppelin contracts are battle-tested and audited
- Security vulnerabilities in custom implementations can lead to loss of funds
- OpenZeppelin provides standard implementations for common patterns

```bash
# Install OpenZeppelin
npm install @openzeppelin/contracts
# or
forge install OpenZeppelin/openzeppelin-contracts
```

**Examples of what to use from OpenZeppelin:**
- Access Control: `Ownable`, `Ownable2Step`, `AccessControl`
- Security: `ReentrancyGuard`, `Pausable`
- Token Standards: `ERC20`, `ERC721`, `ERC1155`
- Proxy Patterns: `UUPSUpgradeable`, `TransparentUpgradeableProxy`
- Utilities: `SafeERC20`, `Address`, `Strings`

## Access Control Patterns

### Use OpenZeppelin Ownable

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    constructor(address initialOwner) Ownable(initialOwner) {}

    function protectedFunction() external onlyOwner {
        // Only owner can call this
    }
}
```

### Use OpenZeppelin AccessControl for RBAC

```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyContract is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        // Only minters can call this
    }
}
```

## Upgradeability Patterns

### Use OpenZeppelin UUPS Proxy

```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyContractV1 is UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;

    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function setValue(uint256 newValue) external {
        value = newValue;
    }
}
```

### Storage Gap Pattern (OpenZeppelin)

```solidity
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract MyUpgradeableBase is Initializable {
    uint256 public someValue;

    // Reserve storage slots for future variables
    uint256[49] private __gap;
}
```

## Factory Pattern

```solidity
contract TokenFactory {
    event TokenCreated(address indexed token, address indexed creator);

    function createToken(string memory name, string memory symbol) external returns (address) {
        Token token = new Token(name, symbol, msg.sender);
        emit TokenCreated(address(token), msg.sender);
        return address(token);
    }
}
```

## Checks-Effects-Interactions Pattern

**CRITICAL**: Always follow this pattern to prevent reentrancy:

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    mapping(address => uint256) public balances;

    // RECOMMENDED: Use OpenZeppelin's ReentrancyGuard
    function withdraw(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    // ALTERNATIVE: Manual checks-effects-interactions
    function withdrawManual(uint256 amount) external {
        // 1. CHECKS
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // 2. EFFECTS (update state BEFORE external calls)
        balances[msg.sender] -= amount;

        // 3. INTERACTIONS (external calls last)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

## Pull Over Push Pattern

Prefer letting users withdraw rather than pushing payments:

```solidity
// GOOD: Pull pattern
contract Auction {
    mapping(address => uint256) public pendingReturns;

    function bid() external payable {
        address previousBidder = highestBidder;
        uint256 previousBid = highestBid;

        // Update state
        highestBidder = msg.sender;
        highestBid = msg.value;

        // Allow previous bidder to withdraw
        pendingReturns[previousBidder] += previousBid;
    }

    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        pendingReturns[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}

// BAD: Push pattern (can fail if recipient reverts)
contract AuctionBad {
    function bid() external payable {
        // Dangerous: external call in the middle of state changes
        payable(previousBidder).transfer(previousBid);
    }
}
```

## Token Standards

### Use OpenZeppelin Token Implementations

```solidity
// ERC20 Token
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(address initialOwner) ERC20("MyToken", "MTK") Ownable(initialOwner) {
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

// ERC721 NFT
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    constructor(address initialOwner) ERC721("MyNFT", "MNFT") Ownable(initialOwner) {}

    function mint(address to) external onlyOwner {
        _safeMint(to, _tokenIdCounter++);
    }
}

// ERC1155 Multi-Token
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract MyMultiToken is ERC1155, Ownable {
    constructor(address initialOwner) ERC1155("https://api.example.com/token/{id}.json") Ownable(initialOwner) {}

    function mint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }
}
```

## Event-Driven Architecture

Use events for off-chain indexing and monitoring:

```solidity
contract Token {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function transfer(address to, uint256 amount) external returns (bool) {
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
}
```

## Multicall Pattern

Allow batching multiple calls in a single transaction:

```solidity
contract Multicall {
    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall: call failed");
            results[i] = result;
        }
    }
}
```
