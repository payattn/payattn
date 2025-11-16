# Coverage Badge Setup Guide

This repository uses a **simple, standard approach** for coverage badges.

## How it Works

1. **Tests run** → Generate coverage in standard Istanbul/NYC format
2. **Workflow extracts metrics** from `coverage-summary.json` files
3. **Creates `coverage.json`** at repo root in shields.io endpoint format
4. **Commits to main branch** (only on push to main, not PRs)
5. **Shields.io reads from** `https://raw.githubusercontent.com/payattn/payattn/main/coverage.json`
6. **Badge updates automatically** in README

### Why This Approach?

 **Standard format** - Uses shields.io endpoint JSON schema  
 **Simple** - One file at repo root  
 **No external dependencies** - No codecov.io etc account needed  
 **Free** - GitHub + shields.io are both free
 **Permanent URL** - Other tools can read it too  
 **Automatic** - Updates on every merge to main  

## Badge in README

```markdown
[![Coverage](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/payattn/payattn/main/coverage.json)](https://github.com/payattn/payattn/actions/workflows/test.yml)
```

## coverage.json Format

```json
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "75.3%",
  "color": "green"
}
```

### Color Scale:
- 🟢 **Bright Green**: ≥80% function coverage
- 🟢 **Green**: 60-79%
- 🟡 **Yellow**: 40-59%
- 🟠 **Orange**: 20-39%
- 🔴 **Red**: <20%

## Coverage Calculation

Weighted average of function coverage:
- **70%** Backend weight (larger codebase)
- **30%** Advertiser-agent weight

Formula: `(backend_functions * 0.7) + (agent_functions * 0.3)`

## Workflow Logic

### On Pull Requests:
1. - Tests run for backend
2. - Tests run for advertiser-agent
3. - Badge NOT updated (only on main)

### On Merge to Main:
1. - Tests run for backend → Upload artifact
2. - Tests run for advertiser-agent → Upload artifact
3. - Download artifacts (no duplicate test runs!)
4. - Generate `coverage.json`
5. - Commit with `[skip ci]` flag
6. - Badge updates automatically

### Why `[skip ci]`?
Prevents infinite loop - the commit that updates coverage.json doesn't trigger another workflow run.

### Using Dynamic JSON Badge:
If you wanted even more control, shields.io supports reading any JSON:
```markdown
[![Coverage](https://img.shields.io/badge/dynamic/json?url=https://raw.githubusercontent.com/payattn/payattn/main/coverage.json&query=$.message&label=coverage)](...)
```

The endpoint format (current) is simpler and more flexible.

## Troubleshooting

### Badge Not Updating?

1. **Check workflow ran:**
   ```
   https://github.com/payattn/payattn/actions/workflows/test.yml
   ```

2. **Verify coverage.json exists:**
   ```
   https://github.com/payattn/payattn/blob/main/coverage.json
   ```

3. **Check permissions:**
   - Go to: Settings → Actions → General → Workflow permissions
   - Ensure: "Read and write permissions" is enabled

4. **Clear shields.io cache:**
   ```
   https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/payattn/payattn/main/coverage.json&cacheSeconds=300
   ```
   Add `&cacheSeconds=300` to force 5-minute cache

### Badge Shows Error?

- **"invalid"**: JSON format is wrong, check `coverage.json` syntax
- **404**: File doesn't exist at the URL
- **Stale data**: Shields.io caches for ~5 minutes, wait and refresh

## Files Generated

- `coverage.json` - Single file at repo root (shields.io endpoint format)

## Current Status

- **Simple badge configured and ready**  
- **No external dependencies**  
- **Standard format anyone can read**  

Next: Merge changes to main to generate initial `coverage.json`
