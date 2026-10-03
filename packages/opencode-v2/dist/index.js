/**
 * ECC (Everything Claude Code) — OpenCode V2 plugin
 *
 * V2-native port of @cocoapuffs813/ecc-universal@2.0.0's OpenCode plugin
 * (originally written against the V1 @opencode-ai/plugin API, which OpenCode
 * v2 refuses to load: "Plugin must export a default definition with an id and
 * an effect or setup function").
 *
 * This file intentionally has NO external imports (only node: builtins) so it
 * cannot hit package-resolution or missing-dependency problems. OpenCode's
 * loader accepts a default export of `{ id, setup }`.
 *
 * Hook parity with the original:
 *   file.edited                 -> event.subscribe("file.edited")
 *   tool.execute.before         -> ctx.tool.hook("execute.before")
 *   tool.execute.after          -> ctx.tool.hook("execute.after")
 *   session.created/idle/deleted-> event.subscribe("session.*")
 *   todo.updated                -> event.subscribe("todo.updated")
 *   shell.env                   -> ctx.shell.hook("create.before")
 *   experimental.session.compacting -> ctx.session.hook("compaction")
 *   permission.ask              -> ctx.permission.hook("evaluate")
 *   tool: { changed-files, dependency-analyzer } -> ctx.tool.transform(...)
 */

import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

                                                  
                                                    

                    
              
              
                         
                      
 

// ---------------------------------------------------------------------------
// Session change store (ported from plugins/lib/changed-files-store.ts)
// ---------------------------------------------------------------------------

const changes = new Map                    ()
let worktreeRoot = ""

function toRelative(p        )         {
  if (!p) return ""
  const normalized = path.normalize(p)
  if (path.isAbsolute(normalized) && worktreeRoot) {
    const rel = path.relative(worktreeRoot, normalized)
    return rel.startsWith("..") ? normalized : rel
  }
  return normalized
}

function recordChange(filePath        , type            )       {
  const rel = toRelative(filePath)
  if (!rel) return
  changes.set(rel, type)
}

function hasChanges()          {
  return changes.size > 0
}

function clearChanges()       {
  changes.clear()
}

function getChangedPaths(filter             )                                                  {
  const list                                                  = []
  for (const [p, t] of changes) {
    if (filter && t !== filter) continue
    list.push({ path: p, changeType: t })
  }
  list.sort((a, b) => a.path.localeCompare(b.path))
  return list
}

function addToTree(children            , segs          , fullPath        , changeType            )       {
  if (segs.length === 0) return
  const [head, ...rest] = segs
  let child = children.find((c) => c.name === head)

  if (rest.length === 0) {
    if (child) {
      child.changeType = changeType
      child.path = fullPath
    } else {
      children.push({ name: head, path: fullPath, changeType, children: [] })
    }
    return
  }

  if (!child) {
    const dirPath = segs.slice(0, -rest.length).join(path.sep)
    child = { name: head, path: dirPath, children: [] }
    children.push(child)
  }
  addToTree(child.children, rest, fullPath, changeType)
}

