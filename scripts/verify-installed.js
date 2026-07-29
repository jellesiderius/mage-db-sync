#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const packageRoot = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const expectedVersion = process.argv[3];
const packageJsonPath = path.join(packageRoot, 'package.json');
const distPath = path.join(packageRoot, 'dist');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (expectedVersion && packageJson.version !== expectedVersion) {
    throw new Error(
        `Expected mage-db-sync ${expectedVersion}, but ${packageJson.version} was installed.`
    );
}

if (!fs.existsSync(distPath)) {
    throw new Error(`Compiled application directory is missing: ${distPath}`);
}

const runtimeDependencies = new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {})
]);
const nodeBuiltins = new Set([
    ...builtinModules,
    ...builtinModules.map(moduleName => `node:${moduleName}`)
]);
const javascriptFiles = [];

function collectJavascriptFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            collectJavascriptFiles(entryPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            javascriptFiles.push(entryPath);
        }
    }
}

function getPackageName(moduleName) {
    if (moduleName.startsWith('@')) {
        return moduleName.split('/').slice(0, 2).join('/');
    }

    return moduleName.split('/')[0];
}

collectJavascriptFiles(distPath);

const missingDeclarations = new Map();
const requirePattern = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

for (const filePath of javascriptFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    let match;

    while ((match = requirePattern.exec(source)) !== null) {
        const moduleName = match[1];

        if (
            moduleName.startsWith('.') ||
            moduleName.startsWith('/') ||
            nodeBuiltins.has(moduleName)
        ) {
            continue;
        }

        const dependencyName = getPackageName(moduleName);
        if (!runtimeDependencies.has(dependencyName)) {
            const files = missingDeclarations.get(dependencyName) || [];
            files.push(path.relative(packageRoot, filePath));
            missingDeclarations.set(dependencyName, files);
        }
    }
}

if (missingDeclarations.size > 0) {
    const details = [...missingDeclarations.entries()]
        .map(([dependencyName, files]) => {
            const uniqueFiles = [...new Set(files)].join(', ');
            return `- ${dependencyName} (used by ${uniqueFiles})`;
        })
        .join('\n');

    throw new Error(`Undeclared runtime dependencies found:\n${details}`);
}

for (const filePath of javascriptFiles) {
    if (path.relative(distPath, filePath) === 'mage-db-sync.js') {
        continue;
    }

    try {
        require(filePath);
    } catch (error) {
        throw new Error(
            `Unable to load ${path.relative(packageRoot, filePath)}: ${error.message}`,
            { cause: error }
        );
    }
}

console.log(`Verified installed mage-db-sync package v${packageJson.version}.`);
