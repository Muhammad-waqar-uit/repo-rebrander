#!/usr/bin/env node
/**
 * rebrand.js — core rebrand engine.
 *
 * Renames directories and replaces text across a project tree so a whole
 * project can be renamed from one name to another.
 *
 * Usage:
 *   node scripts/rebrand.js --from fans-tech --to fanhatch --base-dir "F:\FAN TECH"
 *
 * What it does:
 *   1. Renames the top-level project directories (from -> to).
 *   2. Walks every text file (skipping node_modules/.git/binaries/lockfiles)
 *      and replaces every occurrence of the old name with the new name.
 *
 * Order matters: longer/more-specific strings are replaced first so
 * "fans-tech-frontend" is handled before the bare "fans-tech" prefix.
 *
 * Safe to re-run: idempotent. If the target dir already exists it is skipped.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    from: flag("--from"),
    to: flag("--to"),
    baseDir: flag("--base-dir") || process.env.BASE_DIR || resolve(import.meta.url.replace(/^file:\/\/\/?/, ""), "..", ".."),
  };
}

export function runRebrand({ from, to, baseDir }) {
  if (!from) throw new Error("--from is required (the old project name).");
  if (!to) throw new Error("--to is required (the new project name).");

// Build the replacement list. Order: longest / most specific first.
// We also cover common casing variants so a single flag rebrands everything.
const variants = [
  from,
  from.replace(/-/g, ""),            // fans-tech -> fanstech
  from.charAt(0).toUpperCase() + from.slice(1), // Fans-tech
  from.toUpperCase(),               // FANS-TECH
  from.replace(/(^|[-_])(\w)/g, (_, p, c) => p + c.toUpperCase()), // FansTech
  from.replace(/(^|[-_])(\w)/g, (_, p, c) => p + c.toUpperCase()).replace(/-/g, ""), // FansTech no hyphen
];

const toVariants = [
  to,
  to.replace(/-/g, ""),
  to.charAt(0).toUpperCase() + to.slice(1),
  to.toUpperCase(),
  to.replace(/(^|[-_])(\w)/g, (_, p, c) => p + c.toUpperCase()),
];

// Deduplicate while preserving order.
const seen = new Set();
const replacements = [];
for (let i = 0; i < variants.length; i++) {
  const key = variants[i] + "\u0000" + toVariants[i];
  if (seen.has(key)) continue;
  seen.add(key);
  if (variants[i] && variants[i] !== toVariants[i]) {
    replacements.push([variants[i], toVariants[i]]);
  }
}
// Sort by source length descending so longer matches win.
replacements.sort((a, b) => b[0].length - a[0].length);

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "out", "cache", "broadcast", "lib"]);
const SKIP_FILES = new Set(["package-lock.json", "yarn.lock", "tsconfig.tsbuildinfo"]);

function shouldSkipFile(file) {
  return SKIP_FILES.has(file) || file.endsWith(".snap") || file.endsWith(".tsbuildinfo");
}

function walk(dir, cb) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e)) continue;
    const p = resolve(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, cb);
    else if (st.isFile() && !shouldSkipFile(e)) cb(p);
  }
}

function replaceInFile(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return 0;
  }
  if (buf.includes(0)) return 0; // binary
  let str = buf.toString("utf8");
  let count = 0;
  for (const [fromStr, toStr] of replacements) {
    let out = "";
    let i = 0;
    while (i < str.length) {
      const chunk = str.slice(i, i + 1_000_000);
      const idx = chunk.indexOf(fromStr);
      if (idx === -1) {
        out += chunk;
        i += chunk.length;
      } else {
        out += chunk.slice(0, idx) + toStr;
        i += idx + fromStr.length;
        count++;
      }
    }
    str = out;
  }
  if (count) writeFileSync(file, str);
  return count;
}

  // --- directory renames -------------------------------------------------------
  console.log(`=== Renaming directories: ${from} -> ${to} ===`);
  const src = resolve(baseDir, from);
  const dst = resolve(baseDir, to);
  if (existsSync(src) && !existsSync(dst)) {
    renameSync(src, dst);
    console.log(`  ${from} -> ${basename(dst)}`);
  } else if (existsSync(dst)) {
    console.log(`  ${to} already exists — skipping rename`);
  } else {
    console.log(`  ${from} not found at ${src} — skipping rename`);
  }

  // --- text replacement --------------------------------------------------------
  console.log(`\n=== Replacing text: ${from} -> ${to} ===`);
  console.log(`  variants: ${replacements.map((r) => r[0]).join(", ")}`);
  let totalFiles = 0;
  let totalReplacements = 0;
  walk(baseDir, (file) => {
    const n = replaceInFile(file);
    if (n) {
      totalFiles++;
      totalReplacements += n;
    }
  });
  console.log(`  touched ${totalFiles} files, ${totalReplacements} replacements`);
  console.log("\nDone.");
}

// CLI entry point: only when this file is the direct process entry.
// Compare the normalized file URL of this module against the entry script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { from: f, to: t, baseDir: b } = parseArgs(process.argv);
  runRebrand({ from: f, to: t, baseDir: b });
}