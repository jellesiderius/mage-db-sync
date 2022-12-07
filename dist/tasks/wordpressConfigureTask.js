"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
class WordpressConfigureTask {
    constructor() {
        this.configureTasks = [];
        this.configure = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.addTasks(list, config);
            return list;
        });
        // Add tasks
        this.addTasks = (list, config) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            list.add({
                title: 'Import Wordpress database to localhost',
                task: (ctx, task) => task.newListr(this.configureTasks)
            });
            this.configureTasks.push({
                title: 'Importing database',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Import SQL file to database
                    yield (0, console_1.localhostMagentoRootExec)(`mv ${config.wordpressConfig.database}.sql wp; cd wp; wp db import ${config.wordpressConfig.database}.sql`, config);
                })
            });
            this.configureTasks.push({
                title: `Configuring URL's for development`,
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
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
                })
            });
            this.configureTasks.push({
                title: `Creating admin user`,
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Retrieve current site URL from database
                    yield (0, console_1.localhostMagentoRootExec)(`cd wp; wp user create developmentadmin ${settings_json_1.default.magentoBackend.adminEmailAddress} --role="administrator" --user_pass="${settings_json_1.default.magentoBackend.adminPassword}"`, config);
                })
            });
            this.configureTasks.push({
                title: 'Cleaning up',
                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    // Remove wordpress database from localhost
                    yield (0, console_1.localhostMagentoRootExec)(`cd wp; rm ${config.wordpressConfig.database}.sql`, config);
                })
            });
        });
    }
}
exports.default = WordpressConfigureTask;
//# sourceMappingURL=wordpressConfigureTask.js.map