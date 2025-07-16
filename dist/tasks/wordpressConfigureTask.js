"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const settings_json_1 = (0, tslib_1.__importDefault)(require("../../config/settings.json"));
class WordpressConfigureTask {
    constructor() {
        this.configureTasks = [];
        this.configure = (list, config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            list.add({
                title: 'Import Wordpress database to localhost',
                task: (ctx, task) => task.newListr(this.configureTasks)
            });
            this.configureTasks.push({
                title: 'Importing database',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    if (config.settings.isDdevActive) {
                        yield (0, console_1.localhostMagentoRootExec)(`mv ${config.wordpressConfig.database}.sql wp`, config, false);
                        let grantCommand1 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'localhost';"""`;
                        let grantCommand2 = `ddev mysql -uroot -proot -hdb -e "GRANT ALL PRIVILEGES ON *.* TO 'db'@'%';"""`;
                        let dropCommand = `db drop --yes`;
                        let grantCommand3 = `ddev mysql -uroot -proot -hdb -e "CREATE DATABASE IF NOT EXISTS db_wp; GRANT ALL ON db_wp.* TO 'db'@'%';"""`;
                        let createCommand = `db create`;
                        let importCommand = `db import ${config.wordpressConfig.database}.sql`;
                        // Import SQL file to database
                        yield (0, console_1.localhostMagentoRootExec)(grantCommand1, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(grantCommand2, config, true);
                        yield (0, console_1.localhostWpRootExec)(dropCommand, config, true);
                        yield (0, console_1.localhostMagentoRootExec)(grantCommand3, config, true);
                        yield (0, console_1.localhostWpRootExec)(createCommand, config, true);
                        yield (0, console_1.localhostWpRootExec)(importCommand, config, true);
                    }
                    else {
                        let command = `mv ${config.wordpressConfig.database}.sql wp; ${config.settings.wpCommandLocal} db drop --yes;${config.settings.wpCommandLocal} db create; ${config.settings.wpCommandLocal} db import ${config.wordpressConfig.database}.sql`;
                        // Import SQL file to database
                        yield (0, console_1.localhostMagentoRootExec)(command, config, true);
                    }
                })
            });
            this.configureTasks.push({
                title: `Configuring URL's for development`,
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    if (config.settings.isDdevActive) {
                        // Retrieve current site URL from database
                        let wordpressUrlCommand = `ddev mysql -uroot -proot -hdb -e "USE db_wp; SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"""`;
                        let wordpressUrl = yield (0, console_1.localhostMagentoRootExec)(wordpressUrlCommand, config, true);
                        // @ts-ignore
                        wordpressUrl = (0, console_1.wordpressReplaces)(wordpressUrl.replace('option_value', '').trim(), 'https://').split('/')[0];
                        let replaceCommandBlogs = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain, '${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"""`;
                        yield (0, console_1.localhostMagentoRootExec)(replaceCommandBlogs, config, true);
                        let replaceCommandOptions = `ddev mysql -uroot -proot -hdb -e "USE db_wp; UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value, '${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"""`;
                        yield (0, console_1.localhostMagentoRootExec)(replaceCommandOptions, config, true);
                    }
                    else {
                        // Retrieve current site URL from database
                        let wordpressUrl = yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "SELECT option_value FROM ${config.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"`, config);
                        // @ts-ignore
                        wordpressUrl = (0, console_1.wordpressReplaces)(wordpressUrl.replace('option_value', '').trim(), 'https://').split('/')[0];
                        // Replace options for localhost
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'https://', 'http://');"`, config);
                        // Replace blogs for localhost
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'https://', 'http://');"`, config);
                        // Replace site for localhost
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = REPLACE(domain,'${wordpressUrl}', '${config.settings.magentoLocalhostDomainName}');"`, config);
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp db query "UPDATE ${config.wordpressConfig.prefix}site SET domain = REPLACE(domain,'https://', 'http://');"`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: `Creating admin user`,
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    if (config.settings.isDdevActive) {
                        // Retrieve current site URL from database
                        yield (0, console_1.localhostWpRootExec)(`user create developmentadmin ${settings_json_1.default.magentoBackend.adminEmailAddress} --role=administrator --user_pass=${settings_json_1.default.magentoBackend.adminPassword}`, config, true);
                    }
                    else {
                        // Retrieve current site URL from database
                        yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp user create developmentadmin ${settings_json_1.default.magentoBackend.adminEmailAddress} --role="administrator" --user_pass="${settings_json_1.default.magentoBackend.adminPassword}"`, config);
                    }
                })
            });
            this.configureTasks.push({
                title: 'Cleaning up',
                task: () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                    // Remove wordpress database from localhost
                    yield (0, console_1.localhostMagentoRootExec)(`cd wp; rm ${config.wordpressConfig.database}.sql`, config, true);
                })
            });
        });
    }
}
exports.default = WordpressConfigureTask;
//# sourceMappingURL=wordpressConfigureTask.js.map