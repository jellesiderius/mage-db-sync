import {clearConsole, error, success} from '../utils/console'
import inquirer from 'inquirer'
import {Listr} from 'listr2'
// @ts-ignore
import configFile from '../../config/settings.json'
// @ts-ignore
import staticConfigFile from '../../config/static-settings.json'
import {NodeSSH} from 'node-ssh'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import {ExecException} from "child_process"
import DatabasesModel from "../models/databasesModel";

inquirer.registerPrompt("search-list", require("../../node_modules/inquirer-search-list"));

class ImportController {
    private serverVariables = {
        'magentoVersion': 2, // Default is 2
        'externalPhpPath': '',
        'magentoRoot': '',
        'magerunFile': '',
        'databaseName': ''
    };
    private sshKeyLocation = '';
    private localDatabaseFolderLocation = configFile.general.databaseLocation
    private ssh = new NodeSSH();
    private databases = new DatabasesModel();
    private databaseType = '';
    private syncImages = false;
    private strip = '';
    private finalMessages = {
        'magentoDatabaseLocation': '',
        'wordpressDatabaseLocation': '',
        'importDomain': ''
    };
    private currentFolder = '';
    private currentFolderName = '';
    private wordpressConfig = {
        'prefix': '',
        'username': '',
        'password': '',
        'host': '',
        'database': ''
    };
    private magerun2Version = '4.7.0';
    private magentoLocalhostDomainName = '';
    private rsyncInstalled = false;

    private readonly databaseTypeQuestions = [
        {
            type: 'list',
            name: 'databaseType',
            message: 'Set database type',
            default: 'staging',
            choices: ['staging', 'production'],
            validate: (input: string) => {
                return input !== ''
            }
        }
    ]

    private readonly databaseSelectQuestions = [
        {
            type: 'search-list',
            name: 'database',
            message: 'Select or search database',
            choices: this.databases.databasesList,
            validate: (input: string) => {
                return input !== ''
            }
        }
    ]

    private readonly databaseConfigurationQuestions = [
        {
            type: 'list',
            name: 'strip',
            default: 'stripped',
            message: 'Does the database need to be stripped for development?',
            choices: ['stripped', 'keep customer data', 'full'],
            validate: (input: string) => {
                return input !== ''
            }
        }
    ]

    private databaseConfigurationAnswers: { [k: string]: any } = {};

    private readonly synchronizeImagesQuestions = [
        {
            type: 'list',
            name: 'syncImages',
            default: 'yes',
            message: 'Do you want to synchronize images?',
            choices: ['yes', 'no',],
            validate: (input: string) => {
                return input !== ''
            }
        }
    ]

