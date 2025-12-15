#!/usr/bin/env node

/**
 * Build and Package Script
 * - Runs the build
 * - Updates manifest.json version to match package.json
 * - Zips the dist folder to dist.zip
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function main() {
  console.log('Building and packaging...\n');

  // Get version from package.json
  const packagePath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  const version = packageJson.version;

  console.log(`Current version: ${version}`);

  // Update manifest.json with the same version
  const manifestPath = join(rootDir, 'manifest.json');
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const oldManifestVersion = manifest.version;
    manifest.version = version;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`Updated manifest.json: ${oldManifestVersion} -> ${version}`);
  } catch (e) {
    console.error('Error updating manifest.json:', e.message);
    process.exit(1);
  }

  // Run build
  console.log('\nRunning build...');
  try {
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    console.log('Build completed successfully');
  } catch (e) {
    console.error('Build failed:', e.message);
    process.exit(1);
  }

  // Remove old dist.zip if exists
  const distZipPath = join(rootDir, 'dist.zip');
  if (existsSync(distZipPath)) {
    rmSync(distZipPath);
    console.log('Removed old dist.zip');
  }

  // Zip the dist folder
  console.log('\nCreating dist.zip...');
  try {
    execSync('zip -r dist.zip dist', { cwd: rootDir, stdio: 'inherit' });
    console.log('Created dist.zip successfully');
  } catch (e) {
    console.error('Failed to create zip:', e.message);
    process.exit(1);
  }

  console.log('\nBuild and packaging completed!');
}

main();
