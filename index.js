#!/usr/bin/env node
/**
 * repo-rebrander
 *
 * Rebrand every commit in local git repos under your own identity, create
 * matching PRIVATE repos on your GitHub account, and push.
 *
 * History and file contents are preserved verbatim. Only the author/committer
 * name and email on each commit change.
 *
 * Usage:
 *   node index.js --base-dir "F:\FAN TECH" --repos fanhatch-frontend,fanhatch-backend,fanhatch-contracts
 *   node index.js --dry-run          # preview only, nothing is created or pushed
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "./parse.js";
import { runRebrand } from "./scripts/rebrand.js";

const { dryRun: DRY_RUN, confirmOwner: CONFIRM_OWNER, user: GH_USER, name: NAME, email: EMAIL, baseDir: BASE_DIR, repos: REPOS } = parseArgs(process.argv);
const FROM = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "";
const TO = process.argv.includes("--to") ? process.argv[process.argv.indexOf("--to") + 1] : "";

if (!GH_USER) {
  fail("--github-user is required (or set GITHUB_USER env).");
}
if (!NAME) {
  fail("--name is required (or set COMMITTER_NAME env).");
}
if (!EMAIL) {
  fail("--email is required (or set COMMITTER_EMAIL env).");
}

// ---------------------------------------------------------------------------
// ownership gate
// ---------------------------------------------------------------------------
// Rewriting commits only changes the *name* on each commit — it does not
// transfer copyright, strip a license, or erase provenance. Cloning a public
// repo and pushing it under your own name is a GitHub ToS violation (fraud /
// impersonation) and exposes you to DMCA takedown. This gate forces an explicit
// acknowledgement before any git/gh work runs. It is a tripwire, not a
// permission check: it cannot verify you actually own the source repos.
if (!CONFIRM_OWNER) {
  fail(
    "Refusing to run without --confirm-owner. " +
      "Rewriting commits does not transfer ownership of the code. " +
      "Use this tool ONLY on repos you have the rights to rebrand. " +
      "Running it on repos you do not own is a GitHub ToS violation and may trigger a DMCA takedown."
  );
}
log("  ownership acknowledged: running on repos you have rights to rebrand");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const run = (cmd, args_, opts = {}) => {
  const r = spawnSync(cmd, args_, { stdio: "pipe", encoding: "utf8", ...opts });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    error: r.error,
  };
};

function log(msg) { console.log(msg); }
function ok(msg) { console.log(`  ok: ${msg}`); }
function warn(msg) { console.log(`  warn: ${msg}`); }
function step(msg) { console.log(`\n=== ${msg}`); }
function fail(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}
function assert(cond, msg) {
  if (!cond) fail(msg);
}

const repoDir = (name) => resolve(BASE_DIR, name);

// ---------------------------------------------------------------------------
// preflight
// ---------------------------------------------------------------------------
step("preflight");
const ghVer = run("gh", ["--version"]);
assert(ghVer.ok, `gh CLI not found or not working (${ghVer.stderr}). Install it: https://cli.github.com/`);
const gitVer = run("git", ["--version"]);
assert(gitVer.ok, `git not found (${gitVer.stderr}).`);

const whoami = run("gh", ["api", "user", "--jq", ".login"]);
assert(
  whoami.ok && whoami.stdout.trim() === GH_USER,
  `gh is logged in as "${whoami.stdout.trim()}", but --github-user is "${GH_USER}". ` +
    `Run 'gh auth login' as ${GH_USER} or pass --github-user ${whoami.stdout.trim()}.`
);
log(`  gh authenticated as @${whoami.stdout.trim()}`);
log(`  rebranding commits as: ${NAME} <${EMAIL}>`);
if (DRY_RUN) {
  log("  DRY RUN — nothing will be created or pushed.");
}

// Optional project rebrand (rename dirs + text). Runs before git ops.
if (FROM && TO) {
  if (DRY_RUN) {
    log(`  would rebrand ${FROM} -> ${TO}`);
  } else {
    log(`\n=== Rebranding project: ${FROM} -> ${TO} ===`);
    runRebrand({ from: FROM, to: TO, baseDir: BASE_DIR });
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const targets = REPOS.length ? REPOS : ["fanhatch-frontend", "fanhatch-backend", "fanhatch-contracts"];

for (const repo of targets) {
  const dir = repoDir(repo);
  step(repo);
  assert(existsSync(`${dir}/.git`), `not a git repo: ${dir}`);

  // 1. commit any pending working-tree changes so the copy is faithful.
  run("git", ["-C", dir, "add", "-A"]);
  const pending = run("git", ["-C", dir, "status", "--porcelain"]).stdout;
  if (pending) {
    if (DRY_RUN) {
      log(`  would commit pending changes (${pending.split("\n").length} files)`);
    } else {
      run("git", ["-C", dir, "commit", "-m", "chore: sync local working-tree changes"], { stdio: "ignore" });
      ok("committed pending working-tree changes");
    }
  }

  // 2. rewrite author/committer on every commit. Messages and content untouched.
  if (DRY_RUN) {
    log("  would rewrite author/committer on all commits");
  } else {
    const env = {
      ...process.env,
      GF_NAME: NAME,
      GF_EMAIL: EMAIL,
    };
    const r = spawnSync(
      "git",
      [
        "-C", dir,
        "filter-branch", "-f",
        "--env-filter",
        `export GIT_AUTHOR_NAME='${NAME}'; export GIT_AUTHOR_EMAIL='${EMAIL}'; export GIT_COMMITTER_NAME='${NAME}'; export GIT_COMMITTER_EMAIL='${EMAIL}'`,
        "--", "--all",
      ],
      { stdio: "pipe", encoding: "utf8", env }
    );
    if (r.status !== 0) {
      fail(`history rewrite failed for ${repo}: ${r.stderr}`);
    }
    // drop backup refs created by filter-branch.
    const refs = run("git", ["-C", dir, "for-each-ref", "--format=%(refname)", "refs/original"]).stdout;
    for (const ref of refs.split("\n").filter(Boolean)) {
      run("git", ["-C", dir, "update-ref", "-d", ref]);
    }
    ok(`history rewritten to ${NAME} <${EMAIL}>`);
  }

  // 3. create a PRIVATE repo on your GitHub account.
  const remote = `git@github.com:${GH_USER}/${repo}.git`;
  if (DRY_RUN) {
    log(`  would create private repo github.com/${GH_USER}/${repo}`);
  } else {
    const created = run("gh", ["repo", "create", `${GH_USER}/${repo}`, "--source", dir, "--private"]);
    if (!created.ok) {
      warn(`gh repo create failed: ${created.stderr || created.stdout}`);
      warn("If the repo already exists, re-run with --existing to skip creation.");
      continue;
    }
    ok(`created private repo github.com/${GH_USER}/${repo}`);
  }

  // 4. force-push rewritten history.
  if (DRY_RUN) {
    log(`  would force-push to ${remote}`);
  } else {
    run("git", ["-C", dir, "remote", "set-url", "origin", remote]);
    const pushed = run("git", ["-C", dir, "push", "--force", "--set-upstream", "origin", "main"]);
    if (!pushed.ok) {
      fail(`push failed for ${repo}: ${pushed.stderr || pushed.stdout}`);
    }
    ok(`pushed to ${remote}`);
  }
}

log(`\nDone. All repos are PRIVATE under github.com/${GH_USER}`);
log("Make public later: gh repo edit " + GH_USER + "/<repo> --public");