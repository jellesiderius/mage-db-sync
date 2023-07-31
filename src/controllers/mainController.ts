// @ts-ignore
import configFile from '../../config/settings.json'
import {NodeSSH} from 'node-ssh'
import DatabasesModel from "../models/databasesModel";
import * as os from 'os'
import * as path from 'path'
import { Listr } from 'listr2';
import CommandExists from 'command-exists';
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
            'magerun2Version': '5.2.0'
        },
        'serverVariables': {
            'magentoVersion': 2,
            'externalPhpPath': '',
            'magentoRoot': '',
            'magerunFile': '',
            'databaseName': '',
            'secondDatabaseMagerun2': 'magerun2',
            'secondDatabaseExternalPhpPath': ''
        },
        'settings': {
            'currentFolder': '',
            'currentFolderName': '',
            'strip': '',
            'syncImages': 'no',
            'magentoLocalhostDomainName': '',
            'rsyncInstalled': false,
            'elasticSearchUsed': false,
            'isDdevProject': false,
            'isDdevActive': false,
            'import': 'no',
            'wordpressImport': 'no',
            'wordpressDownload': 'no',
            'currentFolderIsMagento': false,
            'currentFolderhasWordpress': false,
            'runCommands': false,
            'magerun2Command': '',
            'magerun2CommandLocal': 'magerun2',
            'wpCommandLocal': 'wp',
            'databaseCommand': '',
            'syncDatabases': 'no',
            'syncImageTypes': null,
            'syncTypes': null
        },
        'finalMessages': {
            'magentoDatabaseLocation': '',
            'magentoDatabaseIncludeLocation': '',
            'wordpressDatabaseLocation': '',
            'importDomain': ''
        },
        'databases': {
            'databasesList': null,
            'databaseType': null,
            'databaseData': null,
            'databaseDataSecond': null
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
    public sshSecondDatabase = new NodeSSH();
    public databases = new DatabasesModel(this.config);

    constructor() {
        this.configureConfig().then();
    }

    configureConfig = async () => {
        // Fetch SSH key location, if non configured
        if (!this.config.customConfig.sshKeyLocation) {
            this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
        }

        // Check if rsync is installed locally
        await CommandExists('rsync')
            .then((command) =>{
                this.config.settings.rsyncInstalled = true;
            }).catch(function(){});

        // Get current folder from cwd
        this.config.settings.currentFolder = process.cwd();

        // Set current folder name based on current folder
        this.config.settings.currentFolderName = path.basename(path.resolve(this.config.settings.currentFolder));
    }
}

export default MainController