    // Starts the controller
    executeStart = async (serviceName: string | undefined): Promise<boolean> => {
        var self = this;

        clearConsole();

        // Fetch SSH key location
        this.sshKeyLocation = configFile.ssh.keyLocation;
        if (!this.sshKeyLocation) {
            this.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
        }

        // Check if rsync is installed locally
        let rsyncCheck = await this.execShellCommand('which rsync');
        // @ts-ignore
        if (rsyncCheck.length > 0) {
            this.rsyncInstalled = true;
        }

        // Set database type
        await inquirer
            .prompt(this.databaseTypeQuestions)
            .then(answers => {
                // Set the database type
                this.databaseType = answers.databaseType;
                // Collect databases
                this.databases.collectDatabaseData('', this.databaseType);
            })
            .catch((err) => {
                error(`Something went wrong: ${err.message}`)
            });

        // Set database
        await inquirer
            .prompt(this.databaseSelectQuestions)
            .then(answers => {
                // Set the database type
                // Get database key to get database settings
                var keyRegex = /\((.*)\)/i;
                var selectedDatabase = answers.database;
                var databaseKey = selectedDatabase.match(keyRegex)[1];

                // Collects database data based on key
                this.databases.collectDatabaseData(databaseKey, this.databaseType);
            })
            .catch((err) => {
                error(`Something went wrong: ${err.message}`)
            });

        // Get current folder from cwd
        this.currentFolder = process.cwd();

        // If local folder is set for project, use that as currentFolder
        if (this.databases.databaseData.localProjectFolder && this.databases.databaseData.localProjectFolder.length > 0) {
            this.currentFolder = this.databases.databaseData.localProjectFolder;
        }

        // Set current folder name based on current folder
        this.currentFolderName = path.basename(path.resolve(this.currentFolder));

        this.magentoLocalhostDomainName = this.currentFolderName + configFile.general.localDomainExtension

        // Check if current folder is Magento
        var currentFolderIsMagento = false;
        if (fs.existsSync(this.currentFolder + '/vendor/magento') || fs.existsSync(this.currentFolder + '/app/Mage.php')) {
            currentFolderIsMagento = true;
        }

        // Determine if current folder is possible and check if Magento is available
        if (currentFolderIsMagento) {
            // Add import options
            // @ts-ignore
            this.databaseConfigurationQuestions.push(
                {
                    type: 'list',
                    name: 'import',
                    default: 'yes',
                    message: 'Import Magento database?',
                    choices: ['yes', 'no'],
                    validate: (input: string) => {
                        return false;
                    },
                }
            )

            if (this.databases.databaseData.wordpress && this.databases.databaseData.wordpress == true) {
                // Add wordpress download and import option if server config has it
                this.databaseConfigurationQuestions.push(
                    {
                        type: 'list',
                        name: 'wordpressImport',
                        default: 'yes',
                        message: 'Import Wordpress database?',
                        choices: ['yes', 'no'],
                        validate: (input: string) => {
                            return false;
                        },
                    }
                );
            }
        }

        await inquirer
            .prompt(this.databaseConfigurationQuestions)
            .then(async answers => {
                this.databaseConfigurationAnswers = answers;
            })
            .catch((err) => {
                error(`Something went wrong: ${err.message}`)
            });

        if (this.databaseConfigurationAnswers.import && this.databaseConfigurationAnswers.import == 'yes') {
            await inquirer
                .prompt(this.synchronizeImagesQuestions)
                .then(answers => {
                    this.syncImages = answers.syncImages;
                })
                .catch((err) => {
                    error(`Something went wrong: ${err.message}`)
                });
        }

        // Main tasks list
        const tasks = new Listr(
            [],
            {concurrent: false}
        );

        this.strip = this.databaseConfigurationAnswers.strip;

        // If option to import database is chosen, set download database folder to current folder.
        if (this.databaseConfigurationAnswers.import && this.databaseConfigurationAnswers.import == 'yes') {
            this.localDatabaseFolderLocation = this.currentFolder;

            tasks.add(
                {
                    title: 'Checking Magerun2 version',
                    task: async (): Promise<Boolean> => {
                        // Check the local installed Magerun2 version before we continue and import the database
                        var installedMagerun2Version = await this.execShellCommand('magerun2 -V');
                        // @ts-ignore
                        installedMagerun2Version = installedMagerun2Version.split(' ')[1];
                        // @ts-ignore
                        if (installedMagerun2Version < this.magerun2Version) {
                            throw new Error(`Your current Magerun2 version is too low. Magerun version ${this.magerun2Version} is required`);
                        }

                        return true;
                    }
                }
            );
        } else {
            tasks.add(
                {
                    title: 'Checking if download folder exists',
                    task: async (): Promise<Boolean> => {
                        // Check if download folder exists
                        if (fs.existsSync(this.localDatabaseFolderLocation)) {
                            return true;
                        }

                        throw new Error(`SSH key ${this.localDatabaseFolderLocation} does not exist. This can be configured in config/settings.json`);
                    }
                },
            );
        }

        // Check if SSH key exists
        tasks.add(
            {
                title: 'Checking if SSH key exists',
                task: async (): Promise<Boolean> => {
                    if (fs.existsSync(this.sshKeyLocation)) {
                        return true;
                    }

                    throw new Error(`SSH key ${this.sshKeyLocation} does not exist. This can be configured in config/settings.json`);
                }
            }
        );

        // Setup all download tasks and add to main list
        tasks.add(
            {
                title: 'Download database from server ' + '(' + this.databases.databaseData.username + ')',
                task: (ctx, task): Listr =>
                    task.newListr([
                        {
                            title: 'Connecting to server through SSH',
                            task: async (): Promise<void> => {
                                // Open connection to SSH server
                                await this.ssh.connect({
                                    host: this.databases.databaseData.server,
                                    password: this.databases.databaseData.password,
                                    username: this.databases.databaseData.username,
                                    port: this.databases.databaseData.port,
                                    privateKey: this.sshKeyLocation,
                                    passphrase: configFile.ssh.passphrase
                                });
                            }
                        },
                        {
                            title: 'Retrieving server settings',
                            task: async (): Promise<void> => {
                                // Retrieve settings from server to use
                                await this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('test -e vendor/magento && echo 2 || echo 1; pwd; which php;')).then((result) => {
                                    if (result) {
                                        let serverValues = result.stdout.split("\n");
                                        // Check if Magento 1 or Magento 2
                                        self.serverVariables.magentoVersion = parseInt(serverValues[0]);
                                        // Get Magento root
                                        self.serverVariables.magentoRoot = serverValues[1];
                                        // Get PHP path
                                        self.serverVariables.externalPhpPath = serverValues[2];
                                    }
                                });

                                // Use custom PHP path instead if given
                                if (this.databases.databaseData.externalPhpPath && this.databases.databaseData.externalPhpPath.length > 0) {
                                    self.serverVariables.externalPhpPath = this.databases.databaseData.externalPhpPath;
                                }

                                // Determine Magerun version based on magento version
                                self.serverVariables.magerunFile = `n98-magerun2-${this.magerun2Version}.phar`;

                                if (self.serverVariables.magentoVersion == 1) {
                                    self.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                                }
                            }
                        },
                        {
                            title: 'Downloading Magerun to server',
                            task: async (): Promise<void> => {
                                // Download Magerun to the server
                                await this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('curl -O https://files.magerun.net/' + self.serverVariables.magerunFile));
                            }
                        },
                        {
                            title: 'Dumping database and moving it to server root (' + this.strip + ')',
                            task: async (): Promise<void> => {
                                // Retrieve database name
                                await this.ssh.execCommand(self.sshMagentoRootFolderMagerunCommand('db:info --format=json')).then((result) => {
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
                                var stripCommand = 'db:dump --strip="' + staticConfigFile.settings.databaseStripDevelopment + '"';

                                if (self.strip == 'keep customer data') {
                                    stripCommand = 'db:dump --strip="' + staticConfigFile.settings.databaseStripKeepCustomerData + '"';
                                } else if (self.strip == 'full') {
                                    stripCommand = 'db:dump'
                                }

                                // Dump database and move to user root on server
                                await this.ssh.execCommand(self.sshMagentoRootFolderMagerunCommand(stripCommand + '; mv ' + self.serverVariables.databaseName + '.sql ~')).then(function (Contents) {
                                }, function (error) {
                                    throw new Error(error)
                                });;

                                // Download Wordpress database
                                if (this.databases.databaseData.wordpress && this.databases.databaseData.wordpress == true) {
                                    await this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('cd wp; cat wp-config.php')).then((result) => {
                                        if (result) {
                                            let resultValues = result.stdout.split("\n");

                                            resultValues.forEach((entry) => {
                                                // Get DB name from config file
                                                if (entry.includes('DB_NAME')) {
                                                    this.wordpressConfig.database = self.wordpressReplaces(entry, `DB_NAME`)
                                                }

                                                // Get DB user from config file
                                                if (entry.includes('DB_USER')) {
                                                    this.wordpressConfig.username = self.wordpressReplaces(entry, `DB_USER`)
                                                }

                                                // Get DB password from config file
                                                if (entry.includes('DB_PASSWORD')) {
                                                    this.wordpressConfig.password = self.wordpressReplaces(entry, `DB_PASSWORD`)
                                                }

                                                // Get DB host from config file
                                                if (entry.includes('DB_HOST')) {
                                                    this.wordpressConfig.host = self.wordpressReplaces(entry, `DB_HOST`)
                                                }

                                                // Get table prefix from config file
                                                if (entry.includes('table_prefix')) {
                                                    this.wordpressConfig.prefix = self.wordpressReplaces(entry, `table_prefix`)
                                                }
                                            });
                                        }
                                    });

                                    await this.ssh.execCommand(self.sshNavigateToMagentoRootCommand(`mysqldump --user='${this.wordpressConfig.username}' --password='${this.wordpressConfig.password}' -h ${this.wordpressConfig.host} ${this.wordpressConfig.database} > ${this.wordpressConfig.database}.sql; mv ${this.wordpressConfig.database}.sql ~`));
                                }
                            }
                        },
                        {
                            title: 'Downloading database to localhost',
                            task: async (): Promise<void> => {
                                // Download file and place it on localhost
                                var localDatabaseLocation = self.localDatabaseFolderLocation + '/' + self.serverVariables.databaseName + '.sql';

                                if (this.rsyncInstalled) {
                                    await this.localhostRsyncDownloadCommand(`~/${this.serverVariables.databaseName}.sql`, `${self.localDatabaseFolderLocation}`);
                                } else {
                                    await this.ssh.getFile(localDatabaseLocation, self.serverVariables.databaseName + '.sql').then(function (Contents) {
                                    }, function (error) {
                                        throw new Error(error)
                                    });
                                }

                                // Set final message with Magento DB location
                                self.finalMessages.magentoDatabaseLocation = localDatabaseLocation;

                                if (this.databases.databaseData.wordpress && this.databases.databaseData.wordpress == true) {
                                    var wordpresslocalDatabaseLocation = self.localDatabaseFolderLocation + '/' + this.wordpressConfig.database + '.sql';

                                    if (this.rsyncInstalled) {
                                        await this.localhostRsyncDownloadCommand(`~/${this.wordpressConfig.database}.sql`, `${self.localDatabaseFolderLocation}`);
                                    } else {
                                        await this.ssh.getFile(wordpresslocalDatabaseLocation, `${this.wordpressConfig.database}.sql`).then(function (Contents) {
                                        }, function (error) {
                                            throw new Error(error)
                                        });
                                    }

                                    // Set final message with Wordpress database location
                                    self.finalMessages.wordpressDatabaseLocation = wordpresslocalDatabaseLocation;
                                }
                            }
                        },
                        {
                            title: 'Cleaning up and closing SSH connection',
                            task: async (): Promise<void> => {
                                // Remove the magento database file on the server
                                await this.ssh.execCommand('rm ' + self.serverVariables.databaseName + '.sql');

                                // Remove Magerun and close connection to SSH
                                await this.ssh.execCommand(self.sshNavigateToMagentoRootCommand('rm ' + self.serverVariables.magerunFile));

                                // Remove the wordpress database file on the server
                                if (this.databases.databaseData.wordpress && this.databases.databaseData.wordpress == true) {
                                    await this.ssh.execCommand(`rm ${this.wordpressConfig.database}.sql`);
                                }

                                // Close the SSH connection
                                this.ssh.dispose();
                            }
                        },
                    ]),
            }
        );

