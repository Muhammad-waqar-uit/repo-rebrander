import assert from "node:assert";
import test from "node:test";
import { parseArgs } from "../parse.js";

// CLI parsing is the only pure logic worth pinning. The git/gh calls are
// external and exercised by running the script with --dry-run.

test("dry-run flag is detected", () => {
  const p = parseArgs(["node", "index.js", "--dry-run"]);
  assert.strictEqual(p.dryRun, true);
});

test("short -n flag is detected", () => {
  const p = parseArgs(["node", "index.js", "-n"]);
  assert.strictEqual(p.dryRun, true);
});

test("no flags = not dry run", () => {
  const p = parseArgs(["node", "index.js"]);
  assert.strictEqual(p.dryRun, false);
});

test("--confirm-owner is detected", () => {
  const p = parseArgs(["node", "index.js", "--confirm-owner"]);
  assert.strictEqual(p.confirmOwner, true);
});

test("no flags = confirmOwner false", () => {
  const p = parseArgs(["node", "index.js"]);
  assert.strictEqual(p.confirmOwner, false);
});

test("repos are split on comma and trimmed", () => {
  const p = parseArgs(["node", "index.js", "--repos", " a , b ,c "]);
  assert.deepStrictEqual(p.repos, ["a", "b", "c"]);
});

test("empty --repos defaults to empty array", () => {
  const p = parseArgs(["node", "index.js"]);
  assert.deepStrictEqual(p.repos, []);
});

test("all flags parse", () => {
  const p = parseArgs([
    "node", "index.js",
    "--github-user", "alice",
    "--name", "Alice A",
    "--email", "alice@example.com",
    "--base-dir", "/tmp/repos",
    "--repos", "x,y",
  ]);
  assert.strictEqual(p.user, "alice");
  assert.strictEqual(p.name, "Alice A");
  assert.strictEqual(p.email, "alice@example.com");
  assert.strictEqual(p.baseDir, "/tmp/repos");
  assert.deepStrictEqual(p.repos, ["x", "y"]);
});

test("env vars fill in when flags absent", () => {
  process.env.GITHUB_USER = "envuser";
  process.env.COMMITTER_NAME = "Env User";
  process.env.COMMITTER_EMAIL = "env@example.com";
  try {
    const p = parseArgs(["node", "index.js"]);
    assert.strictEqual(p.user, "envuser");
    assert.strictEqual(p.name, "Env User");
    assert.strictEqual(p.email, "env@example.com");
  } finally {
    delete process.env.GITHUB_USER;
    delete process.env.COMMITTER_NAME;
    delete process.env.COMMITTER_EMAIL;
  }
});