import { localhostMagentoRootExec, wordpressReplaces } from '../utils/console';
import { Listr } from 'listr2';
import configFile from '../../config/settings.json'

class WordpressConfigureTask {
    private configureTasks = [];

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
                    // Import SQL file to database
                    await localhostMagentoRootExec(`mv ${config.wordpressConfig.database}.sql wp; cd wp; wp db import ${config.wordpressConfig.database}.sql`, config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: `Configuring URL's for development`,
                task: async (): Promise<void> => {
                    // Retrieve current site URL from database
                    let wordpressUrl = await localhostMagentoRootExec(`cd wp; wp db query "SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"`, config);
                    // @ts-ignore
                    wordpressUrl = wordpressReplaces(wordpressUrl.replace('option_value', '').trim(), 'https://').split('/')[0];
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
        );

        this.configureTasks.push(
            {
                title: `Creating admin user`,
                task: async (): Promise<void> => {
                    // Retrieve current site URL from database
                    await localhostMagentoRootExec(`cd wp; wp user create developmentadmin ${configFile.magentoBackend.adminEmailAddress} --role="administrator" --user_pass="${configFile.magentoBackend.adminPassword}"`, config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Cleaning up',
                task: async (): Promise<void> => {
                    // Remove wordpress database from localhost
                    await localhostMagentoRootExec(`cd wp; rm ${config.wordpressConfig.database}.sql`, config);
                }
            }
        );
    }
}

export default WordpressConfigureTask