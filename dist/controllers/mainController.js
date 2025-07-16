"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const settings_json_1 = (0, tslib_1.__importDefault)(require("../../config/settings.json"));
const node_ssh_1 = require("node-ssh");
const databasesModel_1 = (0, tslib_1.__importDefault)(require("../models/databasesModel"));
const os = (0, tslib_1.__importStar)(require("os"));
const path = (0, tslib_1.__importStar)(require("path"));
const listr2_1 = require("listr2");
const command_exists_1 = (0, tslib_1.__importDefault)(require("command-exists"));
const inquirer_1 = (0, tslib_1.__importDefault)(require("inquirer"));
inquirer_1.default.registerPrompt("search-list", require("../../node_modules/inquirer-search-list"));
class MainController {
    constructor() {
        this.config = {
            'customConfig': {
                'sshKeyLocation': settings_json_1.default.ssh.keyLocation,
                'sshPassphrase': settings_json_1.default.ssh.passphrase,
                'localDatabaseFolderLocation': settings_json_1.default.general.databaseLocation,
                'localDomainExtension': settings_json_1.default.general.localDomainExtension
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
                'syncDatabases': 'no',
                'syncImageTypes': null,
                'syncTypes': null
            },
            'finalMessages': {
                'magentoDatabaseLocation': '',
                'magentoDatabaseIncludeLocation': '',
                'wordpressDatabaseLocation': '',
                'importDomain': '',
                'domains': []
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
        this.list = new listr2_1.Listr([], { concurrent: false });
        this.ssh = new node_ssh_1.NodeSSH();
        this.sshSecondDatabase = new node_ssh_1.NodeSSH();
        // @ts-ignore
        this.databases = new databasesModel_1.default(this.config);
        this.configureConfig = () => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            // Fetch SSH key location, if non configured
            if (!this.config.customConfig.sshKeyLocation) {
                this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
            }
            // Check if rsync is installed locally
            yield (0, command_exists_1.default)('rsync')
                .then((command) => {
                this.config.settings.rsyncInstalled = true;
            }).catch(function () { });
            // Get current folder from cwd
            this.config.settings.currentFolder = process.cwd();
            // Set current folder name based on current folder
            this.config.settings.currentFolderName = path.basename(path.resolve(this.config.settings.currentFolder));
        });
        this.configureConfig().then();
    }
}
exports.default = MainController;
//# sourceMappingURL=mainController.js.map