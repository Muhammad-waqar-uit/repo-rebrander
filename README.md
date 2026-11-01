# repo-rebrander

Rebrand every commit in local git repos under your own identity, rename the
project across directories and text files, create matching **private** repos on
your GitHub account, and push.

History and file contents are preserved verbatim. Only the author/committer
name and email on each commit change. Project names are rewritten everywhere.

> ⚠️ **Run only on repos you own.** Rewriting commits changes only the *name* on
> each commit — it does **not** transfer copyright, strip a license, or erase
> provenance. Cloning a public repo and pushing it under your own name is a
> GitHub Terms of Service violation (fraud / impersonation) and exposes you to a
> DMCA takedown. The original public repo still exists; anyone can diff it.
>
> This tool **requires `--confirm-owner`** to run. It is a tripwire, not a
> permission check — it cannot verify you actually own the source repos. You
> are responsible for what you run.

## What it does

For each repo:

1. Commits any pending working-tree changes (so the copy is faithful).
2. Rewrites **author + committer** on every commit to your name/email
   (`git filter-branch --env-filter`). Commit messages and file contents untouched.
3. Drops `refs/original` backup refs.
4. Creates a **private** repo on your GitHub account (`gh repo create --private`).
5. Force-pushes the rewritten history (`git push --force --set-upstream origin main`).

All repos stay private. Make one public later with:

```bash
gh repo edit <user>/<repo> --public
```

## Prerequisites

- Node.js >= 18
- [GitHub CLI](https://cli.github.com/) (`gh`), authenticated as the target account:
  ```bash
  gh auth login
  ```
- Git

## Install

```bash
cd repo-rebrander
npm install
```

## Usage

Dry run (preview only — nothing created or pushed):

```bash
node index.js --dry-run --confirm-owner
```

Real run:

```bash
node index.js \
  --github-user your-username \
  --name "Your Name" \
  --email "you@example.com" \
  --base-dir "C:\path\to\repos" \
  --repos repo-a,repo-b \
  --confirm-owner
```

### Flags

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--github-user` | yes* | `GITHUB_USER` env | Account that will own the repos |
| `--name` | yes* | `COMMITTER_NAME` env | Author name written into commits |
| `--email` | yes* | `COMMITTER_EMAIL` env | Author email written into commits |
| `--confirm-owner` | **yes** | `CONFIRM_OWNER=1` env | Acknowledges you own the source repos. Without it the tool refuses to run. |
| `--base-dir` | no | parent of `index.js` | Directory containing the repos |
| `--repos` | no | `fanhatch-frontend,fanhatch-backend,fanhatch-contracts` | Comma-separated folder names |
| `--dry-run` / `-n` | no | off | Preview only |

\* Required unless set in `.env` (see `.env.example`).

### Env file

Copy `.env.example` → `.env` and fill in. CLI flags override env values.

```bash
cp .env.example .env
# edit .env
node index.js --confirm-owner
```

## Output

```
=== preflight
  gh authenticated as @your-username
  rebranding commits as: Your Name <you@example.com>
  ownership acknowledged: running on repos you have rights to rebrand
  DRY RUN — nothing will be created or pushed.

=== repo-a
  would commit pending changes (3 files)
  would rewrite author/committer on all commits
  would create private repo github.com/your-username/repo-a
  would force-push to git@github.com:your-username/repo-a.git

Done. All repos are PRIVATE under github.com/your-username
```

## Rebranding the project name

Optional. Renames directories and rewrites the project name across every text
file before the git/push step. See [`docs/rebrand.md`](docs/rebrand.md).

```bash
node index.js \
  --from old-name --to new-name \
  --github-user your-username \
  --name "Your Name" \
  --email "you@example.com" \
  --base-dir "C:\path\to\repos" \
  --confirm-owner
```

The rebrand engine is also usable standalone:

```bash
node scripts/rebrand.js --from old-name --to new-name --base-dir "C:\path\to\repos"
```

It covers casing variants automatically (`old-name`, `oldname`, `Old-name`,
`OLD-NAME`, `OldName`, `Oldname`) and skips `node_modules`, `.git`, build
dirs, binaries, and lockfiles. Idempotent — safe to re-run.

## Secrets

`.env` files in the target repos are **not** touched. If they contain live
secrets, remove/rotate them before running — they will be pushed with the rest
of the history. Example envs (`.env.example`) are safe to commit.

## Notes

- `git filter-branch` is slow but bundled with git. `git filter-repo` is faster;
  swap it in if installed.
- Existing `origin` remotes are replaced with `git@github.com:<user>/<repo>.git`.
- If a target repo already exists on GitHub, `gh repo create` fails and that repo
  is skipped. Re-run to push to it after creating it manually.

## License

MIT