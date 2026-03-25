# VirusTotal Antivirus Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VirusTotal antivirus scanning to the release pipeline so all artifacts are scanned before publication, with results linked in GitHub release notes.

**Architecture:** Restructure `release.yml` from 2 jobs (test → release) to 4 jobs (test → release → virustotal-scan → publish-release). The `release` job uploads artifacts instead of publishing directly. A new `virustotal-scan` job scans them via VirusTotal API. A new `publish-release` job publishes only after scan passes.

**Tech Stack:** GitHub Actions, `crazy-max/ghaction-virustotal@v4`, VirusTotal API v3, `softprops/action-gh-release@v2`, bash, jq, curl

**Spec:** `docs/superpowers/specs/2026-03-25-virustotal-scan-design.md`

---

**IMPORTANT:** Tasks 1–3 modify the same file and the workflow is broken between commits. Do NOT push to a live branch until all three tasks are complete.

### Task 1: Modify `release` job — replace direct publish with artifact upload

**Files:**
- Modify: `.github/workflows/release.yml:122-128`

- [ ] **Step 1: Replace `softprops/action-gh-release` with `actions/upload-artifact`**

In `.github/workflows/release.yml`, replace lines 122-128:

```yaml
      # OLD — delete these lines:
      # - name: Upload release artifacts
      #   uses: softprops/action-gh-release@v2
      #   with:
      #     files: out/release/*
      #     draft: true
      #     generate_release_notes: true
```

With:

```yaml
      - name: Upload release artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-artifacts-${{ matrix.name }}
          path: out/release/*
          retention-days: 1
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "refactor: replace direct publish with artifact upload in release job"
```

---

### Task 2: Add `virustotal-scan` job

**Files:**
- Modify: `.github/workflows/release.yml` (append new job after `release`)

- [ ] **Step 1: Add the `virustotal-scan` job**

Append after the `release` job block in `release.yml`:

```yaml
  virustotal-scan:
    name: VirusTotal Scan
    needs: release
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Download all release artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: release-artifacts-*
          merge-multiple: true
          path: ./artifacts

      - name: List artifacts
        run: ls -la ./artifacts/

      - name: Upload to VirusTotal
        id: vt
        uses: crazy-max/ghaction-virustotal@v4
        with:
          vt_api_key: ${{ secrets.VT_API_KEY }}
          files: |
            ./artifacts/*.msi
            ./artifacts/*.zip
            ./artifacts/*.deb
            ./artifacts/*.rpm

      - name: Poll results and check threshold
        env:
          VT_API_KEY: ${{ secrets.VT_API_KEY }}
          VT_ANALYSIS: ${{ steps.vt.outputs.analysis }}
        shell: bash
        run: |
          THRESHOLD=3
          POLL_INTERVAL=20
          MAX_POLLS=30
          FAILED=0

          echo "## VirusTotal Scan Results" > vt-report.md
          echo "" >> vt-report.md
          echo "| File | Result | Report |" >> vt-report.md
          echo "|------|--------|--------|" >> vt-report.md

          # Parse analysis output — JSON object mapping glob/file to analysis URL
          # Each value looks like: https://www.virustotal.com/gui/file-analysis/{id}
          # NOTE: uses process substitution (< <(...)) instead of pipe to avoid
          # subshell — variable assignments (FAILED) must survive the loop.
          while read -r FILE_PATTERN ANALYSIS_URL; do
            # Skip empty or null entries (glob matched no files on this OS)
            [ -z "$ANALYSIS_URL" ] || [ "$ANALYSIS_URL" = "null" ] && continue

            # Extract analysis ID from URL (last path segment)
            ANALYSIS_ID="${ANALYSIS_URL##*/}"
            FILENAME=$(basename "$FILE_PATTERN")

            echo "Polling analysis for $FILENAME (ID: $ANALYSIS_ID)..."

            # Poll until completed
            for i in $(seq 1 $MAX_POLLS); do
              RESPONSE=$(curl -s -H "x-apikey: $VT_API_KEY" \
                "https://www.virustotal.com/api/v3/analyses/$ANALYSIS_ID")

              STATUS=$(echo "$RESPONSE" | jq -r '.data.attributes.status')

              if [ "$STATUS" = "completed" ]; then
                MALICIOUS=$(echo "$RESPONSE" | jq -r '.data.attributes.stats.malicious')
                UNDETECTED=$(echo "$RESPONSE" | jq -r '.data.attributes.stats.undetected')
                TOTAL=$((MALICIOUS + UNDETECTED))
                SHA256=$(echo "$RESPONSE" | jq -r '.meta.file_info.sha256')

                PERMALINK="https://www.virustotal.com/gui/file/$SHA256"

                if [ "$MALICIOUS" -ge "$THRESHOLD" ]; then
                  echo "| $FILENAME | $MALICIOUS/$TOTAL | [View]($PERMALINK) |" >> vt-report.md
                  echo "FAIL: $FILENAME has $MALICIOUS detections (threshold: $THRESHOLD)"
                  FAILED=1
                else
                  echo "| $FILENAME | $MALICIOUS/$TOTAL | [View]($PERMALINK) |" >> vt-report.md
                  echo "PASS: $FILENAME has $MALICIOUS detections"
                fi
                break
              fi

              if [ "$i" -eq "$MAX_POLLS" ]; then
                echo "TIMEOUT: Analysis for $FILENAME did not complete in time"
                echo "| $FILENAME | TIMEOUT | N/A |" >> vt-report.md
                FAILED=1
                break
              fi

              echo "  Poll $i/$MAX_POLLS: status=$STATUS, waiting ${POLL_INTERVAL}s..."
              sleep "$POLL_INTERVAL"
            done
          done < <(echo "$VT_ANALYSIS" | jq -r 'to_entries[] | "\(.key) \(.value)"')

          echo ""
          echo "=== VirusTotal Report ==="
          cat vt-report.md

          if [ "$FAILED" -eq 1 ]; then
            echo "One or more files exceeded the detection threshold or timed out."
            exit 1
          fi

      - name: Upload VirusTotal report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: virustotal-report
          path: vt-report.md
          retention-days: 90
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add virustotal-scan job to release pipeline"
```

