# Usage

## Step-by-step

> ⚠️ **Ownership.** Run only on repos you own. Rewriting commits changes only the
> *name* on each commit — it does **not** transfer copyright, strip a license,
> or erase provenance. Cloning a public repo and pushing it under your own name
> is a GitHub Terms of Service violation (fraud / impersonation) and exposes you
> to a DMCA takedown. The original public repo still exists; anyone can diff it.
> This tool cannot verify ownership — it only asks you to acknowledge it.

1. **Authenticate** as the account that will own the repos:
   ```bash
   gh auth login
   ```
   Verify: `gh api user --jq .login`

2. **Fill in identity** (CLI or `.env`):
   ```bash
   node index.js --github-user your-username \
                --name "Your Name" \
                --email "you@example.com"
   ```

3. **Acknowledge ownership** (required):
   ```bash
   node index.js --confirm-owner
   ```
   Without this flag the tool refuses to run. It is a tripwire, not a
   permission check — it cannot verify you actually own the source repos.

4. **Dry run** to preview:
   ```bash
   node index.js --dry-run --confirm-owner
   ```

5. **Run** for real:
   ```bash
   node index.js --confirm-owner
   ```

6. **Verify** on GitHub: `github.com/<user>/<repo>` — private, history intact,
   commits now under your name.

7. **Make public later** (optional):
   ```bash
   gh repo edit <user>/<repo> --public
   ```

## What changes in each commit

| Field | Before | After |
|---|---|---|
| `git log --format=%an` | old author | your name |
| `git log --format=%ae` | old email | your email |
| `git log --format=%cn` | old committer | your name |
| `git log --format=%ce` | old committer email | your email |
| commit message | unchanged | unchanged |
| file contents | unchanged | unchanged |

## Troubleshooting

**"gh is logged in as X, but --github-user is Y"**
Re-authenticate as the target account: `gh auth login`, then re-run.

**"not a git repo: ..."**
The folder under `--base-dir` has no `.git`. Check the name or pass `--repos`.

**"gh repo create failed"**
The repo already exists on GitHub under that account, or the name is taken.
Create it manually or pick another name.

**"history rewrite failed"**
Run with `--dry-run` first to confirm the repo path is right. `filter-branch`
needs a clean working tree; pending changes are committed automatically.

**filter-branch is slow**
Install `git filter-repo` and replace the `filter-branch` invocation in
`index.js` with `git filter-repo --force --commit-callback`.

## Security

- Nothing is made public. `gh repo create --private` + `--push`-less flow.
- `.env` files with live secrets are not handled. Remove or rotate them first.
- Run only on repos you own.