function buildTree(filter             )             {
  const root             = []
  for (const [relPath, changeType] of changes) {
    if (filter && changeType !== filter) continue
    const segs = relPath.split(path.sep).filter(Boolean)
    if (segs.length === 0) continue
    addToTree(root, segs, relPath, changeType)
  }
  const sortNodes = (nodes            )             =>
    [...nodes]
      .sort((a, b) => {
        const aIsFile = a.changeType !== undefined
        const bIsFile = b.changeType !== undefined
        if (aIsFile !== bIsFile) return aIsFile ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      .map((n) => ({ ...n, children: sortNodes(n.children) }))
  return sortNodes(root)
}

// ---------------------------------------------------------------------------
// Small process/file helpers (replace the V1 Bun `$` shell helper)
// ---------------------------------------------------------------------------

function runCmd(cmd        , args          )                                                           {
  return new Promise((resolve) => {
    try {
      execFile(cmd, args, { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") })
      })
    } catch (e) {
      resolve({ ok: false, stdout: "", stderr: String(e) })
    }
  })
}

function countConsoleLog(absPath        )         {
  try {
    const content = fs.readFileSync(absPath, "utf8")
    const matches = content.match(/console\.log/g)
    return matches ? matches.length : 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default {
  id: "ecc",

  async setup(ctx     ) {
    const baseDir         =
      (ctx?.location?.project?.canonical          ) ||
      (ctx?.location?.directory          ) ||
      process.cwd()
    worktreeRoot = baseDir

    const editedFiles = new Set        ()
    const pendingToolChanges = new Map                                                      ()
    let writeCounter = 0

    const profileOrder                              = { minimal: 0, standard: 1, strict: 2 }
    const normalizeProfile = (value                    )              =>
      value === "minimal" || value === "strict" ? value : "standard"
    const currentProfile = normalizeProfile(process.env.ECC_HOOK_PROFILE)
    const disabledHooks = new Set(
      (process.env.ECC_DISABLED_HOOKS || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    )
    const profileAllowed = (required                             )          =>
      Array.isArray(required)
        ? required.some((entry) => profileOrder[currentProfile] >= profileOrder[entry])
        : profileOrder[currentProfile] >= profileOrder[required]
    const hookEnabled = (
      hookId        ,
      requiredProfile                              = "standard",
    )          => {
      if (disabledHooks.has(hookId)) return false
      return profileAllowed(requiredProfile)
    }

    const log = (level                                     , message        )       => {
      const line = `[ECC] ${message}`
      if (level === "error") console.error(line)
      else if (level === "warn") console.warn(line)
      else if (level === "debug") {
        if (process.env.ECC_DEBUG) console.log(line)
      } else console.log(line)
    }

    const resolvePath = (p        )         => (path.isAbsolute(p) ? p : path.join(baseDir, p))
    const hasProjectFile = (relativePath        )          => {
      try {
        return fs.statSync(resolvePath(relativePath)).isFile()
      } catch {
        return false
      }
    }
    const getFilePath = (input         )                => {
      if (!input || typeof input !== "object") return null
      const args = input                           
      const p = (args.filePath ?? args.file_path ?? args.path)                      
      return typeof p === "string" && p.trim() ? p : null
    }
    const getCommand = (input         )         => {
      if (typeof input === "string") return input
      if (input && typeof input === "object") return String((input                           ).command ?? "")
      return String(input ?? "")
    }

    // -----------------------------------------------------------------------
    // Tool hooks
    // -----------------------------------------------------------------------

    await ctx.tool.hook("execute.before", (event     ) => {
      const tool = event?.tool
      const input = event?.input
      const filePath = getFilePath(input)

      if (tool === "write" && filePath) {
        const absPath = resolvePath(filePath)
        let type                       = "modified"
        try {
          type = fs.existsSync(absPath) ? "modified" : "added"
        } catch {
          type = "modified"
        }
        const key = event?.id ?? `write-${++writeCounter}-${filePath}`
        pendingToolChanges.set(key, { path: filePath, type })
      }

      if (
        hookEnabled("pre:bash:git-push-reminder", "strict") &&
        tool === "bash" &&
        getCommand(input).includes("git push")
      ) {
        log("info", "Remember to review changes before pushing: git diff origin/main...HEAD")
      }

      if (
        hookEnabled("pre:write:doc-file-warning", ["standard", "strict"]) &&
        tool === "write" &&
        typeof filePath === "string"
      ) {
        if (
          /\.(md|txt)$/i.test(filePath) &&
          !/README|CHANGELOG|LICENSE|CONTRIBUTING/.test(filePath)
        ) {
          log("warn", `Creating ${filePath} - consider if this documentation is necessary`)
        }
      }

      if (hookEnabled("pre:bash:tmux-reminder", "strict") && tool === "bash") {
        const cmd = getCommand(input)
        if (
          /^(npm|pnpm|yarn|bun)\s+(install|build|test|run)/.test(cmd) ||
          /^cargo\s+(build|test|run)/.test(cmd) ||
          /^go\s+(build|test|run)/.test(cmd)
        ) {
          log("info", "Long-running command detected - consider using background execution")
        }
      }
    })

    await ctx.tool.hook("execute.after", async (event     ) => {
      const tool = event?.tool
      const input = event?.input
      const filePath = getFilePath(input)

      if (tool === "edit" && filePath) recordChange(filePath, "modified")
      if (tool === "write" && filePath) {
        const key = event?.id ?? `write-${++writeCounter}-${filePath}`
        const pending = pendingToolChanges.get(key)
        if (pending) {
          recordChange(pending.path, pending.type)
          pendingToolChanges.delete(key)
        } else {
          recordChange(filePath, "modified")
        }
      }

      // Post-edit handling for JS/TS sources (format + console.log warning)
      if (filePath && /\.(ts|tsx|js|jsx)$/.test(filePath) && (tool === "edit" || tool === "write")) {
        editedFiles.add(filePath)

        if (hookEnabled("post:edit:format", "strict")) {
          const res = await runCmd("prettier", ["--write", resolvePath(filePath)])
          if (res.ok) log("info", `Formatted: ${filePath}`)
          else log("debug", `Prettier formatting failed for ${filePath}`)
        }

        if (hookEnabled("post:edit:console-warn", ["standard", "strict"])) {
          const count = countConsoleLog(resolvePath(filePath))
          if (count > 0) {
            log("warn", `console.log found in ${filePath} (${count} occurrence${count > 1 ? "s" : ""})`)
          }
        }
      }

      // TypeScript check after editing a .ts/.tsx file
      if (
        hookEnabled("post:edit:typecheck", "strict") &&
        tool === "edit" &&
        filePath &&
        /\.tsx?$/.test(filePath)
      ) {
        const res = await runCmd("npx", ["tsc", "--noEmit"])
        if (res.ok) {
          log("info", "TypeScript check passed")
        } else {
          log("warn", "TypeScript errors detected:")
          res.stdout
            .split("\n")
            .slice(0, 5)
            .forEach((line) => line && log("warn", `  ${line}`))
        }
      }

      if (
        hookEnabled("post:bash:pr-created", ["standard", "strict"]) &&
        tool === "bash" &&
        getCommand(input).includes("gh pr create")
      ) {
        log("info", "PR created - check GitHub Actions status")
      }
    })

    // -----------------------------------------------------------------------
    // Shell environment injection
    // -----------------------------------------------------------------------

    await ctx.shell.hook("create.before", (event     ) => {
      if (!event.env) event.env = {}
      const env = event.env                                      
      env.ECC_VERSION = process.env.ECC_VERSION || "2.0.0"
      env.ECC_PLUGIN = "true"
      env.ECC_HOOK_PROFILE = currentProfile
      env.ECC_DISABLED_HOOKS = process.env.ECC_DISABLED_HOOKS || ""
      env.PROJECT_ROOT = baseDir

      const lockfiles                         = {
        "bun.lockb": "bun",
        "pnpm-lock.yaml": "pnpm",
        "yarn.lock": "yarn",
        "package-lock.json": "npm",
      }
      for (const [lockfile, pm] of Object.entries(lockfiles)) {
        if (hasProjectFile(lockfile)) {
          env.PACKAGE_MANAGER = pm
          break
        }
      }

      const langDetectors                         = {
        "tsconfig.json": "typescript",
        "go.mod": "go",
        "pyproject.toml": "python",
        "Cargo.toml": "rust",
        "Package.swift": "swift",
      }
      const detected           = []
      for (const [file, lang] of Object.entries(langDetectors)) {
        if (hasProjectFile(file)) detected.push(lang)
      }
      if (detected.length > 0) {
        env.DETECTED_LANGUAGES = detected.join(",")
        env.PRIMARY_LANGUAGE = detected[0]
      }
    })

    // -----------------------------------------------------------------------
    // Permission review (V1 permission.ask -> V2 permission.hook("evaluate"))
    // -----------------------------------------------------------------------

    await ctx.permission.hook("evaluate", (event     ) => {
      try {
        if (!hookEnabled("permission:auto-approve-read", "standard")) return
        const action = String(event?.action || "")
        if (["read", "glob", "grep", "search", "list"].includes(action)) {
          event.effect = "allow"
          event.message = "ECC: read-only operation"
        }
      } catch (error) {
        log("error", `Permission handling error: ${error instanceof Error ? error.message : error}`)
      }
    })

    // -----------------------------------------------------------------------
    // Compaction context injection
    // (V1 experimental.session.compacting -> V2 session.hook("compaction"))
    // -----------------------------------------------------------------------

    const buildCompactionContext = ()         => {
      const contextBlock = [
        "# ECC Context (preserve across compaction)",
        "",
        "## Active Plugin: ECC v2.0.0 (OpenCode V2 port)",
        "- Hook profiles: minimal | standard | strict (set ECC_HOOK_PROFILE)",
        "- Tools: changed-files, dependency-analyzer",
        "",
        "## Key Principles",
        "- TDD: write tests first, 80%+ coverage",
        "- Immutability: never mutate, always return new copies",
        "- Security: validate inputs, no hardcoded secrets",
        "",
      ]
      if (editedFiles.size > 0) {
        contextBlock.push("## Recently Edited Files")
        for (const f of editedFiles) contextBlock.push(`- ${f}`)
        contextBlock.push("")
      }
      return contextBlock.join("\n")
    }

    await ctx.session.hook("compaction", (event     ) => {
      try {
        if (Array.isArray(event.system)) {
          event.system.push({ type: "text", text: buildCompactionContext() })
        }
      } catch (error) {
        log("debug", `compaction hook failed: ${error instanceof Error ? error.message : error}`)
      }
    })

    // -----------------------------------------------------------------------
    // Event stream (session lifecycle, file edits, todo progress)
    // -----------------------------------------------------------------------

    const eventType = (e     )         => String(e?.type ?? e?.event ?? "")
    const eventPath = (e     )         =>
      String(e?.path ?? e?.data?.path ?? e?.properties?.path ?? "")

    const runSessionIdleAudit = async () => {
      if (!hookEnabled("stop:check-console-log", ["minimal", "standard", "strict"])) return
      if (editedFiles.size === 0) return

      log("info", "Session idle - running console.log audit")
      let totalConsoleLogCount = 0
      const filesWithConsoleLogs           = []
      for (const file of editedFiles) {
        if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue
        const count = countConsoleLog(resolvePath(file))
        if (count > 0) {
          totalConsoleLogCount += count
          filesWithConsoleLogs.push(file)
        }
      }

      if (totalConsoleLogCount > 0) {
        log("warn", `Audit: ${totalConsoleLogCount} console.log statement(s) in ${filesWithConsoleLogs.length} file(s)`)
        filesWithConsoleLogs.forEach((f) => log("warn", `  - ${f}`))
        log("warn", "Remove console.log statements before committing")
      } else {
        log("info", "Audit passed: No console.log statements found")
      }

      try {
        if (process.platform === "darwin") {
          await runCmd("osascript", ["-e", 'display notification "Task completed!" with title "OpenCode ECC"'])
        } else if (process.platform === "win32") {
          await runCmd("powershell", [
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('Task completed!', 'OpenCode ECC', 'OK', 'Information')",
          ])
        } else if (process.platform === "linux") {
          await runCmd("notify-send", ["OpenCode ECC", "Task completed!"])
        }
      } catch (error) {
        log("debug", `Desktop notification failed: ${error instanceof Error ? error.message : error}`)
      }

      editedFiles.clear()
    }

    const handleEvent = (e     ) => {
      const type = eventType(e)
      if (type === "session.created") {
        if (!hookEnabled("session:start", ["minimal", "standard", "strict"])) return
        log("info", `Session started - profile=${currentProfile}`)
        if (hasProjectFile("CLAUDE.md")) log("info", "Found CLAUDE.md - loading project context")
        return
      }
      if (type === "session.idle") {
        void runSessionIdleAudit().catch(() => {})
        return
      }
      if (type === "session.deleted") {
        if (hookEnabled("session:end-marker", ["minimal", "standard", "strict"])) {
          log("info", "Session ended - cleaning up")
        }
        editedFiles.clear()
        clearChanges()
        pendingToolChanges.clear()
        return
      }
      if (type === "file.edited") {
        const p = eventPath(e)
        if (!p) return
        editedFiles.add(p)
        recordChange(p, "modified")
        if (/\.(ts|tsx|js|jsx)$/.test(p) && hookEnabled("post:edit:console-warn", ["standard", "strict"])) {
          const count = countConsoleLog(resolvePath(p))
          if (count > 0) log("warn", `console.log found in ${p} (${count} occurrence${count > 1 ? "s" : ""})`)
        }
        return
      }
      if (type === "file.watcher.updated") {
        const p = eventPath(e)
        if (!p) return
        const ev = String(e?.event ?? e?.data?.event ?? e?.kind ?? "")
        let changeType             = "modified"
        if (ev === "create" || ev === "add") changeType = "added"
        else if (ev === "delete" || ev === "remove") changeType = "deleted"
        recordChange(p, changeType)
        if (ev === "change" && /\.(ts|tsx|js|jsx)$/.test(p)) editedFiles.add(p)
        return
      }
      if (type === "todo.updated") {
        const todos = e?.todos ?? e?.data?.todos ?? e?.properties?.todos
        if (Array.isArray(todos) && todos.length > 0) {
          const completed = todos.filter((t     ) => t?.done).length
          log("info", `Progress: ${completed}/${todos.length} tasks completed`)
        }
        return
      }
    }

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const e of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            handleEvent(e)
          } catch (error) {
            log("debug", `event handler failed: ${error instanceof Error ? error.message : error}`)
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          log("debug", `event stream ended: ${error instanceof Error ? error.message : error}`)
        }
      }
    })()

    // -----------------------------------------------------------------------
    // Custom tools (V1 tool map -> V2 ctx.tool.transform)
    // -----------------------------------------------------------------------

    const changedFilesExecute = (input     )         => {
      const filter = input?.filter === "all" || !input?.filter ? undefined : (input.filter              )
      const format = input?.format ?? "tree"

      if (!hasChanges()) {
        return JSON.stringify({ changed: false, message: "No files changed in this session" })
      }

      const paths = getChangedPaths(filter)

      if (format === "json") {
        return JSON.stringify(
          {
            changed: true,
            filter: filter ?? "all",
            files: paths.map((p) => ({ path: p.path, changeType: p.changeType })),
            diffCommands: paths
              .filter((p) => p.changeType !== "added")
              .map((p) => `git diff ${p.path}`),
          },
          null,
          2,
        )
      }

      const tree = buildTree(filter)
      const renderTree = (nodes            , indent        )         => {
        const lines           = []
        const indicators                             = { added: "+", modified: "~", deleted: "-" }
        for (const node of nodes) {
          const indicator = node.changeType ? ` (${indicators[node.changeType]})` : ""
          lines.push(`${indent}${node.changeType ? `${node.name}${indicator}` : `${node.name}/`}`)
          if (node.children.length > 0) lines.push(renderTree(node.children, `${indent}  `))
        }
        return lines.join("\n")
      }

      let output = `Changed files (${paths.length}):\n\n${renderTree(tree, "")}`
      const diffHint = paths
        .filter((p) => p.changeType !== "added")
        .slice(0, 5)
        .map((p) => `  git diff ${p.path}`)
        .join("\n")
      if (diffHint) output += `\n\nTo view diff for a file:\n${diffHint}`
      return output
    }

    const dependencyAnalyzerExecute = async (input     )                  => {
      try {
        const cwd = baseDir
        const analysisType = input?.type ?? "all"
        const fix = input?.fix ?? false
        const detectPackageManager = (dir        )         => {
          if (fs.existsSync(path.join(dir, "bun.lockb"))) return "bun"
          if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm"
          if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn"
          if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npm"
          return "npm"
        }
        const packageManager = detectPackageManager(cwd)
        const packageJsonPath = path.join(cwd, "package.json")
        const dependencies        = []
        if (!fs.existsSync(packageJsonPath)) throw new Error("package.json not found")
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
        const pushDeps = (obj                                    , type        ) => {
          if (!obj) return
          for (const [name, version] of Object.entries(obj)) {
            dependencies.push({ name, current: version, type, outdated: false })
          }
        }
        pushDeps(packageJson.dependencies, "production")
        pushDeps(packageJson.devDependencies, "development")
        pushDeps(packageJson.peerDependencies, "peer")

        const summary = {
          total: dependencies.length,
          outdated: dependencies.filter((d) => d.outdated).length,
          vulnerable: dependencies.filter((d) => d.security?.vulnerable).length,
          unused: 0,
        }
        const recommendations           = []
        if (summary.outdated > 0) recommendations.push(`${summary.outdated} outdated dependencies found.`)
        if (summary.vulnerable > 0) recommendations.push(`${summary.vulnerable} vulnerable dependencies found.`)
        if (summary.total > 100) recommendations.push("Large number of dependencies detected. Consider removing unused packages.")
        const hasTypeScript = dependencies.some((d) => d.name === "typescript")
        const hasEslint = dependencies.some((d) => d.name === "eslint")
        const hasPrettier = dependencies.some((d) => d.name === "prettier")
        if (hasTypeScript && !hasEslint) recommendations.push("TypeScript project without ESLint detected. Consider adding linting.")
        if (hasEslint && !hasPrettier) recommendations.push("ESLint without Prettier detected. Consider adding code formatting.")
        if (recommendations.length === 0) recommendations.push("No critical dependency issues found.")

        return JSON.stringify(
          {
            success: true,
            packageManager,
            dependencies: dependencies.slice(0, 50),
            summary,
            recommendations,
            analysisType,
            fixMode: fix,
            platform: process.platform,
          },
          null,
          2,
        )
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: `Failed to analyze dependencies: ${error instanceof Error ? error.message : error}`,
          type: input?.type,
        })
      }
    }

    await ctx.tool.transform((editor     ) => {
      editor.add({
        name: "changed-files",
        description:
          "List files changed by agents in this session as a navigable tree. Shows added (+), modified (~), and deleted (-) indicators. Use filter to show only specific change types. Returns paths for git diff.",
        input: {
          type: "object",
          properties: {
            filter: {
              type: "string",
              enum: ["all", "added", "modified", "deleted"],
              description: "Filter by change type (default: all)",
            },
            format: {
              type: "string",
              enum: ["tree", "json"],
              description: "Output format: tree for terminal display, json for structured data (default: tree)",
            },
          },
          additionalProperties: false,
        },
        execute: async (input     ) => ({ content: changedFilesExecute(input) }),
      })

      editor.add({
        name: "dependency-analyzer",
        description:
          "Analyze project dependencies for outdated packages, security vulnerabilities, and unused dependencies. Supports npm, pnpm, yarn, and bun.",
        input: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["all", "outdated", "security", "unused"],
              description: "Type of analysis to run (default: all)",
            },
            fix: { type: "boolean", description: "Attempt to fix issues automatically (default: false)" },
            depth: { type: "number", description: "Depth of dependency analysis (default: 1)" },
          },
          additionalProperties: false,
        },
        execute: async (input     ) => ({ content: await dependencyAnalyzerExecute(input) }),
      })
    })

    log("info", `Loaded (profile=${currentProfile}) for ${baseDir}`)

    return () => {
      controller.abort()
      clearChanges()
    }
  },
}


//# sourceURL=index.ts