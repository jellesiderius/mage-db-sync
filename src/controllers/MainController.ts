import {NodeSSH} from 'node-ssh'
import DatabasesModel from "../models/DatabasesModel";
import * as os from 'os'
import * as path from 'path'
import { Listr } from 'listr2';
import CommandExists from 'command-exists';
import { ServiceContainer } from '../core/ServiceContainer';
// inquirer is registered in SelectDatabaseQuestion


class MainController {
    public config: any;
    protected services: ServiceContainer;
    public list = new Listr(
        [],
        {
            concurrent: false,
            exitOnError: true,
            rendererOptions: {
                collapseErrors: false
            }
        }
    );
    public ssh = new NodeSSH();
    public sshSecondDatabase = new NodeSSH();
    public databases = new DatabasesModel();

    constructor() {
        this.services = ServiceContainer.getInstance();
        const configService = this.services.getConfig();
        const settingsConfig = configService.getSettingsConfig();
        
        this.config = {
            'customConfig': {
                'sshKeyLocation': settingsConfig.ssh.keyLocation,
                'sshPassphrase': settingsConfig.ssh.passphrase,
                'localDatabaseFolderLocation': settingsConfig.general.databaseLocation,
                'localDomainExtension': settingsConfig.general.localDomainExtension
            },
            'requirements': {
            'magerun2Version': '7.4.0'
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
            'syncImageTypes': null as string[] | null,
            'syncTypes': null as string[] | null
        },
        'finalMessages': {
            'magentoDatabaseLocation': '',
            'magentoDatabaseIncludeLocation': '',
            'wordpressDatabaseLocation': '',
            'importDomain': '',
            'domains': [],
            'wordpressBlogUrls': []
        },
        'databases': {
            'databasesList': null as any,
            'databaseType': null as string | null,
            'databaseData': null as any
        },
        'wordpressConfig': {
            'prefix': '',
            'username': '',
            'password': '',
            'host': '',
            'database': ''
        }
        };
    }

    init() {
        this.configureConfig().then();
    }

    configureConfig = async () => {
        // Fetch SSH key location, if non configured
        if (!this.config.customConfig.sshKeyLocation) {
            this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
        }

        // Check if rsync is installed locally
        await CommandExists('rsync')
            .then(() =>{
                this.config.settings.rsyncInstalled = true;
            }).catch(function(){});

        // Get current folder from cwd
        this.config.settings.currentFolder = process.cwd();

        // Set current folder name based on current folder
        this.config.settings.currentFolderName = path.basename(path.resolve(this.config.settings.currentFolder));
    }
}

export default MainController
