"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
const node_ssh_1 = require("node-ssh");
const databasesModel_1 = tslib_1.__importDefault(require("../models/databasesModel"));
const os = tslib_1.__importStar(require("os"));
const path = tslib_1.__importStar(require("path"));
class MainTasks {
    constructor() {
        this.config = {
            'customConfig': {
                'sshKeyLocation': '',
                'localDatabaseFolderLocation': settings_json_1.default.general.databaseLocation
            },
            'requirements': {
                'magerun2Version': '4.7.0'
            },
            'serverVariables': {
                'magentoVersion': 2,
                'externalPhpPath': '',
                'magentoRoot': '',
                'magerunFile': '',
                'databaseName': ''
            },
            'settings': {
                'currentFolder': '',
                'currentFolderName': '',
                'strip': '',
                'syncImages': false,
                'databaseType': '',
                'magentoLocalhostDomainName': '',
                'rsyncInstalled': false,
                'elasticSearchUsed': false,
                'import': false
            },
            'finalMessages': {
                'magentoDatabaseLocation': '',
                'wordpressDatabaseLocation': '',
                'importDomain': ''
            },
            'databasesList': null
        };
        this.ssh = new node_ssh_1.NodeSSH();
        this.databases = new databasesModel_1.default();
        this.configure = () => {
            // Fetch SSH key location
            if (!this.config.customConfig.sshKeyLocation) {
                this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
            }
            // Check if rsync is installed locally
            let rsyncCheck = this.execShellCommand('which rsync');
            // @ts-ignore
            if (rsyncCheck.length > 0) {
                this.config.settings.rsyncInstalled = true;
            }
            // Get current folder from cwd
            this.config.settings.currentFolder = process.cwd();
            // If local folder is set for project, use that as currentFolder
            if (this.databases.databaseData.localProjectFolder && this.databases.databaseData.localProjectFolder.length > 0) {
                this.config.settings.currentFolder = this.databases.databaseData.localProjectFolder;
            }
            // Set current folder name based on current folder
            this.config.settings.currentFolderName = path.basename(path.resolve(this.config.settings.currentFolder));
            // Check if database config has custom localhost domain URL
            this.config.settings.magentoLocalhostDomainName = this.config.settings.currentFolderName + settings_json_1.default.general.localDomainExtension;
            if (this.databases.databaseData.localProjectUrl) {
                this.config.settings.magentoLocalhostDomainName = this.databases.databaseData.localProjectUrl;
            }
            if (this.config.settings.import) {
                this.config.customConfig.localDatabaseFolderLocation = this.config.settings.currentFolder;
            }
        };
        // Navigate to Magento root folder
        this.sshNavigateToMagentoRootCommand = (command) => {
            // See if external project folder is filled in, otherwise try default path
            if (this.databases.databaseData.externalProjectFolder && this.databases.databaseData.externalProjectFolder.length > 0) {
                return `cd ${this.databases.databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
            }
            else {
                return 'cd domains > /dev/null 2>&1;' +
                    'cd ' + this.databases.databaseData.domainFolder + ' > /dev/null 2>&1;' +
                    'cd application > /dev/null 2>&1;' +
                    'cd public_html > /dev/null 2>&1;' +
                    'cd current > /dev/null 2>&1;' + command;
            }
        };
        // Execute a PHP script in the root of magento
        this.sshMagentoRootFolderPhpCommand = (command) => {
            return this.sshNavigateToMagentoRootCommand(this.config.serverVariables.externalPhpPath + ' ' + command);
        };
        // Execute a PHP script in the root of magento
        this.sshMagentoRootFolderMagerunCommand = (command) => {
            return this.sshMagentoRootFolderPhpCommand(this.config.serverVariables.magerunFile + ' ' + command);
        };
        this.localhostMagentoRootExec = (command) => {
            return this.execShellCommand(`cd ${this.config.settings.currentFolder}; ${command};`);
        };
        this.localhostRsyncDownloadCommand = (source, destination) => {
            return this.execShellCommand(`rsync -avz -e "ssh -p ${this.databases.databaseData.port} -o StrictHostKeyChecking=no" ${this.databases.databaseData.username}@${this.databases.databaseData.server}:${source} ${destination}`);
        };
        // Execute shell command with a Promise
        this.execShellCommand = (cmd) => {
            const exec = require('child_process').exec;
            return new Promise((resolve, reject) => {
                exec(cmd, (error, stdout, stderr) => {
                    resolve(stdout ? stdout : stderr);
                });
            });
        };
        this.wordpressReplaces = (entry, text) => {
            var replacedText = entry.replace(text, ''), replacedText = replacedText.replace(`,`, ''), replacedText = replacedText.replace(`DEFINE`, ''), replacedText = replacedText.replace(`define`, ''), replacedText = replacedText.replace(`(`, ''), replacedText = replacedText.replace(` `, ''), replacedText = replacedText.replace(`;`, ''), replacedText = replacedText.replace(`$`, ''), replacedText = replacedText.replace(`)`, ''), replacedText = replacedText.replace(`=`, ''), replacedText = replacedText.replace("'", '').replace(/'/g, '');
            return replacedText.trim();
        };
        this.configure();
    }
}
exports.default = MainTasks;
//# sourceMappingURL=mainTasks.js.map