        if (this.databaseConfigurationAnswers.import && this.databaseConfigurationAnswers.import == 'yes') {
            // Setup all import tasks and add to main list
            tasks.add(
                {
                    title: 'Import Magento database to localhost',
                    task: (ctx, task): Listr =>
                        task.newListr([
                            {
                                title: 'Checking if config/settings.json is correctly filled',
                                task: async (): Promise<void> => {
                                    // Lets make sure everything is filled in
                                    if (configFile.magentoBackend.adminUsername.length == 0) {
                                        throw new Error('Admin username is missing config/settings.json');
                                    }

                                    if (configFile.magentoBackend.adminPassword.length == 0) {
                                        throw new Error('Admin password is missing in config/settings.json');
                                    }

                                    if (configFile.general.localDomainExtension.length == 0) {
                                        throw new Error('Local domain extension is missing in config/settings.json');
                                    }

                                    if (configFile.general.elasticsearchPort.length == 0) {
                                        throw new Error('ElasticSearch port is missing in config/settings.json');
                                    }
                                }
                            },
                            {
                                title: 'Creating database',
                                task: async (): Promise<void> => {
                                    // Create a database
                                    await this.localhostMagentoRootExec('magerun2 db:create');
                                }
                            },
                            {
                                title: 'Importing database',
                                task: async (): Promise<void> => {
                                    // Import SQL file to database
                                    await this.localhostMagentoRootExec('magerun2 db:import ' + self.serverVariables.databaseName + '.sql');
                                }
                            },
                            {
                                title: 'Cleaning up',
                                task: async (): Promise<void> => {
                                    // Remove local SQL file
                                    await this.localhostMagentoRootExec('rm ' + self.serverVariables.databaseName + '.sql');
                                }
                            },
                        ]),
                }
            );

            // Configure magento tasks and add to main list
            tasks.add(
                {
                    title: 'Configure Magento for development usage',
                    task: (ctx, task): Listr =>
                        task.newListr([
                            {
                                title: "Replacing URL's and doing some preperation for development",
                                task: async (): Promise<void> => {
                                    var dbQuery = '';
                                    // Delete queries
                                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'web/cookie/cookie_domain';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'dev/static/sign';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'admin/url/use_custom_path';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_static_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_media_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_link_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/unsecure/base_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_static_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_media_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_link_url';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'web/secure/base_url';";

                                    // Update queries
                                    var dbQueryUpdate = "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_frontend';",
                                        dbQueryUpdate = dbQueryRemove + "UPDATE core_config_data SET value = '0' WHERE path = 'web/secure/use_in_adminhtml';"

                                    var baseUrl = 'http://' + this.magentoLocalhostDomainName + '/';

                                    // Insert queries
                                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_static_url', '{{unsecure_base_url}}static/');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_media_url', '{{unsecure_base_url}}media/');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_link_url', '{{unsecure_base_url}}');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_static_url', '{{secure_base_url}}static/');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_media_url', '{{secure_base_url}}media/');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_link_url', '{{secure_base_url}}');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/unsecure/base_url', '" + baseUrl + "');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'web/secure/base_url', '" + baseUrl + "');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'dev/static/sign', '0');";

                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;

                                    // Set import domain for final message on completing all tasks
                                    this.finalMessages.importDomain = baseUrl;

                                    await this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                }
                            },
                            {
                                title: "Configuring ElasticSearch",
                                task: async (): Promise<void> => {
                                    var dbQuery = '';
                                    // Remove queries
                                    var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_server_port';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_index_prefix';",
                                        dbQueryRemove = dbQueryRemove + "DELETE FROM core_config_data WHERE path LIKE 'catalog/search/elasticsearch7_server_hostname';";

                                    // Update queries
                                    var dbQueryUpdate = "UPDATE core_config_data SET value = 'elasticsearch7' WHERE path = 'catalog/search/engine';";

                                    // Insert commands
                                    var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_port', '" + configFile.general.elasticsearchPort + "');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_index_prefix', '" + this.currentFolderName + "_development');",
                                        dbQueryInsert = dbQueryInsert + "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'catalog/search/elasticsearch7_server_hostname', 'localhost');";

                                    // Build up query
                                    dbQuery = dbQuery + dbQueryRemove + dbQueryUpdate + dbQueryInsert;

                                    await this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                }
                            },
                            {
                                title: 'Creating admin user',
                                task: async (): Promise<void> => {
                                    // Create a new admin user
                                    await this.localhostMagentoRootExec(`magerun2 admin:user:create --admin-user=${configFile.magentoBackend.adminUsername} --admin-password=${configFile.magentoBackend.adminPassword} --admin-email=info@email.com --admin-firstname=Firstname --admin-lastname=Lastname`);
                                }
                            },
                            {
                                title: "Configuring Fishpig's Wordpress module",
                                task: async (): Promise<void> => {
                                    // If wordpress is imported, we do nothing
                                    if (this.databaseConfigurationAnswers.wordpressImport && this.databaseConfigurationAnswers.wordpressImport == 'yes') {
                                        return;
                                    } else {
                                        var dbQuery = '';
                                        // Remove queries
                                        var dbQueryRemove = "DELETE FROM core_config_data WHERE path LIKE 'wordpress/setup/enabled';";

                                        // Insert commands
                                        var dbQueryInsert = "INSERT INTO core_config_data (scope, scope_id, path, value) VALUES ('default', '0', 'wordpress/setup/enabled', '0');";

                                        // Build up query
                                        dbQuery = dbQuery + dbQueryRemove + dbQueryInsert;

                                        await this.localhostMagentoRootExec('magerun2 db:query "' + dbQuery + '"');
                                    }
                                }
                            },
                            {
                                title: 'Synchronizing module versions on localhost',
                                task: async (): Promise<void> => {
                                    // Downgrade module data in database
                                    await this.localhostMagentoRootExec("magerun2 sys:setup:downgrade-versions");
                                }
                            },
                            {
                                title: 'Removing generated code',
                                task: async (): Promise<void> => {
                                    // Remove generated code
                                    await this.localhostMagentoRootExec("rm -rf generated/code");
                                }
                            },
                            {
                                title: 'Reindexing Magento',
                                task: async (): Promise<void> => {
                                    // Reindex data
                                    await this.localhostMagentoRootExec(`magerun2 index:reindex`);
                                }
                            },
                            {
                                title: 'Flushing Magento caches',
                                task: async (): Promise<void> => {
                                    // Flush the magento caches and import config data
                                    await this.localhostMagentoRootExec(`magerun2 cache:enable; magerun2 cache:flush; magerun2 app:config:import`);
                                }
                            },
                        ]),
                }
            )
        }

        if (this.databaseConfigurationAnswers.wordpressImport && this.databaseConfigurationAnswers.wordpressImport == 'yes') {
            // Setup all import tasks and add to main list
            tasks.add(
                {
                    title: 'Import Wordpress database to localhost',
                    task: (ctx, task): Listr =>
                        task.newListr([
                            {
                                title: 'Importing database',
                                task: async (): Promise<void> => {
                                    // Import SQL file to database
                                    await this.localhostMagentoRootExec(`mv ${this.wordpressConfig.database}.sql wp; cd wp; wp db import ${this.wordpressConfig.database}.sql`);
                                }
                            },
                            {
                                title: 'Configuring for development',
                                task: async (): Promise<void> => {
                                    // Retrieve current site URL from database
                                    var wordpressUrl = await this.localhostMagentoRootExec(`cd wp; wp db query "SELECT option_value FROM ${self.wordpressConfig.prefix}options WHERE option_name = 'siteurl'"`);
                                    // @ts-ignore
                                    wordpressUrl = this.wordpressReplaces(wordpressUrl.replace('option_value', '').trim(), 'https://').split('/')[0];
                                    // Replace options for localhost
                                    await this.localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${self.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'${wordpressUrl}', '${this.magentoLocalhostDomainName}');"`);
                                    await this.localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${self.wordpressConfig.prefix}options SET option_value = REPLACE(option_value,'https://', 'http://');"`);
                                    // Replace blogs for localhost
                                    await this.localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${self.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'${wordpressUrl}', '${this.magentoLocalhostDomainName}');"`);
                                    await this.localhostMagentoRootExec(`cd wp; wp db query "UPDATE ${self.wordpressConfig.prefix}blogs SET domain = REPLACE(domain,'https://', 'http://');"`);
                                }
                            },
                            {
                                title: 'Cleaning up',
                                task: async (): Promise<void> => {
                                    // Remove wordpress database from localhost
                                    await this.localhostMagentoRootExec(`cd wp; rm ${this.wordpressConfig.database}.sql`);
                                }
                            },
                        ]),
                }
            );
        }

        // Run all tasks
        try {
            await tasks.run();

            // Show final message when done with all tasks
            if (this.finalMessages.importDomain.length > 0) {
                success(`Magento is successfully imported to localhost. ${this.finalMessages.importDomain} is now available`);
            } else if (this.finalMessages.magentoDatabaseLocation.length > 0) {
                success(`Downloaded Magento database to: ${this.finalMessages.magentoDatabaseLocation}`);
                // Show wordpress download message if downloaded
                if (this.finalMessages.wordpressDatabaseLocation.length > 0) {
                    success(`Downloaded Wordpress database to: ${this.finalMessages.wordpressDatabaseLocation}`);
                }
            }

            // Show wordpress import message if imported
            if (this.databaseConfigurationAnswers.wordpressImport && this.databaseConfigurationAnswers.wordpressImport == 'yes') {
                success(`Wordpress is successfully imported to localhost.`);
            }
        } catch (e) {
            console.error(e)
        }

        return true;
    }

    // Navigate to Magento root folder
    sshNavigateToMagentoRootCommand = (command: string) => {
        // See if external project folder is filled in, otherwise try default path
        if (this.databases.databaseData.externalProjectFolder && this.databases.databaseData.externalProjectFolder.length > 0) {
            return `cd ${this.databases.databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
        } else {
            return 'cd domains > /dev/null 2>&1;' +
                'cd ' + this.databases.databaseData.domainFolder + ' > /dev/null 2>&1;' +
                'cd application > /dev/null 2>&1;' +
                'cd public_html > /dev/null 2>&1;' +
                'cd current > /dev/null 2>&1;' + command;
        }
    }

    // Execute a PHP script in the root of magento
    sshMagentoRootFolderPhpCommand = (command: string) => {
        return this.sshNavigateToMagentoRootCommand(this.serverVariables.externalPhpPath + ' ' + command);
    }

    // Execute a PHP script in the root of magento
    sshMagentoRootFolderMagerunCommand = (command: string) => {
        return this.sshMagentoRootFolderPhpCommand(this.serverVariables.magerunFile + ' ' + command);
    }

    localhostMagentoRootExec = (command: string) => {
        return this.execShellCommand(`cd ${this.currentFolder}; ${command};`);
    }

    localhostRsyncDownloadCommand = (source: string, destination: string) => {
        return this.execShellCommand(`rsync -avz -e "ssh -p ${this.databases.databaseData.port}" ${this.databases.databaseData.username}@${this.databases.databaseData.server}:${source} ${destination}`)
    }

    // Execute shell command with a Promise
    execShellCommand = (cmd: string) => {
        const exec = require('child_process').exec;
        return new Promise((resolve, reject) => {
            exec(cmd, (error: ExecException | null, stdout: string, stderr: string) => {
                resolve(stdout ? stdout : stderr);
            });
        });
    }

    wordpressReplaces = (entry: string, text: string) => {
        var replacedText = entry.replace(text, ''),
            replacedText = replacedText.replace(`,`, ''),
            replacedText = replacedText.replace(`DEFINE`, ''),
            replacedText = replacedText.replace(`define`, ''),
            replacedText = replacedText.replace(`(`, ''),
            replacedText = replacedText.replace(` `, ''),
            replacedText = replacedText.replace(`;`, ''),
            replacedText = replacedText.replace(`$`, ''),
            replacedText = replacedText.replace(`)`, ''),
            replacedText = replacedText.replace(`=`, ''),
            replacedText = replacedText.replace("'", '').replace(/'/g,'');

        return replacedText.trim();
    }
}

export default ImportController