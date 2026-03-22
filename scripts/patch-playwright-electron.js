#!/usr/bin/env node
/**
 * Patches Playwright's Electron launcher for compatibility with Electron 41+ / Node.js 24+.
 *
 * Problem: Playwright 1.58 passes --remote-debugging-port=0 as a process argument,
 * but Node.js 24 rejects it as an unknown flag before Chromium can process it.
 *
 * Fix: Remove the flag from process args and instead enable it programmatically
 * via app.commandLine.appendSwitch() in the Playwright loader.
 */
const fs = require("fs");
const path = require("path");

const ELECTRON_JS = path.join(
  __dirname,
  "../node_modules/playwright-core/lib/server/electron/electron.js"
);
const LOADER_JS = path.join(
  __dirname,
  "../node_modules/playwright-core/lib/server/electron/loader.js"
);

let patched = 0;

// Patch 1: Remove --remote-debugging-port=0 from electronArguments
if (fs.existsSync(ELECTRON_JS)) {
  let code = fs.readFileSync(ELECTRON_JS, "utf8");
  const target = '"--inspect=0", "--remote-debugging-port=0"';
  if (code.includes(target)) {
    code = code.replace(target, '"--inspect=0"');
    fs.writeFileSync(ELECTRON_JS, code);
    console.log("[patch] Removed --remote-debugging-port=0 from electron.js");
    patched++;
  }
}

// Patch 2: Add remote-debugging-port switch programmatically in loader
if (fs.existsSync(LOADER_JS)) {
  let code = fs.readFileSync(LOADER_JS, "utf8");
  const spliceTarget =
    'process.argv.splice(1, process.argv.indexOf("--remote-debugging-port=0"));';
  if (code.includes(spliceTarget)) {
    // Replace the argv splice (flag no longer in args) with programmatic switch
    code = code.replace(
      spliceTarget,
      '// patched: set remote-debugging-port via commandLine API (not process args)\napp.commandLine.appendSwitch("remote-debugging-port", "0");'
    );
    fs.writeFileSync(LOADER_JS, code);
    console.log("[patch] Patched loader.js for remote-debugging-port");
    patched++;
  }
}

if (patched > 0) {
  console.log(`[patch] Applied ${patched} patch(es) for Electron 41+ compat`);
} else {
  console.log("[patch] No patches needed (already applied or files not found)");
}
