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
            'sshKeyLocation': configFile.ssh.keyLocation,
            'sshPassphrase': configFile.ssh.passphrase,
            'localDatabaseFolderLocation': configFile.general.databaseLocation,
            'localDomainExtension': configFile.general.localDomainExtension
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
            'magentoLocalhostDomainName': '',
            'rsyncInstalled': false,
            'elasticSearchUsed': false,
            'import': 'no',
            'wordpressImport': 'no',
            'currentFolderIsMagento': false
        },
        'finalMessages': {
            'magentoDatabaseLocation': '',
            'wordpressDatabaseLocation': '',
            'importDomain': ''
        },
        'databases': {
            'databasesList': null,
            'databaseType': null,
            'databaseData': null
        },
        'wordpressConfig': {
            'prefix': '',
            'username': '',
            'password': '',
            'host': '',
            'database': ''
        }
    };
    public list = new Listr(
        [],
        {concurrent: false}
    );
    public ssh = new NodeSSH();
    public databases = new DatabasesModel();

    constructor() {
        this.configureConfig().then();
    }

    configureConfig = async () => {
        // Fetch SSH key location
        if (!this.config.customConfig.sshKeyLocation) {
            this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
        }

        // Check if rsync is installed locally
        let rsyncCheck = await consoleCommand('which rsync');
        // @ts-ignore
        if (rsyncCheck.length > 0) {
            this.config.settings.rsyncInstalled = true;
        }

        // Get current folder from cwd
        this.config.settings.currentFolder = process.cwd();

        // Set current folder name based on current folder
        this.config.settings.currentFolderName = path.basename(path.resolve(this.config.settings.currentFolder));

        // Check if current folder is Magento
        if (fs.existsSync(this.config.settings.currentFolder + '/vendor/magento') || fs.existsSync(this.config.settings.currentFolder + '/app/Mage.php')) {
            this.config.settings.currentFolderIsMagento = true;
        }
    }
}

export default MainController