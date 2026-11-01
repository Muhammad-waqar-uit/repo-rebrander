# Rebrand engine

Rename a whole project from one name to another across directories and text
files. Built for the `fans-tech` → `fanhatch` rebrand; works for any pair.

## Files

| File | Purpose |
|---|---|
| `scripts/rebrand.js` | Core engine. Exports `runRebrand({from, to, baseDir})`. |
| `index.js` | Orchestrator. Calls `runRebrand` when `--from`/`--to` are passed. |

## Usage

Standalone:

```bash
node scripts/rebrand.js --from fans-tech --to fanhatch --base-dir "C:\path\to\repos"
```

As part of the full pipeline (rebrand → create repos → push):

```bash
node index.js \
  --from fans-tech --to fanhatch \
  --github-user your-username \
  --name "Your Name" \
  --email "you@example.com" \
  --base-dir "C:\path\to\repos" \
  --confirm-owner
```

## What it does

1. **Renames the project directory** `from` → `to` at the top of `--base-dir`.
   Skipped if the target already exists (idempotent).
2. **Walks every text file** under `--base-dir` and replaces the old name with
   the new one. Skips `node_modules`, `.git`, build dirs, binaries, lockfiles,
   and `.snap`/`.tsbuildinfo` files.
3. **Covers casing variants** automatically — `from` matches as
   `fans-tech`, `fanstech`, `Fans-tech`, `FANS-TECH`, `FansTech`, `Fanstech`.
   No need to list each variant by hand.

Replacement order is longest-first, so `fans-tech-frontend` is handled before
the bare `fans-tech` prefix.

## Safety

- **Idempotent.** Re-running is a no-op once renamed.
- **No git operations.** Pure filesystem rename + text replace.
- **Nothing pushed.** Combine with `index.js` for the full flow.

## Testing

```bash
node --test tests/
```