---

### Task 3: Add `publish-release` job

**Files:**
- Modify: `.github/workflows/release.yml` (append new job after `virustotal-scan`)

- [ ] **Step 1: Add the `publish-release` job**

Append after the `virustotal-scan` job block:

```yaml
  publish-release:
    name: Publish Release
    needs: virustotal-scan
    runs-on: ubuntu-latest

    steps:
      - name: Download release artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: release-artifacts-*
          merge-multiple: true
          path: ./artifacts

      - name: Download VirusTotal report
        uses: actions/download-artifact@v4
        with:
          name: virustotal-report
          path: ./report

      - name: Build release body
        shell: bash
        run: cp ./report/vt-report.md release-body.md

      - name: Publish GitHub release
        uses: softprops/action-gh-release@v2
        with:
          files: ./artifacts/*
          draft: true
          generate_release_notes: true
          body_path: release-body.md
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add publish-release job with VirusTotal report in release notes"
```

---

### Task 4: Validate the complete workflow YAML

**Files:**
- Read: `.github/workflows/release.yml`

- [ ] **Step 1: Validate YAML syntax**

```bash
npx yaml-lint .github/workflows/release.yml || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

Expected: no syntax errors.

- [ ] **Step 2: Review the full file**

Read the complete `release.yml` and verify:
1. Job dependency chain: `test → release → virustotal-scan → publish-release`
2. `release` job has NO `softprops/action-gh-release` step
3. `release` job has `actions/upload-artifact@v4` step
4. `virustotal-scan` has `timeout-minutes: 30`
5. `virustotal-scan` uses correct secret name `VT_API_KEY`
6. `publish-release` downloads both artifact sets (release + report)
7. `permissions: contents: write` is at workflow level (line 8-9)

- [ ] **Step 3: Final commit with any fixes**

If any fixes were needed:

```bash
git add .github/workflows/release.yml
git commit -m "fix: correct release workflow YAML issues"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `USER_MANUAL.md`
- Modify: `README.md`

- [ ] **Step 1: Add VirusTotal scan section to USER_MANUAL.md**

Insert a new subsection inside `## 34. Automatic Updates` (after the existing content, before `## 35. Keyboard Shortcuts`):

```markdown
### Antivirus Scan

Every release is automatically scanned with [VirusTotal](https://www.virustotal.com), which checks binaries against approximately 70 antivirus engines. Scan results with direct links to full reports are included in each [GitHub release](https://github.com/nicenemo/gitsmith/releases). If any file receives 3 or more malicious detections, the release is blocked until investigated.
```

- [ ] **Step 2: Add a note in README.md**

Insert the following line at the end of the `## Security` section (line ~130, before `## Changelog`):

```markdown
All release binaries are scanned with [VirusTotal](https://www.virustotal.com) (~70 antivirus engines). Scan reports are linked in each [GitHub release](https://github.com/nicenemo/gitsmith/releases).
```

- [ ] **Step 3: Commit**

```bash
git add USER_MANUAL.md README.md
git commit -m "docs: document VirusTotal antivirus scanning in release pipeline"
```

---

### Task 6: Setup instructions reminder

This task is a manual checklist — no code changes.

- [ ] **Step 1: Print setup reminder**

Output to the user:

```
MANUAL SETUP REQUIRED:
1. Create a free VirusTotal account at https://www.virustotal.com
2. Get your API key from https://www.virustotal.com/gui/my-apikey
3. Add VT_API_KEY as a repository secret:
   GitHub repo → Settings → Secrets and variables → Actions → New repository secret
   Name: VT_API_KEY
   Value: <your API key>
```
