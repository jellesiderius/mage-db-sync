import {localhostMagentoRootExec, localhostWpRootExec, wordpressReplaces} from '../utils/Console';
import { Listr } from 'listr2';
import configFile from '../../config/settings.json'

interface TaskItem {
    title: string;
    /* eslint-disable no-unused-vars */
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class WordpressConfigureTask {
    private configureTasks: TaskItem[] = [];

    configure = async (list: any, config: any) => {
        await this.addTasks(list, config);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any) => {
        list.add(
            {
                title: 'Import Wordpress database to localhost',
                task: (ctx: any, task: any): Listr =>
                task.newListr(
                    this.configureTasks
                )
            }
        )

        this.configureTasks.push(
            {
                title: 'Importing database',
                task: async (): Promise<void> => {
                    // Determine the actual filename (might be compressed)
                    const baseFileName = config.wordpressConfig.database;
                    let sqlFileName = `${baseFileName}.sql`;
                    
                    // Check if file is compressed
                    const fs = require('fs');
                    const path = require('path');
                    const currentFolder = config.settings.currentFolder;
                    
                    let isCompressed = false;
                    let compressedFile = '';
                    
                    if (fs.existsSync(path.join(currentFolder, `${baseFileName}.sql.gz`))) {
                        isCompressed = true;
                        compressedFile = `${baseFileName}.sql.gz`;
                        sqlFileName = `${baseFileName}.sql`;
                    }
                    
                    if (config.settings.isDdevActive) {
                        // Decompress if needed
                        if (isCompressed) {
                            await localhostMagentoRootExec(`gunzip -f ${compressedFile}`, config, false);
                        }
                        
                        // Move SQL file to wp directory
                        await localhostMagentoRootExec(`mv ${sqlFileName} wp/`, config, false);

                        const grantCommand1 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`
                        const grantCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`
                        const dropCommand = `db drop --yes`;
                        const grantCommand3 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS db_wp; GRANT ALL ON db_wp.* TO 'db'@'%';"""`;
                        const createCommand = `db create`;
                        const importCommand = `db import ${sqlFileName}`;

                        // Import SQL file to database
                        await localhostMagentoRootExec(grantCommand1, config, true);
                        await localhostMagentoRootExec(grantCommand2, config, true);
                        await localhostWpRootExec(dropCommand, config, true);
                        await localhostMagentoRootExec(grantCommand3, config, true);
                        await localhostWpRootExec(createCommand, config, true);
                        await localhostWpRootExec(importCommand, config, true);
                    } else {
                        // Decompress if needed, then move and import
                        const commands = [];
                        
                        if (isCompressed) {
                            commands.push(`gunzip -f ${compressedFile}`);
                        }
                        
                        commands.push(`mv ${sqlFileName} wp/`);
                        commands.push(`cd wp`);
                        commands.push(`${config.settings.wpCommandLocal} db drop --yes`);
                        commands.push(`${config.settings.wpCommandLocal} db create`);
                        commands.push(`${config.settings.wpCommandLocal} db import ${sqlFileName}`);
                        
                        const command = commands.join('; ');
                        
                        // Import SQL file to database
                        await localhostMagentoRootExec(command, config, true);
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: `Detecting WordPress configuration`,
                task: async (ctx: any, task: any): Promise<void> => {
                    // Detect if this is a multisite installation
                    let isMultisite = false;
                    let multisiteType = 'subdirectory'; // or 'subdomain'
                    
                    if (config.settings.isDdevActive) {
                        // Check if wp_blogs table exists (indicates multisite)
                        const checkMultisiteCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SHOW TABLES LIKE '${config.wordpressConfig.prefix}blogs'"""`;
                        const result = await localhostMagentoRootExec(checkMultisiteCommand, config, true);
                        
                        if (result && String(result).includes('blogs')) {
                            isMultisite = true;
                            
                            // Check if subdomain or subdirectory based
                            const checkTypeCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT meta_value FROM ${config.wordpressConfig.prefix}sitemeta WHERE meta_key = 'subdomain_install' LIMIT 1"""`;
                            const typeResult = await localhostMagentoRootExec(checkTypeCommand, config, true);
                            
                            if (typeResult && String(typeResult).includes('1')) {
                                multisiteType = 'subdomain';
                            }
                        }
                    } else {
                        // Check if wp_blogs table exists
                        const checkResult = await localhostMagentoRootExec(`cd wp; wp db query "SHOW TABLES LIKE '${config.wordpressConfig.prefix}blogs'"`, config, true);
                        
                        if (checkResult && String(checkResult).includes('blogs')) {
                            isMultisite = true;
                            
                            // Check subdomain vs subdirectory
                            const typeResult = await localhostMagentoRootExec(`cd wp; wp db query "SELECT meta_value FROM ${config.wordpressConfig.prefix}sitemeta WHERE meta_key = 'subdomain_install' LIMIT 1"`, config, true);
                            
                            if (typeResult && String(typeResult).includes('1')) {
                                multisiteType = 'subdomain';
                            }
                        }
                    }
                    
                    // Store multisite config for later tasks
                    config.wordpressConfig.isMultisite = isMultisite;
                    config.wordpressConfig.multisiteType = multisiteType;
                    
                    task.title = isMultisite 
                        ? `Detected WordPress Multisite (${multisiteType})`
                        : `Detected WordPress Single Site`;
                }
            }
        );

        this.configureTasks.push(
            {
                title: `Configuring URL's for development`,
                task: async (ctx: any, task: any): Promise<void> => {
                    const isMultisite = config.wordpressConfig.isMultisite;
                    const multisiteType = config.wordpressConfig.multisiteType;
                    const localDomain = config.settings.magentoLocalhostDomainName;
                    
                    // Load custom WordPress domain mapping from .mage-db-sync-config.json
                    const fs = require('fs');
                    let wordpressDomainMapping: Record<string, string> = {};
                    const configPath = `${config.settings.currentFolder}/.mage-db-sync-config.json`;
                    
                    if (fs.existsSync(configPath)) {
                        try {
                            const jsonData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                            if (jsonData.wordpress_domains) {
                                wordpressDomainMapping = jsonData.wordpress_domains;
                                task.output = `Loaded custom WordPress domain mapping for ${Object.keys(wordpressDomainMapping).length} site(s)`;
                            }
                        } catch (_err) {
                            // Ignore parsing errors, use default mapping
                        }
                    }
                    
                    if (config.settings.isDdevActive) {
                        // Retrieve current site URL from database
                        const wordpressUrlCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"""`;
                        let wordpressUrl = await localhostMagentoRootExec(wordpressUrlCommand, config, true);
                        wordpressUrl = wordpressReplaces(String(wordpressUrl).replace('option_value', '').trim(), 'https://').split('/')[0];

                        if (isMultisite) {
                            // MULTISITE CONFIGURATION WITH CUSTOM DOMAIN MAPPING
                            
                            // Only process sites that are explicitly mapped
                            const hasMappedSites = Object.keys(wordpressDomainMapping).length > 0;
                            
                            if (hasMappedSites) {
                                // Get all sites from database
                                const sitesCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT blog_id, domain, path FROM ${config.wordpressConfig.prefix}blogs"""`;
                                const sitesResult = await localhostMagentoRootExec(sitesCommand, config, true);
                                
                                // Parse sites and filter to only mapped ones
                                const sites: Array<{blog_id: string, domain: string, path: string, newDomain: string}> = [];
                                if (sitesResult) {
                                    const lines = String(sitesResult).split('\n').filter(l => l && !l.startsWith('blog_id'));
                                    for (const line of lines) {
                                        const parts = line.trim().split(/\s+/);
                                        if (parts.length >= 3) {
                                            const blog_id = parts[0];
                                            const domain = parts[1];
                                            const path = parts[2];
                                            
                                            // Only process if this site is mapped
                                            if (wordpressDomainMapping[blog_id]) {
                                                const newDomain = wordpressDomainMapping[blog_id];
                                                sites.push({ blog_id, domain, path, newDomain });
                                            }
                                        }
                                    }
                                }
                                
                                // Update main network domain (only if blog_id 1 is mapped)
                                if (wordpressDomainMapping['1']) {
                                    const mainSiteDomain = wordpressDomainMapping['1'];
                                    const replaceCommandSite = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}site SET domain = '${mainSiteDomain}'"""`;
                                    await localhostMagentoRootExec(replaceCommandSite, config, true);
                                }
                                
                                // Update each mapped site individually
                                for (const site of sites) {
                                    const blogId = site.blog_id;
                                    const oldDomain = site.domain;
                                    const newDomain = site.newDomain;
                                    const protocol = config.settings.isDdevActive ? 'https://' : 'http://';
                                    
                                    // Update domain in wp_blogs
                                    const updateBlogCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}blogs SET domain = '${newDomain}' WHERE blog_id = ${blogId}"""`;
                                    await localhostMagentoRootExec(updateBlogCommand, config, true);
                                    
                                    // Get current siteurl and home to preserve paths
                                    const optionsTable = blogId === '1' 
                                        ? `${config.wordpressConfig.prefix}options`
                                        : `${config.wordpressConfig.prefix}${blogId}_options`;
                                    
                                    // Get current URLs to extract paths
                                    const getCurrentUrlsCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT option_name, option_value FROM ${optionsTable} WHERE option_name IN ('siteurl', 'home')"""`;
                                    const currentUrls = await localhostMagentoRootExec(getCurrentUrlsCommand, config, true);
                                    
                                    // Parse current URLs to preserve paths
                                    let siteurlPath = '';
                                    let homePath = '';
                                    if (currentUrls) {
                                        const urlLines = String(currentUrls).split('\n').filter(l => l && !l.startsWith('option_name'));
                                        for (const urlLine of urlLines) {
                                            const urlParts = urlLine.trim().split(/\s+/);
                                            if (urlParts.length >= 2) {
                                                const optionName = urlParts[0];
                                                const optionValue = urlParts.slice(1).join(' ');
                                                
                                                // Extract path from URL (everything after domain)
                                                try {
                                                    const url = new URL(optionValue);
                                                    const urlPath = url.pathname;
                                                    
                                                    if (optionName === 'siteurl') {
                                                        siteurlPath = urlPath;
                                                    } else if (optionName === 'home') {
                                                        homePath = urlPath;
                                                    }
                                                } catch (_e) {
                                                    // If URL parsing fails, use empty path
                                                }
                                            }
                                        }
                                    }
                                    
                                    // Update siteurl and home, preserving paths
                                    const newSiteurl = `${protocol}${newDomain}${siteurlPath}`;
                                    const newHome = `${protocol}${newDomain}${homePath}`;
                                    
                                    const updateSiteurlCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${optionsTable} SET option_value = '${newSiteurl}' WHERE option_name = 'siteurl'"""`;
                                    await localhostMagentoRootExec(updateSiteurlCommand, config, true);
                                    
                                    const updateHomeCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${optionsTable} SET option_value = '${newHome}' WHERE option_name = 'home'"""`;
                                    await localhostMagentoRootExec(updateHomeCommand, config, true);
                                    
                                    // Also do domain replacement in all option values (for serialized data, widgets, etc.)
                                    // But preserve the paths by only replacing the domain part
                                    const searchReplaceHttpsCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${optionsTable} SET option_value = REPLACE(option_value, 'https://${oldDomain}/', '${protocol}${newDomain}/')"""`;
                                    await localhostMagentoRootExec(searchReplaceHttpsCommand, config, true);
                                    
                                    const searchReplaceHttpCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${optionsTable} SET option_value = REPLACE(option_value, 'http://${oldDomain}/', '${protocol}${newDomain}/')"""`;
                                    await localhostMagentoRootExec(searchReplaceHttpCommand, config, true);
                                }
                                
                                // Store configured domains for final message
                                config.wordpressConfig.configuredSites = sites;
                            } else {
                                // No custom mapping - use default behavior (update all sites)
                                const replaceCommandSite = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}site SET domain = '${localDomain}'"""`;
                                await localhostMagentoRootExec(replaceCommandSite, config, true);
                                
                                const replaceCommandBlogs = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain, '${wordpressUrl}', '${localDomain}')"""`;
                                await localhostMagentoRootExec(replaceCommandBlogs, config, true);
                                
                                const replaceCommandOptions = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value, '${wordpressUrl}', '${localDomain}') WHERE option_name IN ('siteurl', 'home')"""`;
                                await localhostMagentoRootExec(replaceCommandOptions, config, true);
                            }
                            
                            // Update domain mapping if domain mapping plugin is used
                            const checkDomainMappingCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SHOW TABLES LIKE '${config.wordpressConfig.prefix}domain_mapping'"""`;
                            const dmResult = await localhostMagentoRootExec(checkDomainMappingCommand, config, true);
                            
                            if (dmResult && String(dmResult).includes('domain_mapping')) {
                                const clearDomainMappingCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; DELETE FROM ${config.wordpressConfig.prefix}domain_mapping"""`;
                                await localhostMagentoRootExec(clearDomainMappingCommand, config, true);
                            }
                        } else {
                            // SINGLE SITE CONFIGURATION (original logic)
                            const replaceCommandOptions = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value, '${wordpressUrl}', '${localDomain}')"""`;
                            await localhostMagentoRootExec(replaceCommandOptions, config, true);
                        }
                    } else {
                        // Non-DDEV environment
                        let wordpressUrl = await localhostMagentoRootExec(`cd wp; wp db query "SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"`, config);
                        wordpressUrl = wordpressReplaces(String(wordpressUrl).replace('option_value', '').trim(), 'https://').split('/')[0];
                        
                        if (isMultisite) {
                            // MULTISITE CONFIGURATION WITH CUSTOM DOMAIN MAPPING (Non-DDEV)
                            
                            // Only process sites that are explicitly mapped
                            const hasMappedSites = Object.keys(wordpressDomainMapping).length > 0;
                            
                            if (hasMappedSites) {
                                // Get all sites from database  
                                const sitesCommand = `cd wp; wp db query "SELECT blog_id, domain, path FROM ${config.wordpressConfig.prefix}blogs"`;
                                const sitesResult = await localhostMagentoRootExec(sitesCommand, config, true);
                                
                                // Parse sites and filter to only mapped ones
                                const sites: Array<{blog_id: string, domain: string, path: string, newDomain: string}> = [];
                                if (sitesResult) {
                                    const lines = String(sitesResult).split('\n').filter(l => l && !l.startsWith('blog_id'));
                                    for (const line of lines) {
                                        const parts = line.trim().split(/\s+/);
                                        if (parts.length >= 3) {
                                            const blog_id = parts[0];
                                            const domain = parts[1];
                                            const path = parts[2];
                                            
                                            // Only process if this site is mapped
                                            if (wordpressDomainMapping[blog_id]) {
                                                const newDomain = wordpressDomainMapping[blog_id];
                                                sites.push({ blog_id, domain, path, newDomain });
                                            }
                                        }
                                    }
                                }
                                
                                // Update main network domain (only if blog_id 1 is mapped)
                                if (wordpressDomainMapping['1']) {
                                    const mainSiteDomain = wordpressDomainMapping['1'];
                                    await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = '${mainSiteDomain}'"`, config);
                                }
                                
                                // Update each mapped site individually
                                for (const site of sites) {
                                    const blogId = site.blog_id;
                                    const oldDomain = site.domain;
                                    const newDomain = site.newDomain;
                                    
                                    // Update domain in wp_blogs
                                    await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = '${newDomain}' WHERE blog_id = ${blogId}"`, config);
                                    
                                    // Use WP-CLI search-replace for each site to preserve paths
                                    // Replace domain only, keeping paths intact
                                    await localhostMagentoRootExec(`cd wp; wp search-replace '://${oldDomain}/' '://${newDomain}/' --skip-columns=guid --skip-tables=wp_users`, config, true);
                                }
                                
                                // Store configured domains for final message
                                config.wordpressConfig.configuredSites = sites;
                            } else {
                                // No custom mapping - use default behavior (update all sites)
                                await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = '${localDomain}'"`, config);
                                await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = '${localDomain}'"`, config);
                                
                                await localhostMagentoRootExec(`cd wp; wp search-replace 'https://${wordpressUrl}' 'http://${localDomain}' --network --skip-columns=guid`, config, true);
                                await localhostMagentoRootExec(`cd wp; wp search-replace 'http://${wordpressUrl}' 'http://${localDomain}' --network --skip-columns=guid`, config, true);
                            }
                            
                            // Clear domain mapping
                            const checkDM = await localhostMagentoRootExec(`cd wp; wp db query "SHOW TABLES LIKE '${config.wordpressConfig.prefix}domain_mapping'"`, config, true);
                            if (checkDM && String(checkDM).includes('domain_mapping')) {
                                await localhostMagentoRootExec(`cd wp; wp db query "DELETE FROM ${config.wordpressConfig.prefix}domain_mapping"`, config, true);
                            }
                        } else {
                            // SINGLE SITE CONFIGURATION (original logic)
                            await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'${wordpressUrl}', '${localDomain}')"`, config);
                            await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'https://', 'http://')"`, config);
                        }
                    }
                    
                    // Update task title with configured domains count
                    if (isMultisite && config.wordpressConfig.configuredSites) {
                        const siteCount = config.wordpressConfig.configuredSites.length;
                        const customMappingCount = Object.keys(wordpressDomainMapping).length;
                        
                        if (customMappingCount > 0) {
                            task.title = `Configured ${siteCount} sites (${customMappingCount} with custom domains)`;
                        } else {
                            task.title = `Configured ${siteCount} sites for ${multisiteType} multisite`;
                        }
                    } else {
                        task.title = isMultisite 
                            ? `Configured all sites for ${multisiteType} multisite`
                            : `Configured single site URLs`;
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: `Creating admin user`,
                task: async (): Promise<void> => {
                    if (config.settings.isDdevActive) {
                        // Retrieve current site URL from database
                        await localhostWpRootExec(`user create developmentadmin ${configFile.magentoBackend.adminEmailAddress} --role=administrator --user_pass=${configFile.magentoBackend.adminPassword}`, config, true);
                    } else {
                        // Retrieve current site URL from database
                        await localhostMagentoRootExec(`cd wp; wp user create developmentadmin ${configFile.magentoBackend.adminEmailAddress} --role="administrator" --user_pass="${configFile.magentoBackend.adminPassword}"`, config);
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Cleaning up',
                task: async (): Promise<void> => {
                    // Remove wordpress database from wp folder
                    const sqlFileName = `${config.wordpressConfig.database}.sql`;
                    await localhostMagentoRootExec(`cd wp; rm -f ${sqlFileName}`, config, true);
                }
            }
        );
    }
}

export default WordpressConfigureTask
