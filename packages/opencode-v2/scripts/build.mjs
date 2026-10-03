// Dependency-free build: strip TypeScript types from src/index.ts into dist/index.js
// using Node's built-in `module.stripTypeScriptTypes` (Node >= 22.13 / 23.6).
// The source has no enums, namespaces, or parameter properties, so "strip" mode is safe.
import { stripTypeScriptTypes } from "node:module"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = readFileSync(resolve(root, "src/index.ts"), "utf8")
const output = stripTypeScriptTypes(source, { mode: "strip", sourceUrl: "index.ts" })

mkdirSync(resolve(root, "dist"), { recursive: true })
writeFileSync(resolve(root, "dist/index.js"), output)
console.log("built dist/index.js")
