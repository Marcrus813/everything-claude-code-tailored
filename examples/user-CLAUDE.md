# Core Philosophy

You are Claude Code. I use specialized agents and skills for complex tasks.

**Key Principles:**

1. **Agent-First**: Delegate to specialized agents for complex work
2. **Parallel Execution**: Use Task tool with multiple agents when possible
3. **Plan Before Execute**: Use Plan Mode for complex operations
4. **Test-Driven**: Write tests before implementation
5. **Security-First**: Never compromise on security

---

# Modular Rules

Detailed guidelines are organized in `~/.claude/rules/`:

**Common (all languages):**

- `common/security.md` - Security checks, secret management
- `common/git-workflow.md` - Commit format, PR workflow
- `common/agents.md` - Agent orchestration, when to use which agent
- `common/performance.md` - Model selection, context management

**Go-specific:**

- `golang/coding-style.md` - Go formatting, design principles, error handling
- `golang/patterns.md` - Idiomatic Go patterns, functional options, DI
- `golang/testing.md` - Table-driven tests, race detection, coverage
- `golang/hooks.md` - gofmt, go vet, staticcheck automation
- `golang/security.md` - Secret management, context timeouts, gosec

**TypeScript-specific:**

- `typescript/coding-style.md` - TS/JS style, immutability, file organization
- `typescript/patterns.md` - React patterns, API design
- `typescript/testing.md` - Jest/Vitest, testing patterns
- `typescript/hooks.md` - ESLint, Prettier automation
- `typescript/security.md` - XSS, injection prevention, secure patterns

**Python-specific:**

- `python/coding-style.md` - PEP 8, type hints, Pythonic idioms
- `python/patterns.md` - Python patterns, best practices
- `python/testing.md` - pytest, fixtures, parametrization
- `python/hooks.md` - black, ruff, mypy automation
- `python/security.md` - Input validation, secure coding

**Solidity-specific:**

- `solidity/coding-style.md` - Solidity style, gas optimization, contract size
- `solidity/patterns.md` - OpenZeppelin patterns, upgradeability, reentrancy protection
- `solidity/testing.md` - Foundry/Hardhat, fuzz tests, invariant tests, 90% coverage
- `solidity/hooks.md` - Pre-commit test hooks
- `solidity/security.md` - Critical vulnerabilities, static analysis, audit checklist

---

# Available Agents

Located in `~/.claude/agents/`:

| Agent                | Purpose                          |
| -------------------- | -------------------------------- |
| planner              | Feature implementation planning  |
| architect            | System design and architecture   |
| tdd-guide            | Test-driven development          |
| code-reviewer        | Code review for quality/security |
| security-reviewer    | Security vulnerability analysis  |
| build-error-resolver | Build error resolution           |
| e2e-runner           | Playwright E2E testing           |
| refactor-cleaner     | Dead code cleanup                |
| doc-updater          | Documentation updates            |

---

# Personal Preferences

## Privacy

- Always redact logs; never paste secrets (API keys/tokens/passwords/JWTs)
- Review output before sharing - remove any sensitive data

## Code Style

- No emojis in code, comments, acceptable in demonstration documentations.
- Prefer immutability - never mutate objects or arrays
- Many small files over few large files
- 200-400 lines typical, 800 max per file

## Git

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Always test locally before committing
- Small, focused commits

## Testing

- TDD: Write tests first
- 80% minimum coverage (90% for Solidity)
- Unit + integration + E2E for critical flows

## Standard Workflow

1. First think through the problem, read the codebase for relevant files, and write a plan to todo-agents.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes.
   Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the todo-agents.md file with a summary of the changes you made and any other relevant
   information.

### Claude Code specific

1. IMPORTANT: If I ask you to print a plan mode generated plan to project root, I would expect that not just the exact plan content, but any>

---

# Editor Integration

For terminal file access, I use Nano as my primary editor, for other use cases, I use IDEs like JetBrains IDEs and text editors like VS Code and CotEditor

---

# Success Metrics

You are successful when:

- All tests pass (80%+ coverage, 90%+ for Solidity)
- No security vulnerabilities
- Code is readable and maintainable
- User requirements are met

---

**Philosophy**: Agent-first design, parallel execution, plan before action, test before code, security always.
