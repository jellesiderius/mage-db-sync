import {
    error,
    localhostMagentoRootExec,
    sshMagentoRootFolderPhpCommand,
    sshNavigateToMagentoRootCommand,
    sshMagentoRootFolderMagerunCommand
} from '../utils/console';
import { Listr } from 'listr2';
import configFile from "../../config/settings.json";

class SyncImportTask {
    private importTasks = [];
    private configureTasks = [];

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any, ssh: any) => {
        list.add(
            {
                title: `Import Magento database to: ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.databases.databaseDataSecond.port} | ${config.databases.databaseDataSecond.domainFolder}`,
                task: (ctx: any, task: any): Listr =>
                    task.newListr(
                        this.importTasks
                    )
            }
        )

        list.add(
            {
                title: `Configuring Magento on staging environment`,
                task: (ctx: any, task: any): Listr =>
                    task.newListr(
                        this.configureTasks
                    )
            }
        )

        this.importTasks.push(
            {
                title: 'Connecting to server through SSH',
                task: async (): Promise<void> => {
                    // Open connection to SSH server
                    await ssh.connect({
                        host: config.databases.databaseDataSecond.server,
                        password: config.databases.databaseDataSecond.password,
                        username: config.databases.databaseDataSecond.username,
                        port: config.databases.databaseDataSecond.port,
                        privateKey: config.customConfig.sshKeyLocation,
                        passphrase: config.customConfig.sshPassphrase
                    });
                }
            }
        );

        this.importTasks.push(
            {
                title: 'Retrieving server settings',
                task: async (): Promise<void> => {
                    // Retrieve settings from server to use
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('test -e vendor/magento && test -e app/etc/env.php && echo 2 || echo 1; pwd; which php;', config, true)).then((result: any) => {
                        if (result) {
                            let serverValues = result.stdout.split("\n");
                            // Check if Magento 1 or Magento 2
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            // Get Magento root
                            config.serverVariables.magentoRoot = serverValues[1];
                            // Get PHP path
                            config.serverVariables.externalPhpPath = serverValues[2];
                        }
                    });

                    if (config.serverVariables.magentoVersion != 2) {
                        error('Magento 2 not completely found staging server, are app/etc/env.php & vendor/magento present?');
                        process.exit();
                    }

                    // Use custom PHP path instead if given
                    if (config.databases.databaseDataSecond.externalPhpPath && config.databases.databaseDataSecond.externalPhpPath.length > 0) {
                        config.serverVariables.externalPhpPath = config.databases.databaseDataSecond.externalPhpPath;
                    }

                    // Determine Magerun version based on magento version
                    config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;


                }
            }
        );

        this.importTasks.push(
            {
                title: 'Downloading Magerun to server',
                task: async (): Promise<void> => {
                    // Download Magerun to the server
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + config.serverVariables.magerunFile, config, true));
                }
            },
        );

        this.importTasks.push(
            {
                title: 'Uploading database file to server',
                task: async (): Promise<void> => {
                    // Push file to server through rSync\
                    await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
                }
            },
        );

        this.importTasks.push(
            {
                title: 'Importing Magento database',
                task: async (): Promise<void> => {
                    // Create database
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand(`db:import ${config.serverVariables.databaseName}.sql --force --skip-authorization-entry-creation -q --drop`, config, true));
                }
            },
        );

        this.configureTasks.push(
            {
                title: "Replacing URL's and doing some preparation",
                task: async (): Promise<void> => {

                    // TODO: Automatically set URL's based on current core_config_data URL's

                    var dbQuery = '';
                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%smtp%';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';"
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'design/search_engine_robots/default_robots';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%ceyenne%';";

                    // Update queries
                    var dbQueryUpdate = "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_frontend';",
                        dbQueryUpdate = dbQueryUpdate + "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_adminhtml';";

                    let baseUrl = 'https://' + config.databases.databaseDataSecond.domainFolder + '/';

                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '1');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'design/search_engine_robots/default_robots', 'NOINDEX,NOFOLLOW');";

                    // Build up query
                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;

                    // Set import domain for final message on completing all tasks
                    config.finalMessages.importDomain = baseUrl;

                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + dbQuery + '"', config, true));
                }
            }
        );

        this.configureTasks.push(
            {
                title: "Configuring ElasticSearch 7/MySQL",
                task: async (): Promise<void> => {
                    let dbQuery = '';
                    let dbQueryUpdate = ''
                    let jsonEngineCheck = ''; // Types supported: 'elasticsearch7', 'amasty_elastic';

                    let engineCheck = await ssh.execCommand(sshMagentoRootFolderMagerunCommand('config:store:get "catalog/search/engine" --format=json', config, true));
                    // @ts-ignore
                    if (engineCheck.length > 0) {
                        try {
                            const obj = JSON.parse(<string>engineCheck);
                            if (obj && typeof obj === `object`) {
                                jsonEngineCheck = JSON.parse(engineCheck)[0].Value;
                            }
                        } catch (err) {}
                    }


                    // Configure Elastic to use version 7 if engine is not mysql
                    if (jsonEngineCheck.indexOf("mysql") == -1) {
                        let elasticPort = '9200';

                        if (config.databases.databaseDataSecond.externalElasticsearchPort) {
                            elasticPort = config.databases.databaseDataSecond.externalElasticsearchPort;
                        }

                        // Update queries
                        dbQueryUpdate = `UPDATE core_config_data SET value = 'localhost' WHERE path LIKE '%_server_hostname%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${elasticPort}' WHERE path LIKE '%_server_port%';`,
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '0' WHERE path LIKE '%_enable_auth%';`;

                        // Insert queries
                        var dbQueryInsert = `INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_port', '${elasticPort}');`,

                        // Amasty elasticsearch check
                        if (jsonEngineCheck.indexOf("amasty_elastic") !== -1) {
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'catalog/search/engine';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'amasty_elastic' WHERE path = 'amasty_elastic/connection/engine';`;
                        } else {
                            // Standard elasticsearch7 settings
                            dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging' WHERE path LIKE '%_index_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = '${config.databases.databaseDataSecond.username}_staging_' WHERE path LIKE '%elastic_prefix%';`,
                                dbQueryUpdate = dbQueryUpdate + `UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';`;
                        }

                        // Build up query
                        dbQuery = dbQueryUpdate + dbQueryInsert;

                        await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + dbQuery + '"', config, true));
                        config.settings.elasticSearchUsed = true;
                    }
                }
            }
        );

        if (config.settings.runCommands && config.settings.runCommands == 'yes') {
            this.configureTasks.push(
                {
                    title: 'Running project commands',
                    task: async (): Promise<void> => {

                        // Magerun2 commands
                        if (config.settings.magerun2Command && config.settings.magerun2Command.length > 0) {
                            let commands = config.settings.magerun2Command.replace('magerun2 ', '');

                            await ssh.execCommand(sshMagentoRootFolderMagerunCommand(commands, config, true));
                        }

                        // Database queries
                        if (config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                            let dbQuery = config.settings.databaseCommand.replace(/'/g, '"');

                            await ssh.execCommand(sshMagentoRootFolderMagerunCommand(`db:query '` + dbQuery + `'`, config, true));
                        }
                    }
                }
            );
        }

        this.configureTasks.push(
            {
                title: "Synchronizing module versions on staging",
                task: async (): Promise<void> => {
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('sys:setup:downgrade-versions ', config, true));
                    await ssh.execCommand(sshNavigateToMagentoRootCommand('bin/magento setup:upgrade --keep-generated', config, true));
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Reindexing Magento',
                task: async (): Promise<void> => {
                    // Reindex data, only when elastic is used
                    if (config.settings.elasticSearchUsed) {
                        await ssh.execCommand(sshMagentoRootFolderMagerunCommand('index:reindex catalog_category_product catalog_product_category catalog_product_price cataloginventory_stock', config, true));
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: "Flushing Magento caches",
                task: async (): Promise<void> => {
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('cache:enable', config, true));
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('cache:flush', config, true));
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('app:config:import', config, true));
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Cleaning up',
                task: async (): Promise<void> => {
                    // Remove SQL file
                    await ssh.execCommand(sshNavigateToMagentoRootCommand(`rm  ${config.serverVariables.databaseName}.sql`, config, true));

                    // Remove Magerun2 file
                    await ssh.execCommand(sshNavigateToMagentoRootCommand(`rm ${config.serverVariables.magerunFile}`, config, true));
                }
            }
        );
    }
}

export default SyncImportTask
