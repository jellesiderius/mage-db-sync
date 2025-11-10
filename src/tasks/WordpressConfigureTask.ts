import {localhostMagentoRootExec, localhostWpRootExec, wordpressReplaces} from '../utils/Console';
import { Listr } from 'listr2';
import configFile from '../../config/settings.json'

interface TaskItem {
    title: string;
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

                        let grantCommand1 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`
                        let grantCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`
                        let dropCommand = `db drop --yes`;
                        let grantCommand3 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS db_wp; GRANT ALL ON db_wp.* TO 'db'@'%';"""`;
                        let createCommand = `db create`;
                        let importCommand = `db import ${sqlFileName}`;

                        // Import SQL file to database
                        await localhostMagentoRootExec(grantCommand1, config, true);
                        await localhostMagentoRootExec(grantCommand2, config, true);
                        await localhostWpRootExec(dropCommand, config, true);
                        await localhostMagentoRootExec(grantCommand3, config, true);
                        await localhostWpRootExec(createCommand, config, true);
                        await localhostWpRootExec(importCommand, config, true);
                    } else {
                        // Decompress if needed, then move and import
                        let commands = [];
                        
                        if (isCompressed) {
                            commands.push(`gunzip -f ${compressedFile}`);
                        }
                        
                        commands.push(`mv ${sqlFileName} wp/`);
                        commands.push(`cd wp`);
                        commands.push(`${config.settings.wpCommandLocal} db drop --yes`);
                        commands.push(`${config.settings.wpCommandLocal} db create`);
                        commands.push(`${config.settings.wpCommandLocal} db import ${sqlFileName}`);
                        
                        let command = commands.join('; ');
                        
                        // Import SQL file to database
                        await localhostMagentoRootExec(command, config, true);
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: `Configuring URL's for development`,
                task: async (): Promise<void> => {
                    if (config.settings.isDdevActive) {
                        // Retrieve current site URL from database
                        let wordpressUrlCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"""`;
                        let wordpressUrl = await localhostMagentoRootExec(wordpressUrlCommand, config, true);
                        wordpressUrl = wordpressReplaces(String(wordpressUrl).replace('option_value', '').trim(), 'https://').split('/')[0];

                        let replaceCommandBlogs = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain, '${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"""`;
                        await localhostMagentoRootExec(replaceCommandBlogs, config, true);

                        let replaceCommandOptions = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value, '${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"""`;
                        await localhostMagentoRootExec(replaceCommandOptions, config, true);
                    } else {
                        // Retrieve current site URL from database
                        let wordpressUrl = await localhostMagentoRootExec(`cd wp; wp db query "SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"`, config);
                        wordpressUrl = wordpressReplaces(String(wordpressUrl).replace('option_value', '').trim(), 'https://').split('/')[0];
                        // Replace options for localhost
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'https://', 'http://');"`, config);
                        // Replace blogs for localhost
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'https://', 'http://');"`, config);
                        // Replace site for localhost
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = REPLACE(domain,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        await localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = REPLACE(domain,'https://', 'http://');"`, config);
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
