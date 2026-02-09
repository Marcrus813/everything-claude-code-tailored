# Solidity Hooks

> This file extends [common/hooks.md](../common/hooks.md) with Solidity specific content.

## Pre-commit Hook

**CRITICAL**: Always run tests before committing.

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "Running tests before commit..."

# Run tests
forge test || {
    echo "❌ Tests failed. Commit aborted."
    exit 1
}

echo "✅ All tests passed. Proceeding with commit."
```

Make the hook executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Alternative: Using Husky (for projects with npm)

```bash
# Install husky
npm install --save-dev husky

# Initialize husky
npx husky init

# Add pre-commit hook
echo "forge test" > .husky/pre-commit
```

## CI/CD Integration

Add to your CI pipeline (GitHub Actions example):

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1

      - name: Run tests
        run: forge test -vvv

      - name: Check coverage
        run: |
          forge coverage --report summary | tee coverage.txt
          COVERAGE=$(grep "Total" coverage.txt | grep -oP '\d+\.\d+' | head -1)
          if (( $(echo "$COVERAGE < 90" | bc -l) )); then
            echo "❌ Coverage below 90% ($COVERAGE%)"
            exit 1
          fi
          echo "✅ Coverage: $COVERAGE%"
```

## Optional: Manual Test Command

For manual testing during development:

```bash
# Run all tests
forge test

# Run tests with verbosity
forge test -vvv

# Run specific test
forge test --match-test testTransfer

# Run tests with gas report
forge test --gas-report

# Run tests with coverage
forge coverage
```

## Notes

- Keep hooks simple and fast
- Only block commits on test failures
- Use CI/CD for comprehensive checks (coverage, static analysis, etc.)
- Developers can skip hooks with `git commit --no-verify` if needed (use sparingly)
