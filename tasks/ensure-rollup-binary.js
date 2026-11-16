#!/usr/bin/env node
/* eslint-env node */
/* global require, __dirname, process */
/* eslint-disable lines-around-comment */

/**
 * Ensure the platform-specific Rollup binary is installed.
 * This keeps `npm ci` working across Windows/Linux/macOS where the lockfile
 * may have been generated on a different platform.
 *
 * It runs as `postinstall`, so an error here fails the install -- which is
 * the point of every error below: rollup needs its native binary at exactly
 * its own version, and an install that goes on without it ends in a build
 * that fails later for a reason it does not name.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

/**
 * Parse a JSON file. readFileSync names the path when the file cannot be
 * read; a file that does not parse is named here.
 */
function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`[rollup] ${file} is not valid JSON: ${err.message}`);
  }
}

function readRollupVersion() {
  // Prefer the resolved version from package-lock (works regardless of exports).
  // NO LOCK IS A STATE -- `npm install` in a clone without one -- and
  // package.json answers below, as before. A lock that EXISTS and cannot be
  // read or parsed is not: it fails the install, where it used to fall back
  // silently to the lower bound of package.json's range, which need not be
  // the rollup npm installed.
  const lockPath = path.join(root, 'package-lock.json');

  if (fs.existsSync(lockPath)) {
    const lock = readJson(lockPath);
    const version = lock?.packages?.['node_modules/rollup']?.version;
    if (version) {
      return version;
    }
  }

  // A lock that does not name rollup: the lower bound of the devDependency
  // range, as before. package.json is what npm ran this script from, so one
  // that cannot be read or parsed fails the install -- it used to end in a
  // warning and exit 0, an install without the binary.
  const packageJson = readJson(path.join(root, 'package.json'));
  if (packageJson.devDependencies && packageJson.devDependencies.rollup) {
    return packageJson.devDependencies.rollup.replace(/^[^0-9]*/, '');
  }

  throw new Error(
    '[rollup] Could not determine the rollup version: neither package-lock.json ' +
    'nor the devDependencies of package.json name it'
  );
}

const PLATFORM_MAP = {
  'linux-x64': '@rollup/rollup-linux-x64-gnu',
  'linux-arm64': '@rollup/rollup-linux-arm64-gnu',
  'darwin-arm64': '@rollup/rollup-darwin-arm64',
  'darwin-x64': '@rollup/rollup-darwin-x64',
  'win32-x64': '@rollup/rollup-win32-x64-msvc'
};

const key = `${process.platform}-${process.arch}`;
const pkg = PLATFORM_MAP[key];

if (!pkg) {
  console.warn(`[rollup] No native binary configured for ${key}; skipping`);
  process.exit(0);
}

// Read after the platform check, as the skip above never needed it.
const rollupVersion = readRollupVersion();

try {
  require(pkg);
  // Already present, nothing to do.
  process.exit(0);
} catch (err) {
  // ONLY AN ABSENT PACKAGE IS "NOT INSTALLED". A binary that is there and
  // does not load -- a broken file, a wrong ABI or libc -- is its own error,
  // and installing the same version again would not cure it.
  if (err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
}

try {
  execSync(`npm install ${pkg}@${rollupVersion} --no-save`, {
    stdio: 'inherit'
  });
} catch (err) {
  console.error(`[rollup] Failed to install ${pkg}@${rollupVersion}`);
  throw err;
}
