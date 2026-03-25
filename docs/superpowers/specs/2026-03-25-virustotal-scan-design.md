# VirusTotal Antivirus Scan in Release Pipeline

**Date:** 2026-03-25
**Status:** Approved

## Summary

Add a VirusTotal antivirus scan step to the release pipeline so that every release artifact is scanned by ~70 antivirus engines before publication. Each GitHub release includes a table with scan results and direct links to VirusTotal reports, giving users confidence that the binaries are clean.

## Context

GitSmith is an Electron desktop app distributed as `.msi`, `.deb`, `.rpm`, and `.zip` for Windows, Linux, and macOS. Unsigned Electron apps frequently trigger SmartScreen warnings and antivirus false positives. Providing VirusTotal scan reports in release notes builds trust with users.

## Design

### Pipeline Flow

The release workflow (`release.yml`) is restructured from 2 jobs to 4 jobs:

```
test --> release (3 OS parallel) --> virustotal-scan --> publish-release
```

### Job: `release` (modified)

**Changes from current:**
- **Delete** the `softprops/action-gh-release@v2` step (lines 122-128 of current `release.yml`) — publishing moves to `publish-release`
- Add `actions/upload-artifact@v4` step to upload `out/release/*` with name `release-artifacts-${{ matrix.name }}`
- Keep `permissions: contents: write` at workflow level (already present, covers all jobs)

Everything else (checkout, setup-node, npm ci, npm run make, rename/manifest generation) stays the same.

**Filename uniqueness:** Each OS produces uniquely-named files (Windows: `*-Windows-*`, Linux: `*-Linux-*`, macOS: `*-macOS-*`), so `merge-multiple` will not cause collisions.

### Job: `virustotal-scan` (new)

**Depends on:** `release`
**Runs on:** `ubuntu-latest`
**Timeout:** `timeout-minutes: 30`

**Steps:**

1. **Download all release artifacts**
   - Uses `actions/download-artifact@v4` with `pattern: release-artifacts-*` and `merge-multiple: true` into `./artifacts/`

2. **Upload to VirusTotal**
   - Uses `crazy-max/ghaction-virustotal@v4`
   - `vt_api_key: ${{ secrets.VT_API_KEY }}`
   - `files` input uses multiline glob syntax, scanning only binary/installer files (excluding `.yml` manifests which are plain text):
     ```yaml
     files: |
       ./artifacts/*.msi
       ./artifacts/*.zip
       ./artifacts/*.deb
       ./artifacts/*.rpm
     ```
   - The action outputs an `analysis` string: a JSON object mapping each input glob to a VirusTotal analysis URL, e.g.:
     ```json
     {"./artifacts/*.msi": "https://www.virustotal.com/gui/file-analysis/ABC123..."}
     ```

3. **Poll results and check threshold**
   - Bash step that uses `jq` to parse the `analysis` output
   - For each analysis URL, extracts the analysis ID from the URL path
   - **Polling strategy:** sequential polling, one file at a time, with `sleep 20` between each API call to stay within the 4 req/min free-tier limit
   - Polls `GET https://www.virustotal.com/api/v3/analyses/{id}` with header `x-apikey: $VT_API_KEY` until `data.attributes.status == "completed"`
   - Timeout: 10 minutes per file (max ~30 retries at 20s intervals)
   - For each completed analysis:
     - Reads `data.attributes.stats.malicious` for detection count
     - Reads `data.attributes.stats.undetected` for total engine count
     - Reads `data.meta.file_info.sha256` to construct permanent permalink
   - **Threshold: fail if any file has >= 3 malicious detections**
   - Generates `vt-report.md` with a markdown table using **permanent SHA-256 file permalinks** (not ephemeral analysis URLs):

   ```markdown
   ## VirusTotal Scan Results

   | File | Result | Report |
   |------|--------|--------|
   | GitSmith-0.7.0-Windows-x64-Setup.msi | 0/72 | [View](https://www.virustotal.com/gui/file/{sha256}) |
   | GitSmith-0.7.0-Linux-x64.deb | 0/72 | [View](https://www.virustotal.com/gui/file/{sha256}) |
   ```

4. **Upload report artifact**
   - Uses `actions/upload-artifact@v4` to upload `vt-report.md` as `virustotal-report`

### Job: `publish-release` (new)

**Depends on:** `virustotal-scan`
**Runs on:** `ubuntu-latest`

**Steps:**

1. **Download release artifacts**
   - Uses `actions/download-artifact@v4` with `pattern: release-artifacts-*` and `merge-multiple: true`

2. **Download VirusTotal report**
   - Uses `actions/download-artifact@v4` to download `virustotal-report`

3. **Build combined release body**
   - Bash step that constructs a combined markdown file (`release-body.md`):
     - Reads `vt-report.md` content
     - Writes it to `release-body.md`
   - Note: `generate_release_notes: true` auto-generates changelog from commits; `body_path` adds additional content below it

4. **Publish GitHub release**
   - Uses `softprops/action-gh-release@v2`
   - `files`: all release artifacts
   - `draft: true`
   - `generate_release_notes: true`
   - `body_path: release-body.md`

### Configuration

| Item | Value | Notes |
|------|-------|-------|
| GitHub Secret | `VT_API_KEY` | Free VirusTotal API key (500 req/day, 4 req/min) |
| Detection threshold | >= 3 | Pipeline fails if any file has 3+ malicious detections |
| Polling interval | 20 seconds | Between each API call, sequential per file |
| Polling timeout | 10 min/file | ~30 retries at 20s intervals |
| Job timeout | 30 minutes | Covers all files + overhead |
| Scanned files | `.msi`, `.zip`, `.deb`, `.rpm` | Excludes `.yml` update manifests (plain text, not useful to scan) |

### Setup Required

1. Create a free account at https://www.virustotal.com
2. Get API key from https://www.virustotal.com/gui/my-apikey
3. Add `VT_API_KEY` as a repository secret in GitHub Settings > Secrets and variables > Actions

## Files Modified

- `.github/workflows/release.yml` — restructure into 4 jobs:
  - `release`: remove `softprops/action-gh-release` step (line 122-128), add `actions/upload-artifact` step
  - `virustotal-scan`: new job with VirusTotal upload, polling, threshold check
  - `publish-release`: new job with artifact download, release body construction, `softprops/action-gh-release`

## Error Handling

- **Missing `VT_API_KEY` secret:** the `crazy-max/ghaction-virustotal` action will fail with an authentication error; the pipeline blocks and the release is not published. The error message is clear enough to diagnose.
- **VirusTotal API timeout:** polling step fails after 10 min per file, job fails, release stays unpublished
- **API rate limit:** sequential polling with 20s sleep between calls stays well within 4 req/min (3 req/min effective). With ~6 binary files, a single poll cycle takes ~2 minutes.
- **False positives (< 3 detections):** pipeline passes, report shows detection count so users can judge
- **Threshold exceeded (>= 3 detections):** pipeline fails, release is not published, maintainer investigates

## Not In Scope

- Code signing (separate initiative, SignPath.io investigation ongoing)
- ClamAV or other local scan engines (VirusTotal already includes ClamAV)
- Automatic false positive reporting to VirusTotal
