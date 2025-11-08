import {localhostMagentoRootExec, sshMagentoRootFolderMagerunCommand} from '../utils/Console';
import { Listr } from 'listr2';
import configFile from '../../config/settings.json'
import fs from "fs";

interface TaskItem {
    title: string;
    task: (ctx?: any, task?: any) => Promise<void | boolean>;
    skip?: string | (() => boolean);
}

class MagentoConfigureTask {
    private configureTasks: TaskItem[] = [];

    configure = async (list: any, config: any) => {
        await this.addTasks(list, config);
        return list;
    }

    // Add tasks
    addTasks = async (list: any, config: any) => {
        list.add(
            {
                title: 'Configuring Magento for development usage',
                task: (ctx: any, task: any): Listr =>
                task.newListr(
                    this.configureTasks
                )
            }
        )

        this.configureTasks.push(
            {
                title: "Replacing URL's and doing some preperation for development",
                task: async (): Promise<void> => {
                    var dbQuery = '';
                    // Delete queries
                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/css/merge_css_files';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/js/minify_files';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/css/minify_files';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/js/enable_js_bundling';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%smtp%';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'msp_devtools/general/enabled';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'system/security/max_session_size_admin';",
                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE '%ceyenne%';";

                    // Update queries
                    var dbQueryUpdate = "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_frontend';",
                        dbQueryUpdate = dbQueryUpdate + "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_adminhtml';"

                    let baseUrl = 'http://' + config.settings.magentoLocalhostDomainName + '/';

                    if (config.settings.isDdevActive) {
                        dbQueryUpdate = "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_frontend';",
                        dbQueryUpdate = dbQueryUpdate + "UPDATE core_config_data SET value = '1' WHERE path = 'web/secure/use_in_adminhtml';"

                        baseUrl = 'https://' + config.settings.magentoLocalhostDomainName + '/';
                    }

                    // Insert queries
                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'msp_devtools/general/enabled', '1');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/css/merge_css_files', '0');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/js/minify_files', '0');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/css/minify_files', '0');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/js/enable_js_bundling', '0');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'system/security/max_session_size_admin', '1024000');",
                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '0');";

                    // Build up query
                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;

                    // Set import domain for final message on completing all tasks
                    config.finalMessages.importDomain = baseUrl;

                    await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);

                    let allUrlsJson = sshMagentoRootFolderMagerunCommand('config:store:get "web/secure/base_url" --format=json', config, false);

                    if (allUrlsJson.length > 0) {
                        try {
                            const obj = JSON.parse(<string>allUrlsJson);
                            if (obj && typeof obj === `object`) {
                                // @TODO: Add all URL's in overview:
                                //console.log(obj);
                                //process.exit();
                                //objValue = JSON.parse(engineCheck)[0].Value;
                            }
                        } catch (err) {}
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: "Configuring ElasticSearch 7",
                task: async (): Promise<void> => {
                    // Batch all ElasticSearch configuration into ONE query - MUCH faster!
                    const hostname = config.settings.isDdevActive ? 'elasticsearch' : 'localhost';
                    const servers = config.settings.isDdevActive ? 'elasticsearch:9200' : 'localhost:9200';
                    
                    const esQuery = `
                        DELETE FROM core_config_data WHERE path LIKE 'amasty_elastic%';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/engine';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/elasticsearch7_server_hostname';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/elasticsearch7_server_port';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/elasticsearch7_index_prefix';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/elasticsearch7_enable_auth';
                        DELETE FROM core_config_data WHERE path = 'catalog/search/elasticsearch7_server_timeout';
                        DELETE FROM core_config_data WHERE path = 'smile_elasticsuite_core_base_settings/es_client/servers';
                        DELETE FROM core_config_data WHERE path = 'amasty_elastic/connection/engine';
                        INSERT INTO core_config_data (scope, scope_id, path, value) VALUES 
                            ('default', 0, 'catalog/search/engine', 'elasticsearch7'),
                            ('default', 0, 'catalog/search/elasticsearch7_server_hostname', '${hostname}'),
                            ('default', 0, 'catalog/search/elasticsearch7_server_port', '9200'),
                            ('default', 0, 'catalog/search/elasticsearch7_index_prefix', '${config.settings.currentFolderName}'),
                            ('default', 0, 'catalog/search/elasticsearch7_enable_auth', '0'),
                            ('default', 0, 'catalog/search/elasticsearch7_server_timeout', '15'),
                            ('default', 0, 'smile_elasticsuite_core_base_settings/es_client/servers', '${servers}'),
                            ('default', 0, 'amasty_elastic/connection/engine', 'elasticsearch7');
                    `;
                    
                    await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${esQuery}"`, config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Creating an admin user',
                task: async (): Promise<void> => {
                    // Batch: Delete users + add auth entries, then create new user
                    // This is faster than running 3 separate commands
                    const dbQuery = `DELETE FROM admin_user; ALTER TABLE admin_user AUTO_INCREMENT = 1;`;
                    
                    // Run db query and auth entries in parallel
                    await Promise.all([
                        localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config),
                        localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:add-default-authorization-entries`, config)
                    ]);

                    // Create a new admin user
                    const createUserCmd = config.settings.isDdevActive
                        ? `ddev exec bin/magento admin:user:create --admin-user=${configFile.magentoBackend.adminUsername} --admin-password=${configFile.magentoBackend.adminPassword} --admin-email=${configFile.magentoBackend.adminEmailAddress} --admin-firstname=Firstname --admin-lastname=Lastname`
                        : `${config.settings.magerun2CommandLocal} admin:user:create --admin-user=${configFile.magentoBackend.adminUsername} --admin-password=${configFile.magentoBackend.adminPassword} --admin-email=${configFile.magentoBackend.adminEmailAddress} --admin-firstname=Firstname --admin-lastname=Lastname`;
                    
                    await localhostMagentoRootExec(createUserCmd, config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Disable reCAPTCHA',
                task: async (): Promise<void> => {
                    // Batch all reCAPTCHA configuration into ONE query - MUCH faster!
                    const captchaQuery = `
                        DELETE FROM core_config_data WHERE path LIKE 'recaptcha_frontend%';
                        DELETE FROM core_config_data WHERE path LIKE 'recaptcha_backend%';
                        DELETE FROM core_config_data WHERE path LIKE 'msp_securitysuite_recaptcha%';
                        DELETE FROM core_config_data WHERE path = 'admin/captcha/enable';
                        DELETE FROM core_config_data WHERE path = 'customer/captcha/enable';
                        DELETE FROM core_config_data WHERE path = 'recaptcha/general/enabled';
                        INSERT INTO core_config_data (scope, scope_id, path, value) VALUES 
                            ('default', 0, 'admin/captcha/enable', '0'),
                            ('default', 0, 'customer/captcha/enable', '0'),
                            ('default', 0, 'recaptcha/general/enabled', '0');
                    `;
                    
                    await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${captchaQuery}"`, config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Configuring cache',
                task: async (): Promise<void> => {
                    await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} config:store:set system/full_page_cache/caching_application 1`, config);
                }
            }
        );

        if (config.settings.syncImageTypes && !config.settings.syncImageTypes.includes('Product images') || !config.settings.syncImageTypes) {
            this.configureTasks.push(
                {
                    title: 'Removing placeholder configuration',
                    task: async (): Promise<void> => {
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} config:store:delete catalog/placeholder/* --all`, config);
                    }
                }
            );
        }

        this.configureTasks.push(
            {
                title: 'Creating a dummy customer on every website',
                task: async (): Promise<void> => {
                    // Create new dummy customers for all websites IN PARALLEL - MUCH faster!
                    // Get all websites
                    let allWebsites = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} sys:website:list --format=json`, config);
                    allWebsites = JSON.parse(<string>allWebsites);

                    // Create customers in parallel instead of sequentially
                    const customerPromises = Object.entries(allWebsites as Record<string, any>).map(([key, value]) => {
                        const code = (value as any).code;
                        return localhostMagentoRootExec(
                            `${config.settings.magerun2CommandLocal} customer:create ${configFile.magentoBackend.adminEmailAddress} ${configFile.magentoBackend.adminPassword} Firstname Lastname ${code}`, 
                            config, 
                            true
                        );
                    });
                    
                    // Wait for all customers to be created
                    await Promise.all(customerPromises);
                }
            }
        );

        this.configureTasks.push(
            {
                title: "Configuring Wordpress settings within Magento",
                task: async (): Promise<void> => {
                    // If wordpress is imported, we do nothing
                    if (config.settings.wordpressImport && config.settings.wordpressImport == 'yes') {
                        return;
                    } else {
                        // Batch WordPress configuration into ONE query
                        const wpQuery = `
                            DELETE FROM core_config_data WHERE path LIKE 'wordpress/%';
                            INSERT INTO core_config_data (scope, scope_id, path, value) VALUES 
                                ('default', 0, 'wordpress/setup/mode', 'NULL'),
                                ('default', 0, 'wordpress/multisite/enabled', '0');
                        `;
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${wpQuery}"`, config);
                    }
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Synchronizing module versions on localhost',
                task: async (): Promise<void> => {
                    // Downgrade module data in database
                    if (config.settings.isDdevActive) {
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} sys:setup:downgrade-versions`, config, true);
                        await localhostMagentoRootExec(`ddev exec bin/magento setup:upgrade --no-interaction`, config, true);
                    } else {
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} sys:setup:downgrade-versions`, config, true);
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} setup:upgrade --no-interaction`, config, true);
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
                            await localhostMagentoRootExec(config.settings.magerun2Command, config, false, true);
                        }

                        // Database queries
                        if (config.settings.databaseCommand && config.settings.databaseCommand.length > 0) {
                            let dbQuery = config.settings.databaseCommand.replace(/'/g, '"');
                            await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query '` + dbQuery + `'`, config, false, true);
                        }
                    }
                }
            );
        }

        if (fs.existsSync(config.settings.currentFolder + '/.mage-db-sync-config.json')) {
            // Use custom config file for the project
            this.configureTasks.push(
                {
                    title: 'Setting core_config_data configurations through .mage-db-sync-config.json',
                    task: async (): Promise<void> => {
                        let jsonData = require(config.settings.currentFolder + '/.mage-db-sync-config.json');
                        let coreConfigData = jsonData.core_config_data;

                        if (coreConfigData) {
                            var dbQuery = '';

                            Object.keys(coreConfigData).forEach(key => {
                                let storeId = key,
                                    values = jsonData.core_config_data[key];

                                values = Object.entries(values);

                                values.map(async (entry: any) => {
                                    const [path, value] = entry;
                                    var scope = 'default';
                                    if (Number(storeId) !== 0) {
                                        scope = 'stores';
                                    }

                                    var dbQueryRemove = `DELETE FROM core_config_data WHERE path = '${path}' AND scope_id = '${storeId}';`;
                                    var dbQueryInsert = `INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('${scope}', '${storeId}', '${path}', '${value}');`;

                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryInsert;
                                });
                            });

                            if (dbQuery) {
                                await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} db:query "${dbQuery}"`, config);
                            }
                        }
                    }
                }
            );
        }

        this.configureTasks.push(
            {
                title: 'Removing generated code',
                task: async (): Promise<void> => {
                    // Remove generated code
                    await localhostMagentoRootExec("rm -rf generated/code", config);
                }
            }
        );

        this.configureTasks.push(
            {
                title: 'Reindexing & flushing Magento caches',
                task: async (): Promise<void> => {
                    // Batch cache operations together
                    if (config.settings.elasticSearchUsed) {
                        // Clear Elasticsearch index
                        if (config.settings.isDdevActive) {
                            await localhostMagentoRootExec(`ddev exec curl -X DELETE 'http://elasticsearch:9200/_all'`, config);
                        }

                        // Batch: enable cache + flush + config import in ONE command
                        await localhostMagentoRootExec(
                            `${config.settings.magerun2CommandLocal} cache:enable && ${config.settings.magerun2CommandLocal} cache:flush && ${config.settings.magerun2CommandLocal} app:config:import`, 
                            config
                        );

                        // Reindex only essential indexes (skip slow ones)
                        // Run index:reset and reindex in ONE command with && for speed
                        const indexers = 'catalog_category_product catalog_product_category catalog_product_price cataloginventory_stock';
                        
                        if (config.settings.isDdevActive) {
                            await localhostMagentoRootExec(
                                `ddev exec bin/magento index:reset ${indexers} && ddev exec bin/magento index:reindex ${indexers}`, 
                                config
                            );
                            // Run catalogsearch_fulltext separately (can be slow, user can run manually if needed)
                            // await localhostMagentoRootExec(`ddev exec bin/magento index:reindex catalogsearch_fulltext`, config);
                        } else {
                            await localhostMagentoRootExec(
                                `${config.settings.magerun2CommandLocal} index:reset ${indexers} && ${config.settings.magerun2CommandLocal} index:reindex ${indexers}`, 
                                config
                            );
                            // Skip catalogsearch_fulltext for speed - user can run manually
                        }
                    } else {
                        // No ElasticSearch - just cache operations
                        await localhostMagentoRootExec(
                            `${config.settings.magerun2CommandLocal} cache:enable && ${config.settings.magerun2CommandLocal} cache:flush`, 
                            config
                        );
                    }

                    // Gather all urls
                    let urls = await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} sys:store:config:base-url:list --format=json`, config);
                    urls = JSON.parse(<string>urls);
                    for (const [key, value] of Object.entries(urls as Record<string, any>)) {
                        let url = (value as any).secure_baseurl;
                        if (!config.finalMessages.domains.includes(url)) {
                            config.finalMessages.domains.push(url);
                        }
                    }

                    // Final config import
                    if (config.settings.isDdevActive) {
                        await localhostMagentoRootExec(`ddev exec bin/magento app:config:import`, config);
                    } else {
                        await localhostMagentoRootExec(`${config.settings.magerun2CommandLocal} app:config:import`, config);
                    }
                }
            }
        );
    }
}

export default MagentoConfigureTask
