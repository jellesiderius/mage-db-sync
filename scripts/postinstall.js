#!/usr/bin/env node

/**
 * Post-install script to initialize configuration files
 * This runs after npm install/update
 * 
 * Behavior:
 * - Checks if actual config (not .sample) is a symlink -> creates same symlink
 * - Otherwise copies from .sample file
 * - Preserves symlinks if present
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// User config directory
const userConfigDir = path.join(os.homedir(), '.mage-db-sync', 'config');
const userDatabasesDir = path.join(userConfigDir, 'databases');

/**
 * Ensure directories exist
 */
function ensureDirectories() {
    try {
        // Create main config directory
        if (!fs.existsSync(userConfigDir)) {
            fs.mkdirSync(userConfigDir, { recursive: true });
            console.log(`✓ Created directory: ${userConfigDir}`);
        }
        
        // Create databases subdirectory
        if (!fs.existsSync(userDatabasesDir)) {
            fs.mkdirSync(userDatabasesDir, { recursive: true });
            console.log(`✓ Created directory: ${userDatabasesDir}`);
        }
        
        return true;
    } catch (err) {
        console.warn(`⚠ Failed to create directories: ${err.message}`);
        return false;
    }
}

/**
 * Copy config file or create symlink (checking actual config, not sample)
 */
function copyConfigFile(packageRoot, sampleRelativePath, targetRelativePath, actualConfigRelativePath) {
    try {
        const targetPath = path.join(userConfigDir, targetRelativePath);
        
        // Check if already exists in user config
        if (fs.existsSync(targetPath)) {
            return { created: false, reason: 'exists-user' };
        }
        
        // Check if actual config (not sample) exists in package and is a symlink
        const actualConfigPath = path.join(packageRoot, 'config', actualConfigRelativePath);
        
        if (fs.existsSync(actualConfigPath)) {
            const stats = fs.lstatSync(actualConfigPath);
            if (stats.isSymbolicLink()) {
                // Package has a symlink - create the same symlink in user directory
                const linkTarget = fs.readlinkSync(actualConfigPath);
                
                // Ensure target directory exists
                const targetDir = path.dirname(targetPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                fs.symlinkSync(linkTarget, targetPath);
                console.log(`✓ Created symlink: ${targetPath} -> ${linkTarget}`);
                return { created: true, reason: 'symlink', target: linkTarget };
            }
        }
        
        // Otherwise, copy from sample file
        const samplePath = path.join(packageRoot, 'config', sampleRelativePath);
        
        if (!fs.existsSync(samplePath)) {
            return { created: false, reason: 'no-sample' };
        }
        
        // Ensure target directory exists
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        
        // Copy regular file from sample
        fs.copyFileSync(samplePath, targetPath);
        console.log(`✓ Created ${targetPath}`);
        return { created: true, reason: 'copied' };
        
    } catch (err) {
        console.warn(`⚠ Failed to create config: ${err.message}`);
        return { created: false, reason: 'error', error: err.message };
    }
}

/**
 * Check if config already exists in package directory
 */
function hasPackageConfig(packageRoot, relativePath) {
    const packageConfigPath = path.join(packageRoot, 'config', relativePath);
    return fs.existsSync(packageConfigPath);
}

/**
 * Initialize configuration files
 */
function initializeConfig() {
    console.log('\n🔧 Initializing mage-db-sync configuration...\n');
    
    // Determine the package root (where package.json is)
    const packageRoot = path.resolve(__dirname, '..');
    
    // Ensure user directories exist
    if (!ensureDirectories()) {
        console.error('❌ Failed to create config directories. Please create them manually.');
        return;
    }
    
    const configFiles = [
        {
            sample: 'settings.json.sample',
            actualConfig: 'settings.json',
            target: 'settings.json'
        },
        {
            sample: 'databases/staging.json.sample',
            actualConfig: 'databases/staging.json',
            target: 'databases/staging.json'
        },
        {
            sample: 'databases/production.json.sample',
            actualConfig: 'databases/production.json',
            target: 'databases/production.json'
        }
    ];
    
    const results = {
        created: [],
        symlinks: [],
        existsInUser: [],
        existsInPackage: []
    };
    
    // Try to create all config files
    for (const config of configFiles) {
        const result = copyConfigFile(
            packageRoot,
            config.sample,
            config.target,
            config.actualConfig
        );
        
        if (result.created) {
            results.created.push(config.target);
            if (result.reason === 'symlink') {
                results.symlinks.push({ file: config.target, target: result.target });
            }
        } else if (result.reason === 'exists-user') {
            results.existsInUser.push(config.target);
        } else if (hasPackageConfig(packageRoot, config.actualConfig)) {
            results.existsInPackage.push(config.target);
        }
    }
    
    // Show summary
    console.log('');
    
    if (results.created.length > 0) {
        console.log('✅ Configuration files created in:', userConfigDir);
        results.created.forEach(f => console.log(`   • ${f}`));
        
        if (results.symlinks.length > 0) {
            console.log('\n🔗 Symlinks created:');
            results.symlinks.forEach(s => console.log(`   • ${s.file} -> ${s.target}`));
        }
        
        console.log('\n📝 Please review and update them with your settings.\n');
    }
    
    if (results.existsInUser.length > 0) {
        console.log('ℹ️  Using existing user configs:');
        results.existsInUser.forEach(f => {
            const fullPath = path.join(userConfigDir, f);
            // Check if it's a symlink
            if (fs.existsSync(fullPath)) {
                const stats = fs.lstatSync(fullPath);
                if (stats.isSymbolicLink()) {
                    const linkTarget = fs.readlinkSync(fullPath);
                    console.log(`   • ${fullPath} -> ${linkTarget}`);
                } else {
                    console.log(`   • ${fullPath}`);
                }
            } else {
                console.log(`   • ${fullPath}`);
            }
        });
        console.log('');
    }
    
    if (results.existsInPackage.length > 0 && results.created.length === 0 && results.existsInUser.length === 0) {
        console.log('💡 Config files exist in package directory (fallback mode)');
        console.log('   To move them to user directory, run: npm run migrate-config\n');
    }
}

// Run the initialization
try {
    initializeConfig();
} catch (err) {
    console.error('❌ Post-install script failed:', err.message);
    // Don't fail the install, just warn
    process.exit(0);
}
