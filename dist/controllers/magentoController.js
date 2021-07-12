"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const console_1 = require("../utils/console");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
const listr2_1 = require("listr2");
// @ts-ignore
const staging_json_1 = tslib_1.__importDefault(require("../../config/databases/staging.json"));
// @ts-ignore
const production_json_1 = tslib_1.__importDefault(require("../../config/databases/production.json"));
// @ts-ignore
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
// @ts-ignore
const static_settings_json_1 = tslib_1.__importDefault(require("../../config/static-settings.json"));
const node_ssh_1 = require("node-ssh");
const os = tslib_1.__importStar(require("os"));
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
inquirer_1.default.registerPrompt("search-list", require("../../node_modules/inquirer-search-list"));
class MagentoController {
    constructor() {
        this.databases = [];
        this.databaseData = {};
        this.serverVariables = {
            'magentoVersion': 2,
            'php': '',
            'magentoRoot': '',
            'magerunFile': '',
            'databaseName': ''
        };
        this.databaseType = '';
        this.sshKeyLocation = '';
        this.localDatabaseFolderLocation = settings_json_1.default.general.databaseLocation;
        this.ssh = new node_ssh_1.NodeSSH();
        this.strip = '';
        this.finalMessages = {
            'databaseLocation': '',
            'importDomain': ''
        };
        this.currentFolder = '';
        this.currentFolderName = '';
        this.wordpressConfig = {
            'prefix': '',
            'username': '',
            'password': '',
            'host': '',
            'database': ''
        };
        this.databaseTypeQuestions = [
            {
                type: 'list',
                name: 'databaseType',
                message: 'Set database type',
                default: 'staging',
                choices: ['staging', 'production'],
                validate: (input) => {
                    return input !== '';
                }
            }
        ];
        this.databaseSelectQuestions = [
            {
                type: 'search-list',
                name: 'database',
                message: 'Select or search database',
                choices: this.databases,
                validate: (input) => {
                    return input !== '';
                }
            }
        ];
        this.databaseConfigurationQuestions = [
            {
                type: 'list',
                name: 'strip',
                default: 'stripped',
                message: 'Does the database need to be stripped for development?',
                choices: ['stripped', 'keep customer data', 'full'],
                validate: (input) => {
                    return input !== '';
                }
            },
            {
                type: 'list',
                name: 'import',
                default: 'yes',
                message: 'Import database?',
                choices: ['no'],
                validate: (input) => {
                    return false;
                }
            },
        ];
        // Starts the controller
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            var self = this;
            console_1.clearConsole();
            // Fetch SSH key location
            this.sshKeyLocation = settings_json_1.default.ssh.keyLocation;
            if (!this.sshKeyLocation) {
                this.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
            }
            // Set database type
            yield inquirer_1.default
                .prompt(this.databaseTypeQuestions)
                .then(answers => {
                // Set the database type
                this.databaseType = answers.databaseType;
                // Retrieve database list
                this.collectDatabaseData();
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
            // Set database
            yield inquirer_1.default
                .prompt(this.databaseSelectQuestions)
                .then(answers => {
                // Set the database type
                // Get database key to get database settings
                var keyRegex = /\((.*)\)/i;
                var selectedDatabase = answers.database;
                var databaseKey = selectedDatabase.match(keyRegex)[1];
                // Collects database data based on key
                this.collectDatabaseData(databaseKey);
            })
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
            // Get current folder from cwd
            this.currentFolder = process.cwd();
            // If local folder is set for project, use that as currentFolder
            if (self.databaseData.localProjectFolder && self.databaseData.localProjectFolder.length > 0) {
                this.currentFolder = self.databaseData.localProjectFolder;
            }
            // Set current folder name based on current folder
            this.currentFolderName = path.basename(path.resolve(this.currentFolder));
            // Determine if current folder is possible and check if Magento is available
            if (fs.existsSync(this.currentFolder + '/vendor/magento') || fs.existsSync(this.currentFolder + '/app/Mage.php')) {
                // @ts-ignore
                this.databaseConfigurationQuestions[1].choices = ['yes', ...this.databaseConfigurationQuestions[1].choices];
            }
            yield inquirer_1.default
                .prompt(this.databaseConfigurationQuestions)
                .then((answers) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                console_1.clearConsole();
                // Main tasks list
                const tasks = new listr2_1.Listr([], { concurrent: false });
                this.strip = answers.strip;
                // If option to import database is chosen, set download database folder to current folder.
                if (answers.import && answers.import == 'yes') {
                    this.localDatabaseFolderLocation = this.currentFolder;
                }
                else {
                    tasks.add({
                        title: 'Checking if download folder exists',
                        task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                            // Check if download folder exists
                            if (fs.existsSync(this.localDatabaseFolderLocation)) {
                                return true;
                            }
                            throw new Error(`SSH key ${this.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                        })
                    });
                }
                tasks.add({
                    title: 'Checking if SSH key exists',
                    task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                        // Check if SSH key exists
                        if (fs.existsSync(this.sshKeyLocation)) {
                            return true;
                        }
                        throw new Error(`SSH key ${this.sshKeyLocation} does not exist. This can be configured in config/settings.json`);
                    })
                });
                // Setup all download tasks and add to main list
                tasks.add({
                    title: 'Download database from server ' + '(' + this.databaseData.username + ')',
                    task: (ctx, task) => task.newListr([
                        {
                            title: 'Connecting to server through SSH',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Open connection to SSH server
                                yield this.ssh.connect({
                                    host: this.databaseData.server,
                                    username: this.databaseData.username,
                                    port: this.databaseData.port,
                                    privateKey: this.sshKeyLocation,
                                    passphrase: settings_json_1.default.ssh.passphrase
                                });
                            })
                        },
                        {
                            title: 'Retrieving server settings',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Retrieve settings from server to use
                                yield this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;')).then((result) => {
                                    if (result) {
                                        let serverValues = result.stdout.split("\n");
                                        // Check if Magento 1 or Magento 2
                                        self.serverVariables.magentoVersion = parseInt(serverValues[0]);
                                        // Get Magento root
                                        self.serverVariables.magentoRoot = serverValues[1];
                                        // Get PHP path
                                        self.serverVariables.php = serverValues[2];
                                    }
                                });
                                // Dirty fix for Hipex servers
                                if (this.databaseData.server.includes('hipex')) {
                                    self.serverVariables.php = '~/.bin/php';
                                }
                                // Determine Magerun version based on magento version
                                self.serverVariables.magerunFile = 'n98-magerun2-4.7.0.phar';
                                if (self.serverVariables.magentoVersion == 1) {
                                    self.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                                }
                            })
                        },
                        {
                            title: 'Downloading Magerun to server',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Download Magerun to the server
                                yield this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + self.serverVariables.magerunFile));
                            })
                        },
                        {
                            title: 'Dumping database and moving it to server root (' + this.strip + ')',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Retrieve database name
                                yield this.ssh.execCommand(self.sshMagentoRootFolderMagerunCommand('db:info --format=json')).then((result) => {
                                    if (result) {
                                        // Get json format string and extract database names from values
                                        let jsonResult = JSON.parse(result.stdout);
                                        self.serverVariables.databaseName = jsonResult[1].Value;
                                        if (self.serverVariables.magentoVersion == 1) {
                                            self.serverVariables.databaseName = jsonResult[3].Value;
                                        }
                                    }
                                });
                                // Dump database and move database to root of server
                                var stripCommand = 'db:dump --strip="' + static_settings_json_1.default.settings.databaseStripDevelopment + '"';
                                if (self.strip == 'keep customer data') {
                                    stripCommand = 'db:dump --strip="' + static_settings_json_1.default.settings.databaseStripKeepCustomerData + '"';
                                }
                                else if (self.strip == 'full') {
                                    stripCommand = 'db:dump';
                                }
                                // Dump database and move to user root on server
                                yield this.ssh.execCommand(self.sshMagentoRootFolderMagerunCommand(stripCommand + '; mv ' + self.serverVariables.databaseName + '.sql ~'));
                                // Download Wordpress database
                                if (this.databaseData.wordpress && this.databaseData.wordpress == true) {
                                    yield this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('cd wp; cat wp-config.php')).then((result) => {
                                        if (result) {
                                            let resultValues = result.stdout.split("\n");
                                            resultValues.forEach((entry) => {
                                                // Get DB name from config file
                                                if (entry.includes('DB_NAME')) {
                                                    this.wordpressConfig.database = self.wordpressReplaces(entry, `DB_NAME`);
                                                }
                                                // Get DB user from config file
                                                if (entry.includes('DB_USER')) {
                                                    this.wordpressConfig.username = self.wordpressReplaces(entry, `DB_USER`);
                                                }
                                                // Get DB password from config file
                                                if (entry.includes('DB_PASSWORD')) {
                                                    this.wordpressConfig.password = self.wordpressReplaces(entry, `DB_PASSWORD`);
                                                }
                                                // Get DB host from config file
                                                if (entry.includes('DB_HOST')) {
                                                    this.wordpressConfig.host = self.wordpressReplaces(entry, `DB_HOST`);
                                                }
                                            });
                                        }
                                    });
                                    yield this.ssh.execCommand(self.sshNavigateToMagentoRootCommand(`mysqldump --user='${this.wordpressConfig.username}' --password='${this.wordpressConfig.password}' -h ${this.wordpressConfig.host} ${this.wordpressConfig.database} > ${this.wordpressConfig.database}.sql; mv ${this.wordpressConfig.database}.sql ~`));
                                }
                            })
                        },
                        {
                            title: 'Downloading database to localhost',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Download file and place it on localhost
                                var localDatabaseLocation = self.localDatabaseFolderLocation + '/' + self.serverVariables.databaseName + '.sql';
                                yield this.ssh.getFile(localDatabaseLocation, self.serverVariables.databaseName + '.sql').then(function (Contents) {
                                    self.finalMessages.databaseLocation = localDatabaseLocation;
                                }, function (error) {
                                    throw new Error(error);
                                });
                                if (this.databaseData.wordpress && this.databaseData.wordpress == true) {
                                    var wordpresslocalDatabaseLocation = self.localDatabaseFolderLocation + '/' + this.wordpressConfig.database + '.sql';
                                    yield this.ssh.getFile(wordpresslocalDatabaseLocation, `${this.wordpressConfig.database}.sql`).then(function (Contents) {
                                    }, function (error) {
                                        throw new Error(error);
                                    });
                                }
                            })
                        },
                        {
                            title: 'Cleaning up and closing SSH connection',
                            task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                // Remove the magento database file on the server
                                yield this.ssh.execCommand('rm ' + self.serverVariables.databaseName + '.sql');
                                // Remove Magerun and close connection to SSH
                                yield this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('rm ' + self.serverVariables.magerunFile));
                                // Remove the wordpress database file on the server
                                if (this.databaseData.wordpress && this.databaseData.wordpress == true) {
                                    yield this.ssh.execCommand(`rm ${this.wordpressConfig.database}.sql`);
                                }
                                // Close the SSH connection
                                this.ssh.dispose();
                            })
                        },
                    ]),
                });
                // TODO: Magento 1 compatibility
                // TODO: Import Wordpress file
                if (answers.import && answers.import == 'yes') {
                    // Setup all import tasks and add to main list
                    tasks.add({
                        title: 'Import database to local Magento folder',
                        task: (ctx, task) => task.newListr([
                            {
                                title: 'Checking if config/settings.json is correctly filled',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Lets make sure everything is filled in
                                    if (settings_json_1.default.magentoBackend.adminUsername.length == 0) {
                                        throw new Error('Admin username is missing config/settings.json');
                                    }
                                    if (settings_json_1.default.magentoBackend.adminPassword.length == 0) {
                                        throw new Error('Admin password is missing in config/settings.json');
                                    }
                                    if (settings_json_1.default.general.localDomainExtension.length == 0) {
                                        throw new Error('Local domain extension is missing in config/settings.json');
                                    }
                                    if (settings_json_1.default.general.elasticsearchPort.length == 0) {
                                        throw new Error('ElasticSearch port is missing in config/settings.json');
                                    }
                                })
                            },
                            {
                                title: 'Creating database',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Create a database
                                    yield this.localhostMagentoRootExec('magerun2 db:create');
                                })
                            },
                            {
                                title: 'Importing database',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Import SQL file to database
                                    yield this.localhostMagentoRootExec('magerun2 db:import ' + self.serverVariables.databaseName + '.sql');
                                })
                            },
                            {
                                title: 'Removing SQL file from localhost',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Remove local SQL file
                                    yield this.localhostMagentoRootExec('rm ' + self.serverVariables.databaseName + '.sql');
                                })
                            },
                        ]),
                    });
                    // TODO: Magento 1 compatibility
                    // Configure magento tasks and add to main list
                    tasks.add({
                        title: 'Configure Magento for development usage',
                        task: (ctx, task) => task.newListr([
                            {
                                title: "Replacing URL's and doing some preperation for development",
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    var dbQuery = '';
                                    // Delete queries
                                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';";
                                    // Update queries
                                    var dbQueryUpdate = "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_frontend';", dbQueryUpdate = dbQueryRemove + "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_adminhtml';";
                                    var baseUrl = 'http://' + this.currentFolderName + settings_json_1.default.general.localDomainExtension + '/';
                                    // Insert queries
                                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '0');";
                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;
                                    // Set import domain for final message on completing all tasks
                                    this.finalMessages.importDomain = baseUrl;
                                    yield this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                })
                            },
                            {
                                title: "Configuring ElasticSearch",
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    var dbQuery = '';
                                    // Remove queries
                                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_server_port';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_index_prefix';", dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_server_hostname';";
                                    // Update queries
                                    var dbQueryUpdate = "UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';";
                                    // Insert commands
                                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_port', '" + settings_json_1.default.general.elasticsearchPort + "');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_index_prefix', '" + this.currentFolderName + "_development');", dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_hostname', 'localhost');";
                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;
                                    yield this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                })
                            },
                            {
                                title: 'Creating admin user',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Create a new admin user
                                    yield this.localhostMagentoRootExec(`magerun2 admin:user:create --admin-user=${settings_json_1.default.magentoBackend.adminUsername} --admin-password=${settings_json_1.default.magentoBackend.adminPassword} --admin-email=info@email.com --admin-firstname=Firstname --admin-lastname=Lastname`);
                                })
                            },
                            {
                                title: "Disabling Fishpig's Wordpress module",
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    var dbQuery = '';
                                    // Remove queries
                                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'wordpress/setup/enabled';";
                                    // Insert commands
                                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'wordpress/setup/enabled', '0');";
                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryInsert;
                                    yield this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                })
                            },
                            {
                                title: 'Synchronizing module versions on localhost',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Downgrade module data in database
                                    yield this.localhostMagentoRootExec("magerun2 sys:setup:downgrade-versions");
                                })
                            },
                            {
                                title: 'Removing generated code',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Remove generated code
                                    yield this.localhostMagentoRootExec("rm -rf generated/code");
                                })
                            },
                            {
                                title: 'Reindexing Magento',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Reindex data
                                    yield this.localhostMagentoRootExec(`magerun2 index:reindex`);
                                })
                            },
                            {
                                title: 'Flushing Magento caches',
                                task: () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                                    // Flush the magento caches and import config data
                                    yield this.localhostMagentoRootExec(`magerun2 cache:enable; magerun2 cache:flush; magerun2 app:config:import`);
                                })
                            },
                        ]),
                    });
                }
                // Run all tasks
                try {
                    yield tasks.run();
                    // Show final message when done with all tasks
                    if (this.finalMessages.importDomain.length > 0) {
                        console_1.success(`Magento is successfully imported to localhost. ${this.finalMessages.importDomain} is now available`);
                    }
                    else if (this.finalMessages.databaseLocation.length > 0) {
                        console_1.success(`Downloaded database to: ${this.finalMessages.databaseLocation}`);
                    }
                }
                catch (e) {
                    console.error(e);
                }
            }))
                .catch((err) => {
                console_1.error(`Something went wrong: ${err.message}`);
            });
            return true;
        });
        // Navigate to Magento root folder
        this.sshNavigateToMagentoRootCommand = (command) => {
            // See if external project folder is filled in, otherwise try default path
            if (this.databaseData.externalProjectFolder && this.databaseData.externalProjectFolder.length > 0) {
                return `cd ${this.databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
            }
            else {
                return 'cd domains > /dev/null 2>&1;' +
                    'cd ' + this.databaseData.domainFolder + ' > /dev/null 2>&1;' +
                    'cd application > /dev/null 2>&1;' +
                    'cd public_html > /dev/null 2>&1;' +
                    'cd current > /dev/null 2>&1;' + command;
            }
        };
        // Execute a PHP script in the root of magento
        this.sshMagentoRootFolderPhpCommand = (command) => {
            return this.sshNavigateToMagentoRootCommand(this.serverVariables.php + ' ' + command);
        };
        // Execute a PHP script in the root of magento
        this.sshMagentoRootFolderMagerunCommand = (command) => {
            return this.sshMagentoRootFolderPhpCommand(this.serverVariables.magerunFile + ' ' + command);
        };
        this.localhostMagentoRootExec = (command) => {
            return this.execShellCommand(`cd ${this.currentFolder}; ${command}`);
        };
        // Execute shell command with a Promise
        this.execShellCommand = (cmd) => {
            const exec = require('child_process').exec;
            return new Promise((resolve, reject) => {
                exec(cmd, (error, stdout, stderr) => {
                    if (error) {
                        console.warn(error);
                    }
                    resolve(stdout ? stdout : stderr);
                });
            });
        };
        // Collect all databases | collect single database info
        this.collectDatabaseData = (databaseKey) => {
            // @ts-ignore
            var databases = staging_json_1.default.databases;
            if (this.databaseType == 'production') {
                // @ts-ignore
                databases = production_json_1.default.databases;
            }
            for (let [key, database] of Object.entries(databases)) {
                if (databaseKey == key) {
                    // Collect single database info
                    this.databaseData.username = database.username;
                    this.databaseData.server = database.server;
                    this.databaseData.domainFolder = database.domainFolder;
                    this.databaseData.port = database.port;
                    // @ts-ignore
                    this.databaseData.localProjectFolder = database.localProjectFolder;
                    // @ts-ignore
                    this.databaseData.externalProjectFolder = database.externalProjectFolder;
                    // @ts-ignore
                    this.databaseData.wordpress = database.wordpress;
                }
                else {
                    // Collect all database
                    this.databases.push(`${database.domainFolder} / ${database.username} (${key})`);
                }
            }
        };
        this.wordpressReplaces = (entry, text) => {
            var replacedText = entry.replace(text, ''), replacedText = replacedText.replace(`,`, ''), replacedText = replacedText.replace(`DEFINE`, ''), replacedText = replacedText.replace(`define`, ''), replacedText = replacedText.replace(`(`, ''), replacedText = replacedText.replace(` `, ''), replacedText = replacedText.replace(`;`, ''), replacedText = replacedText.replace(`)`, ''), replacedText = replacedText.replace("'", '').replace(/'/g, '');
            return replacedText.trim();
        };
    }
}
exports.default = MagentoController;
//# sourceMappingURL=magentoController.js.map