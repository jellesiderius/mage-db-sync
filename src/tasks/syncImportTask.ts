import {
    error,
    localhostMagentoRootExec,
    sshNavigateToMagentoRootCommand,
    sshMagentoRootFolderMagerunCommand, consoleCommand
} from '../utils/console';
import { Listr } from 'listr2';

class SyncImportTask {
    private importTasks = [];
    private configureTasks = [];
    private stagingValues = {};

    configure = async (list: any, config: any, ssh: any) => {
        await this.addTasks(list, config, ssh);
        return list;
    }

    collectStagingConfigValue = async (path: string, ssh: any, config: any) => {
        let self = this;
        let json = await ssh.execCommand(sshMagentoRootFolderMagerunCommand('config:store:get "'+path+'" --format=json', config, true));
        json = json.stdout;

        try {
            // Check if string is JSON
            JSON.parse(json);
        } catch (e) {
            return false;
        }

        if (json) {
            const jsonObj = JSON.parse(<string>json);
            if (jsonObj && typeof jsonObj === `object`) {
                // @ts-ignore
                self.stagingValues[path] = [];

                Object.keys(jsonObj).forEach(function (item) {
                    var objectItem = jsonObj[item];
                    var objectItemPath = objectItem['Path'];
                    var objectItemValue = String(objectItem['Value']);
                    var objectItemScopeId = parseInt(objectItem['Scope-ID']);
                    var objectItemScope = objectItem['Scope'];

                    if (objectItemValue == '' || objectItemValue == 'NULL' || objectItemValue == 'null') {
                        return;
                    }

                    // @ts-ignore
                    self.stagingValues[path].push(
                        {
                            // @ts-ignore
                            'path': objectItemPath,
                            // @ts-ignore
                            'scope': objectItemScope,
                            // @ts-ignore
                            'scope_id': objectItemScopeId,
                            // @ts-ignore
                            'value': objectItemValue
                        }
                    )
                });
            }
        }
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
                title: 'Retrieving current staging core_config_data needed values',
                task: async (): Promise<void> => {
                    // General
                    await this.collectStagingConfigValue('web/*', ssh, config);
                    await this.collectStagingConfigValue('admin/*', ssh, config);
                    await this.collectStagingConfigValue('checkout/*', ssh, config);
                    await this.collectStagingConfigValue('magmodules_richsnippets/*', ssh, config);
                    await this.collectStagingConfigValue('sherpaan_*', ssh, config);
                    await this.collectStagingConfigValue('sherpaconnect2/*', ssh, config);
                    // Email
                    await this.collectStagingConfigValue('email/*', ssh, config);
                    await this.collectStagingConfigValue('trans_email/*', ssh, config);
                    await this.collectStagingConfigValue('sales_email/*', ssh, config);
                    await this.collectStagingConfigValue('sales_pdf/*', ssh, config);
                    await this.collectStagingConfigValue('smtp/*', ssh, config);
                    await this.collectStagingConfigValue('mailchimp/*', ssh, config);
                    await this.collectStagingConfigValue('smtppro/*', ssh, config);
                    await this.collectStagingConfigValue('cart2quote_email/*', ssh, config);
                    // Search
                    await this.collectStagingConfigValue('search/*', ssh, config);
                    await this.collectStagingConfigValue('catalog/search/*', ssh, config);
                    await this.collectStagingConfigValue('elasticsearch/*', ssh, config);
                    await this.collectStagingConfigValue('klevu_search/*', ssh, config);
                    // Shipping
                    await this.collectStagingConfigValue('shipping/*', ssh, config);
                    await this.collectStagingConfigValue('carriers/*', ssh, config);
                    await this.collectStagingConfigValue('tig_postnl/*', ssh, config);
                    await this.collectStagingConfigValue('postcodenl/*', ssh, config);
                    await this.collectStagingConfigValue('euvat/*', ssh, config);
                    // Payment
                    await this.collectStagingConfigValue('payment/*', ssh, config);
                    await this.collectStagingConfigValue('buckaroo_magento2/*', ssh, config);
                    await this.collectStagingConfigValue('tig_buckaroo/*', ssh, config);
                    await this.collectStagingConfigValue('msp/*', ssh, config);
                    await this.collectStagingConfigValue('msp_gateways/*', ssh, config);
                    await this.collectStagingConfigValue('gateways/*', ssh, config);
                    // Recaptcha
                    await this.collectStagingConfigValue('recaptcha_frontend/*', ssh, config);
                    await this.collectStagingConfigValue('recaptcha_backend/*', ssh, config);
                }
            },
        );

        this.importTasks.push(
            {
                title: 'Uploading database file to server',
                task: async (): Promise<void> => {
                    // Push file to server through rSync
                    await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
                    // Add include tables file
                    await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${config.finalMessages.magentoDatabaseIncludeLocation} ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}`, config, true);
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

        this.importTasks.push(
            {
                title: 'Importing tables to keep into database',
                task: async (): Promise<void> => {
                    // Create database
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand(`db:import ${config.serverVariables.databaseName}-include.sql --force --skip-authorization-entry-creation -q`, config, true));
                }
            },
        );

        if (config.settings.syncImages == 'yes') {
            this.importTasks.push(
                {
                    title: 'Synchronizing media images & files',
                    task: async (): Promise<void> => {
                        // Push media files to server
                        var tmpLocalMediaPath = `${config.customConfig.localDatabaseFolderLocation}/tmpMediaImages`;
                        await localhostMagentoRootExec(`rsync -avz -e "ssh -p ${config.databases.databaseDataSecond.port}" ${tmpLocalMediaPath}/* ${config.databases.databaseDataSecond.username}@${config.databases.databaseDataSecond.server}:${config.serverVariables.magentoRoot}/pub/media/`, config, true);

                        // Remove files from local machine
                        await consoleCommand(`rm -rf ${tmpLocalMediaPath}`, true);
                    }
                }
            );
        }

        this.configureTasks.push(
            {
                title: "Preparing the core_config_data table",
                task: async (): Promise<void> => {
                    let self = this;

                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'design/search_engine_robots/default_robots';";

                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '1');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'design/search_engine_robots/default_robots', 'NOINDEX,NOFOLLOW');";

                    // INITIAL DELETE QUERY
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + dbQueryRemove + '"', config, true));

                    // INITIAL IMPORT QUERY
                    await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + dbQueryInsert + '"', config, true));

                    for (const itemKey of Object.keys(this.stagingValues)) {
                        var itemDeleteQuery = '';
                        var itemInsertQuery = '';

                        // @ts-ignore
                        for (const itemKeyChild of Object.keys(this.stagingValues[itemKey])) {
                            // @ts-ignore
                            var item = this.stagingValues[itemKey][itemKeyChild];

                            itemDeleteQuery = itemDeleteQuery + `DELETE FROM core_config_data WHERE path LIKE '${item.path}';`;
                            itemInsertQuery = itemInsertQuery + `INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('${item.scope}', '${item.scope_id}', '${item.path}', '${item.value}');`;
                        }

                        // DELETE QUERY
                        await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + itemDeleteQuery + '"', config, true));

                        // IMPORT QUERY
                        await ssh.execCommand(sshMagentoRootFolderMagerunCommand('db:query "' + itemInsertQuery + '"', config, true));
                    }
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
                        // Update queries
                        dbQueryUpdate = `UPDATE core_config_data SET value = '0' WHERE path LIKE '%_enable_auth%';`;

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
                        dbQuery = dbQueryUpdate;

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
