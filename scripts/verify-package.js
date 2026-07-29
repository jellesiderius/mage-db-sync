#!/usr/bin/env node

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(packageRoot, 'package.json'));
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mage-db-sync-package-'));
const installRoot = path.join(temporaryRoot, 'install');

try {
    fs.mkdirSync(installRoot);
    fs.writeFileSync(
        path.join(installRoot, 'package.json'),
        JSON.stringify({ private: true }, null, 2)
    );

    const packOutput = execFileSync(
        'npm',
        [
            'pack',
            '--json',
            '--ignore-scripts',
            '--pack-destination',
            temporaryRoot
        ],
        {
            cwd: packageRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'inherit']
        }
    );
    const packResult = JSON.parse(packOutput);
    const tarballPath = path.join(temporaryRoot, packResult[0].filename);

    execFileSync(
        'npm',
        [
            'install',
            '--ignore-scripts',
            '--omit=dev',
            '--no-audit',
            '--no-fund',
            tarballPath
        ],
        {
            cwd: installRoot,
            stdio: 'inherit'
        }
    );

    const installedPackageRoot = path.join(
        installRoot,
        'node_modules',
        packageJson.name
    );
    const verifierPath = path.join(
        installedPackageRoot,
        'scripts',
        'verify-installed.js'
    );

    execFileSync(
        process.execPath,
        [verifierPath, installedPackageRoot, packageJson.version],
        { stdio: 'inherit' }
    );

    console.log(`Verified npm package ${packageJson.name}@${packageJson.version}.`);
} finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
