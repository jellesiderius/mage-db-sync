"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const commander_1 = tslib_1.__importDefault(require("commander"));
const index_1 = tslib_1.__importDefault(require("./commands/index"));
const fs_1 = tslib_1.__importDefault(require("fs"));
// @ts-ignore
const get_installed_path_1 = require("get-installed-path");
const console_1 = require("./utils/console");
const versionCheck_1 = tslib_1.__importDefault(require("./utils/versionCheck"));
get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
    // Lets make sure all required files are in place before running the tool
    let npmPath = path;
    let missingFiles = false;
    let requiredFiles = [
        'config/static-settings.json',
        'config/settings.json',
        'config/databases/staging.json',
        'config/databases/production.json'
    ];
    new Promise((resolve, reject) => {
        requiredFiles.forEach((path) => {
            if (!fs_1.default.existsSync(`${npmPath}/${path}`)) {
                console_1.error(`${path} was not found. Make sure this file exists (${npmPath}/${path})`);
                missingFiles = true;
            }
        });
    });
    // If there are files missing, stop the program from running
    if (missingFiles) {
        return;
    }
    index_1.default(commander_1.default);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json');
    let versionCheck = new versionCheck_1.default();
    yield versionCheck.getToolVersions();
    let description = `Magento Database Synchronizer, based on Magerun - ${packageJson.version}`;
    if (versionCheck.config.currentVersion < versionCheck.config.latestVersion) {
        description = `${description}\nRun 'mage-db-sync self-update' to download the newest version: ${versionCheck.config.latestVersion}`;
    }
    // Remove old files... Kinda dirty but it works
    new Promise((resolve, reject) => tslib_1.__awaiter(void 0, void 0, void 0, function* () {
        if (fs_1.default.existsSync(`${npmPath}/dist/controllers/importController.js`)) {
            fs_1.default.unlinkSync(`${npmPath}/dist/controllers/importController.js`);
        }
        if (fs_1.default.existsSync(`${npmPath}/dist/controllers/importController.js.map`)) {
            fs_1.default.unlinkSync(`${npmPath}/dist/controllers/importController.js.map`);
        }
    }));
    commander_1.default
        .version(packageJson.version)
        .usage('<command> [options]')
        .description(description);
    commander_1.default.on('command:*', () => {
        commander_1.default.help();
    });
    commander_1.default.parse(process.argv);
    if (!process.argv.slice(2).length) {
        commander_1.default.outputHelp();
        process.exit();
    }
}));
//# sourceMappingURL=mage-db-sync.js.map