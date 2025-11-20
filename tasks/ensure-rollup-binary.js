#!/usr/bin/env node
/* eslint-env node */
/* global require, __dirname, process */
/* eslint-disable lines-around-comment */

/**
 * Ensure the platform-specific Rollup binary is installed.
 * This keeps `npm ci` working across Windows/Linux/macOS where the lockfile
 * may have been generated on a different platform.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function readRollupVersion() {
  // Prefer the resolved version from package-lock (works regardless of exports)
  try {
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    const version = lock?.packages?.['node_modules/rollup']?.version;
    if (version) {
      return version;
    }
  } catch (err) {
    // ignore, fall through
  }

  // Fallback to the devDependency range
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    if (pkg.devDependencies && pkg.devDependencies.rollup) {
      return pkg.devDependencies.rollup.replace(/^[^0-9]*/, '');
    }
  } catch (err) {
    // ignore
  }

  return null;
}

const rollupVersion = readRollupVersion();

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

if (!rollupVersion) {
  console.warn('[rollup] Could not determine rollup version; skipping native binary install');
  process.exit(0);
}

try {
  require(pkg);
  // Already present, nothing to do.
  process.exit(0);
} catch {
  // Not installed, continue to install.
}

try {
  execSync(`npm install ${pkg}@${rollupVersion} --no-save`, {
    stdio: 'inherit'
  });
} catch (err) {
  console.error(`[rollup] Failed to install ${pkg}@${rollupVersion}`);
  throw err;
}
