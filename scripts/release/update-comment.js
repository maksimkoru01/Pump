#!/usr/bin/env node
const fs = require('fs');
const proc = require('child_process');
const semver = require('semver');
const run = (cmd, ...args) => proc.execFileSync(cmd, args, { encoding: 'utf8' }).trim();

const gitStatus = run('git', 'status', '--porcelain', '-uno', 'contracts/**/*.sol');
if (gitStatus.length > 0) {
  console.error('Contracts directory is not clean');
  process.exit(1);
}

const { version } = require('../../package.json');

// Get latest tag according to semver.
const [ tag ] = run('git', 'tag')
  .split(/\r?\n/)
  .filter(v => semver.valid(v) && semver.lte(v, version))
  .sort(semver.rcompare);

// Ordering tag → HEAD is important here.
const files = run('git', 'diff', tag, 'HEAD', '--name-only', 'contracts/**/*.sol')
  .split(/\r?\n/)
  .filter(file => !file.match(/mock/i));

for (const file of files) {
  const current = fs.readFileSync(file, 'utf8');
  const updated = current.replace(
    /(\/\/ SPDX-License-Identifier:.*)$(\n\/\/ OpenZeppelin Contracts v.*$)?/m,
    `$1\n// OpenZeppelin Contracts (last updated v${version}) (${file.replace('contracts/', '')})`,
  );
  fs.writeFileSync(file, updated);
}

run('git', 'add', '--update', 'contracts');
