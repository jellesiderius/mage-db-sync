#!/usr/bin/env node

/**
 * Migration script to copy configs from package to user directory
 * Run: npm run migrate-config
 * 
 * Preserves symlinks if present
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const packageRoot = path.resolve(__dirname, '..');
const userConfigDir = path.join(os.homedir(), '.mage-db-sync', 'config');
const userDatabasesDir = path.join(userConfigDir, 'databases');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

function ensureDirectories() {
    if (!fs.existsSync(userConfigDir)) {
        fs.mkdirSync(userConfigDir, { recursive: true });
        console.log(`✓ Created: ${userConfigDir}`);
    }
    if (!fs.existsSync(userDatabasesDir)) {
        fs.mkdirSync(userDatabasesDir, { recursive: true });
        console.log(`✓ Created: ${userDatabasesDir}`);
    }
}

/**
 * Copy or recreate symlink
 */
function copyOrLinkFile(sourcePath, targetPath) {
    // Check if source is a symlink
    const stats = fs.lstatSync(sourcePath);
    
    if (stats.isSymbolicLink()) {
        // Source is a symlink - preserve it
        const linkTarget = fs.readlinkSync(sourcePath);

        // Convert to absolute path if it's relative
        const absoluteTarget = path.isAbsolute(linkTarget)
            ? linkTarget
            : path.resolve(path.dirname(sourcePath), linkTarget);

        // If target exists, remove it first
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }

        // Create the symlink at target location with absolute path
        fs.symlinkSync(absoluteTarget, targetPath);
        return { type: 'symlink', target: absoluteTarget };
    } else {
        // Source is a regular file - copy it
        fs.copyFileSync(sourcePath, targetPath);
        return { type: 'file' };
    }
}

async function migrateConfigs() {
    console.log('\n🔄 Config Migration Tool\n');
    console.log('This will copy your config files from:');
    console.log(`  FROM: ${packageRoot}/config/`);
    console.log(`  TO:   ${userConfigDir}`);
    console.log('\nSymlinks will be preserved if present.\n');
    
    const configFiles = [
        { pkg: 'config/settings.json', user: 'settings.json' },
        { pkg: 'config/databases/staging.json', user: 'databases/staging.json' },
        { pkg: 'config/databases/production.json', user: 'databases/production.json' }
    ];
    
    // Check which files exist
    const existingInPackage = [];
    const existingInUser = [];
    const symlinksInPackage = [];
    
    for (const config of configFiles) {
        const pkgPath = path.join(packageRoot, config.pkg);
        const userPath = path.join(userConfigDir, config.user);
        
        if (fs.existsSync(pkgPath)) {
            existingInPackage.push(config);
            
            // Check if it's a symlink
            const stats = fs.lstatSync(pkgPath);
            if (stats.isSymbolicLink()) {
                const linkTarget = fs.readlinkSync(pkgPath);
                symlinksInPackage.push({ config, target: linkTarget });
            }
        }
        if (fs.existsSync(userPath)) {
            existingInUser.push(config);
        }
    }
    
    if (existingInPackage.length === 0) {
        console.log('❌ No config files found in package directory.');
        console.log('   Nothing to migrate.\n');
        rl.close();
        return;
    }
    
    console.log('Files to migrate:');
    existingInPackage.forEach(c => {
        const isSymlink = symlinksInPackage.find(s => s.config === c);
        if (isSymlink) {
            console.log(`  • ${c.user} ${isSymlink ? '(symlink → ' + isSymlink.target + ')' : ''}`);
        } else {
            console.log(`  • ${c.user}`);
        }
    });
    
    if (existingInUser.length > 0) {
        console.log('\n⚠️  Warning: These files already exist in user directory:');
        existingInUser.forEach(c => console.log(`  • ${c.user}`));
        console.log('\nThey will be OVERWRITTEN if you continue.');
    }
    
    console.log('');
    const answer = await question('Continue with migration? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\n❌ Migration cancelled.\n');
        rl.close();
        return;
    }
    
    // Perform migration
    console.log('\n🔄 Migrating configs...\n');
    ensureDirectories();
    
    let copied = 0;
    for (const config of existingInPackage) {
        try {
            const pkgPath = path.join(packageRoot, config.pkg);
            const userPath = path.join(userConfigDir, config.user);
            
            const result = copyOrLinkFile(pkgPath, userPath);
            
            if (result.type === 'symlink') {
                console.log(`✓ Created symlink: ${config.user} → ${result.target}`);
            } else {
                console.log(`✓ Copied: ${config.user}`);
            }
            copied++;
        } catch (err) {
            console.error(`✗ Failed to copy ${config.user}: ${err.message}`);
        }
    }
    
    console.log(`\n✅ Migration complete! ${copied}/${existingInPackage.length} files copied.`);
    console.log(`\nYour configs are now in: ${userConfigDir}`);
    
    if (symlinksInPackage.length > 0) {
        console.log('\n🔗 Symlinks preserved:');
        symlinksInPackage.forEach(s => {
            console.log(`  • ${s.config.user} → ${s.target}`);
        });
    }
    
    console.log('\nThese will be used instead of the package configs.\n');
    
    rl.close();
}

migrateConfigs().catch(err => {
    console.error('❌ Migration failed:', err.message);
    rl.close();
    process.exit(1);
});
