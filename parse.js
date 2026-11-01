/**
 * Parse repo-rebrander CLI arguments.
 *
 * @param {string[]} argv — process.argv (including the node executable).
 * @returns {{dryRun:boolean, confirmOwner:boolean, user:string, name:string, email:string, baseDir:string, repos:string[]}}
 */
export function parseArgs(argv) {
  const args = argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  return {
    dryRun: args.includes("--dry-run") || args.includes("-n"),
    confirmOwner: args.includes("--confirm-owner") || process.env.CONFIRM_OWNER === "1",
    user: flag("--github-user") || flag("--user") || process.env.GITHUB_USER || "",
    name: flag("--name") || process.env.COMMITTER_NAME || "",
    email: flag("--email") || process.env.COMMITTER_EMAIL || "",
    baseDir: flag("--base-dir") || process.env.BASE_DIR || "",
    repos: (flag("--repos") || process.env.REPOS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}