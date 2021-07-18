// @ts-ignore
import configFile from '../../config/settings.json'
import {NodeSSH} from 'node-ssh'
import DatabasesModel from "../models/databasesModel";
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { consoleCommand } from '../utils/console';
import { Listr } from 'listr2';
import inquirer from 'inquirer'
inquirer.registerPrompt("search-list", require("../../node_modules/inquirer-search-list"));


class MainController {
    public config = {
        'customConfig': {
            'sshKeyLocation': '',
            'localDatabaseFolderLocation': configFile.general.databaseLocation
        },
        'requirements': {
            'magerun2Version': '4.7.0'
        },
        'serverVariables': {
            'magentoVersion': 2, // Default is Magento 2
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
            'import': false,
            'currentFolderIsMagento': false
        },
        'finalMessages': {
            'magentoDatabaseLocation': '',
            'wordpressDatabaseLocation': '',
            'importDomain': ''
        },
        'databasesList': null
    };
    public list = new Listr(
        [],
        {concurrent: false}
    );
    public ssh = new NodeSSH();
    public databases = new DatabasesModel();

    constructor() {
        this.configureConfig();
    }

    configureConfig = () => {
        // Fetch SSH key location
        if (!this.config.customConfig.sshKeyLocation) {
            this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
         }

        // Check if rsync is installed locally
        let rsyncCheck = consoleCommand('which rsync');
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
        this.config.settings.magentoLocalhostDomainName = this.config.settings.currentFolderName + configFile.general.localDomainExtension;
        if (this.databases.databaseData.localProjectUrl) {
            this.config.settings.magentoLocalhostDomainName = this.databases.databaseData.localProjectUrl;
        }

        if (this.config.settings.import) {
            this.config.customConfig.localDatabaseFolderLocation = this.config.settings.currentFolder;
        }

        // Check if current folder is Magento
        var currentFolderIsMagento = false;
        if (fs.existsSync(this.config.settings.currentFolder + '/vendor/magento') || fs.existsSync(this.config.settings.currentFolder + '/app/Mage.php')) {
            this.config.settings.currentFolderIsMagento = true;
        }
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
        return this.sshNavigateToMagentoRootCommand(this.config.serverVariables.externalPhpPath + ' ' + command);
    }

    // Execute a PHP script in the root of magento
    sshMagentoRootFolderMagerunCommand = (command: string) => {
        return this.sshMagentoRootFolderPhpCommand(this.config.serverVariables.magerunFile + ' ' + command);
    }

    localhostMagentoRootExec = (command: string) => {
        return consoleCommand(`cd ${this.config.settings.currentFolder}; ${command};`);
    }

    localhostRsyncDownloadCommand = (source: string, destination: string) => {
        return consoleCommand(`rsync -avz -e "ssh -p ${this.databases.databaseData.port} -o StrictHostKeyChecking=no" ${this.databases.databaseData.username}@${this.databases.databaseData.server}:${source} ${destination}`)
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

export default MainController