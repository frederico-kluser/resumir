#!/usr/bin/env node

/**
 * Version Bump Script
 * Increments the patch version and updates:
 * - package.json
 * - package-lock.json
 * - README.md (English)
 * - README.pt-BR.md (Portuguese)
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Increment version by patch number
 * @param {string} version - Current version (e.g., "1.0.0")
 * @returns {string} New version (e.g., "1.0.1")
 */
function incrementVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1; // Increment patch
  return parts.join('.');
}

/**
 * Update version badge in README content
 * @param {string} content - README file content
 * @param {string} newVersion - New version string
 * @param {string} lang - Language ('en' or 'pt')
 * @returns {string} Updated content
 */
function updateReadmeVersion(content, newVersion, lang) {
  const versionBadgeRegex = /\[!\[Version\].*?\]\(.*?\)/;
  const versionBadge = `[![Version](https://img.shields.io/badge/Version-${newVersion}-blue.svg)](https://github.com/user/resumir/releases)`;

  if (versionBadgeRegex.test(content)) {
    // Replace existing version badge
    return content.replace(versionBadgeRegex, versionBadge);
  } else {
    // Insert version badge after the first line of badges (after license badge)
    const licenseRegex = /(\[!\[License:.*?\]\(.*?\))/;
    if (licenseRegex.test(content)) {
      return content.replace(licenseRegex, `$1\n${versionBadge}`);
    }
  }
  return content;
}

function main() {
  console.log('Bumping version...\n');

  // Read package.json
  const packagePath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const oldVersion = packageJson.version;
  const newVersion = incrementVersion(oldVersion);

  console.log(`Version: ${oldVersion} -> ${newVersion}`);

  // Update package.json
  packageJson.version = newVersion;
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('Updated: package.json');

  // Update package-lock.json
  const packageLockPath = join(rootDir, 'package-lock.json');
  try {
    const packageLock = JSON.parse(readFileSync(packageLockPath, 'utf8'));
    packageLock.version = newVersion;
    if (packageLock.packages && packageLock.packages['']) {
      packageLock.packages[''].version = newVersion;
    }
    writeFileSync(packageLockPath, JSON.stringify(packageLock, null, 2) + '\n');
    console.log('Updated: package-lock.json');
  } catch (e) {
    console.warn('Warning: Could not update package-lock.json');
  }

  // Update README.md (English)
  const readmePath = join(rootDir, 'README.md');
  try {
    let readmeContent = readFileSync(readmePath, 'utf8');
    readmeContent = updateReadmeVersion(readmeContent, newVersion, 'en');
    writeFileSync(readmePath, readmeContent);
    console.log('Updated: README.md');
  } catch (e) {
    console.warn('Warning: Could not update README.md');
  }

  // Update README.pt-BR.md (Portuguese)
  const readmePtPath = join(rootDir, 'README.pt-BR.md');
  try {
    let readmePtContent = readFileSync(readmePtPath, 'utf8');
    readmePtContent = updateReadmeVersion(readmePtContent, newVersion, 'pt');
    writeFileSync(readmePtPath, readmePtContent);
    console.log('Updated: README.pt-BR.md');
  } catch (e) {
    console.warn('Warning: Could not update README.pt-BR.md');
  }

  console.log(`\nVersion bumped to ${newVersion}`);
  return newVersion;
}

main();
