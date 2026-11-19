/**
 * Builds the Wick Engine (engine/) and copies the result to where the editor
 * loads it from (public/corelibs/wick-engine/).
 *
 * Usage: npm run build-engine
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const engineDir = path.join(root, 'engine');
const distDir = path.join(engineDir, 'dist');
const targetDir = path.join(root, 'public', 'corelibs', 'wick-engine');

fs.mkdirSync(distDir, { recursive: true });

const gulp = require.resolve('gulp/bin/gulp.js');
const result = spawnSync(process.execPath, [gulp], { cwd: engineDir, stdio: 'inherit' });
if (result.status !== 0) {
  console.error('Engine build failed.');
  process.exit(result.status || 1);
}

fs.cpSync(distDir, targetDir, { recursive: true });
console.log('Engine copied to ' + path.relative(root, targetDir));
