# ECC OpenCode V2 plugin (temporary workaround)

A V2-native port of the ECC OpenCode plugin, published as a prerelease version
under the existing `@cocoapuffs813/ecc-universal` package.

## Why this exists

`@cocoapuffs813/ecc-universal` ships a V1-style OpenCode plugin (a bare function
export). OpenCode V2 refuses it with:

> Plugin must export a default definition with an id and an effect or setup function

This package provides a `{ id, setup }` default export that OpenCode V2 loads.
It is self-contained: it imports only `node:` builtins, so it cannot hit
package-resolution failures.

This version is intended to become obsolete once official OpenCode V2 support
lands upstream. It is published on the `opencode-v2` dist-tag so the default
`latest` install is unaffected.

## Install

```sh
npm install @cocoapuffs813/ecc-universal@opencode-v2
```

or with the OpenCode plugin CLI:

```sh
opencode plugin add @cocoapuffs813/ecc-universal@opencode-v2
```

## Contents

- `src/index.ts` — the V2-native plugin source (hooks, tools, event subscriptions).
- `dist/index.js` — the built entrypoint referenced by `main`/`exports`.

Built with `npm run build`, which strips TypeScript types using Node's built-in
`module.stripTypeScriptTypes` (no external compiler dependency).
