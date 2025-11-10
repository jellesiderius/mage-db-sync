#!/usr/bin/env node

/**
 * Post-install script to initialize configuration files
 * This runs after npm install/update
 */

const fs = require('fs');
const path = require('path');

function copySampleFile(samplePath, targetPath) {
    try {
        if (!fs.existsSync(targetPath) && fs.existsSync(samplePath)) {
            fs.copyFileSync(samplePath, targetPath);
            console.log(`✓ Created ${path.basename(targetPath)} from sample file`);
            return true;
        }
        return false;
    } catch (err) {
        console.warn(`⚠ Failed to copy ${path.basename(samplePath)}: ${err.message}`);
        return false;
    }
}

function initializeConfig() {
    // Determine the package root (where package.json is)
    const packageRoot = path.resolve(__dirname, '..');
    
    const configFiles = [
        {
            sample: path.join(packageRoot, 'config/settings.json.sample'),
            target: path.join(packageRoot, 'config/settings.json')
        },
        {
            sample: path.join(packageRoot, 'config/databases/staging.json.sample'),
            target: path.join(packageRoot, 'config/databases/staging.json')
        },
        {
            sample: path.join(packageRoot, 'config/databases/production.json.sample'),
            target: path.join(packageRoot, 'config/databases/production.json')
        }
    ];

    let anyCreated = false;
    for (const config of configFiles) {
        if (copySampleFile(config.sample, config.target)) {
            anyCreated = true;
        }
    }

    if (anyCreated) {
        console.log('\n📝 Configuration files created. Please review and update them with your settings.\n');
    }
}

// Only run if this is a global install or if config directory exists
const packageRoot = path.resolve(__dirname, '..');
const configDir = path.join(packageRoot, 'config');

if (fs.existsSync(configDir)) {
    initializeConfig();
}
