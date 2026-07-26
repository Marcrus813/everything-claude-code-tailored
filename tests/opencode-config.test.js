/**
 * Tests for .opencode/opencode.json and .opencode/opencode.global.json local
 * file references.
 *
 * Run with: node tests/opencode-config.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

const repoRoot = path.join(__dirname, '..');
const opencodeDir = path.join(repoRoot, '.opencode');
const commandsDir = path.join(opencodeDir, 'commands');

const configs = [
  { label: 'opencode.json', path: path.join(opencodeDir, 'opencode.json') },
  { label: 'opencode.global.json', path: path.join(opencodeDir, 'opencode.global.json') }
].map(({ label, path: configPath }) => ({
  label,
  path: configPath,
  config: JSON.parse(fs.readFileSync(configPath, 'utf8'))
}));

let passed = 0;
let failed = 0;

function record(ok) {
  if (ok) passed++;
  else failed++;
}

function checkPluginPaths(label, config) {
  const plugins = config.plugin || [];
  for (const pluginPath of plugins) {
    const isRelativePath = pluginPath.startsWith('.') || pluginPath.startsWith('/');

    if (!isRelativePath) {
      // npm package specifier (e.g. "@scope/name") - OpenCode installs this
      // itself via its own Bun-managed cache at startup, not checked on disk here.
      continue;
    }

    assert.ok(!pluginPath.includes('.opencode/'), `[${label}] Plugin path should be config-relative, got: ${pluginPath}`);
    assert.ok(fs.existsSync(path.resolve(opencodeDir, pluginPath)), `[${label}] Plugin path should resolve from .opencode/: ${pluginPath}`);
  }
}

function checkFileRefs(label, config) {
  const refs = [];

  function walk(value) {
    if (typeof value === 'string') {
      const matches = value.matchAll(/\{file:([^}]+)\}/g);
      for (const match of matches) {
        refs.push(match[1]);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  }

  walk(config);

  assert.ok(refs.length > 0, `[${label}] Expected to find file references`);

  for (const ref of refs) {
    assert.ok(!ref.startsWith('.opencode/'), `[${label}] File ref should not duplicate .opencode/: ${ref}`);
    assert.ok(fs.existsSync(path.resolve(opencodeDir, ref)), `[${label}] File ref should resolve from .opencode/: ${ref}`);
  }
}

function checkCommandAgentIds(label, config) {
  const registeredAgents = new Set(Object.keys(config.agent || {}));
  assert.ok(registeredAgents.size > 0, `[${label}] Expected to register at least one agent`);

  for (const entry of fs.readdirSync(commandsDir)) {
    if (!entry.endsWith('.md')) {
      continue;
    }

    const body = fs.readFileSync(path.join(commandsDir, entry), 'utf8');
    const match = body.match(/^agent:\s*(.+)$/m);

    if (!match) {
      continue;
    }

    const agentId = match[1].trim().replace(/^['"]|['"]$/g, '');

    // Regression guard for #2477: opencode registers these agents unscoped
    // in the `agent` map, so ANY namespace-scoped id (`<plugin>:<agent>` —
    // e.g. the Claude Code `everything-claude-code:` prefix) fails to
    // resolve ("Agent not found") and hard-breaks subtask commands like
    // /code-review on opencode. Reject the whole scoped class, not just the
    // one legacy prefix.
    assert.ok(
      !agentId.includes(':'),
      `[${label}] ${entry}: command agent must be an unscoped opencode agent id, got: ${agentId}`
    );

    assert.ok(
      registeredAgents.has(agentId),
      `[${label}] ${entry}: command agent "${agentId}" is not registered in the agent map`
    );
  }
}

for (const { label, config } of configs) {
  record(test(`[${label}] plugin paths do not duplicate the .opencode directory`, () => checkPluginPaths(label, config)));
  record(test(`[${label}] file references are config-relative and resolve to existing files`, () => checkFileRefs(label, config)));
  record(test(`[${label}] command markdown frontmatter agent ids resolve to a registered opencode agent`, () => checkCommandAgentIds(label, config)));
}

record(
  test('opencode.global.json instructions globs each match at least one real file', () => {
    const globalConfig = configs.find(entry => entry.label === 'opencode.global.json').config;
    const globEntries = (globalConfig.instructions || []).filter(entry => entry.includes('*'));

    assert.ok(globEntries.length > 0, 'Expected at least one glob entry in opencode.global.json instructions');

    for (const globEntry of globEntries) {
      // Only supports the simple two-segment shape used here: "<dir>/*/<file>".
      const segments = globEntry.split('/');
      const starIndex = segments.indexOf('*');
      assert.ok(starIndex > 0, `Unsupported glob shape in test helper: ${globEntry}`);

      const baseDir = path.join(repoRoot, ...segments.slice(0, starIndex));
      const trailing = segments.slice(starIndex + 1);
      const trailingFile = trailing[trailing.length - 1];
      const trailingDirs = trailing.slice(0, -1);

      assert.ok(fs.existsSync(baseDir), `[opencode.global.json] Glob base directory missing: ${segments.slice(0, starIndex).join('/')}`);

      const matches = fs.readdirSync(baseDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .some(entry => {
          const targetDir = path.join(baseDir, entry.name, ...trailingDirs);
          if (!fs.existsSync(targetDir)) {
            return false;
          }

          if (!trailingFile.includes('*')) {
            return fs.existsSync(path.join(targetDir, trailingFile));
          }

          const filePattern = new RegExp(`^${trailingFile.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
          return fs.readdirSync(targetDir).some(fileName => filePattern.test(fileName));
        });

      assert.ok(matches, `[opencode.global.json] Glob "${globEntry}" matched no files under ${baseDir}`);
    }
  })
);

console.log(`\nPassed: ${passed}`);
console.log(`Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
