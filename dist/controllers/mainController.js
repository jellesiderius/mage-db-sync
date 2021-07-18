"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const settings_json_1 = tslib_1.__importDefault(require("../../config/settings.json"));
const node_ssh_1 = require("node-ssh");
const databasesModel_1 = tslib_1.__importDefault(require("../models/databasesModel"));
const os = tslib_1.__importStar(require("os"));
const path = tslib_1.__importStar(require("path"));
const fs = tslib_1.__importStar(require("fs"));
const console_1 = require("../utils/console");
const listr2_1 = require("listr2");
const inquirer_1 = tslib_1.__importDefault(require("inquirer"));
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
        this.list = new listr2_1.Listr([], { concurrent: false });
        this.ssh = new node_ssh_1.NodeSSH();
        this.databases = new databasesModel_1.default();
        this.configureConfig = () => {
            // Fetch SSH key location
            if (!this.config.customConfig.sshKeyLocation) {
                this.config.customConfig.sshKeyLocation = os.userInfo().homedir + '/.ssh/id_rsa';
            }
            // Check if rsync is installed locally
            let rsyncCheck = console_1.consoleCommand('which rsync');
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
        };
        this.configureConfig();
    }
}
exports.default = MainController;
//# sourceMappingURL=mainController.js.map