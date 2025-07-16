"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const commander_1 = (0, tslib_1.__importDefault)(require("commander"));
const index_1 = (0, tslib_1.__importDefault)(require("./commands/index"));
const fs_1 = (0, tslib_1.__importDefault)(require("fs"));
// @ts-ignore
const get_installed_path_1 = require("get-installed-path");
const console_1 = require("./utils/console");
const versionCheck_1 = (0, tslib_1.__importDefault)(require("./utils/versionCheck"));
const kleur_1 = (0, tslib_1.__importDefault)(require("kleur"));
const process_1 = (0, tslib_1.__importDefault)(require("process"));
process_1.default.removeAllListeners('warning');
(0, get_installed_path_1.getInstalledPath)('mage-db-sync').then((path) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
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
                (0, console_1.error)(`${path} was not found. Make sure this file exists (${npmPath}/${path})`);
                missingFiles = true;
            }
        });
    });
    // If there are files missing, stop the program from running
    if (missingFiles) {
        return;
    }
    (0, index_1.default)(commander_1.default);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json');
    let versionCheck = new versionCheck_1.default();
    yield versionCheck.getToolVersions();
    let description = `Magento Database Synchronizer, based on Magerun - ${packageJson.version}\n• Github Page: https://github.com/jellesiderius/mage-db-sync\n• Docs: https://github.com/jellesiderius/mage-db-sync/wiki\n• Report an issue: https://github.com/jellesiderius/mage-db-sync/issues`;
    if (versionCheck.config.currentVersion < versionCheck.config.latestVersion) {
        description = `${description}\nRun 'mage-db-sync self-update' to download the newest version: ${versionCheck.config.latestVersion}`;
    }
    description += `\n\n${kleur_1.default.bgYellow(kleur_1.default.bold('Sponsored by:'))}
• HYPR (https://www.hypershop.nl)`;
    let deleteFiles = [
        `${npmPath}/dist/controllers/importController.js`,
        `${npmPath}/dist/commands/importCommand.js`
    ];
    // Remove old files... Kinda dirty but it works
    new Promise((resolve, reject) => {
        deleteFiles.forEach((path) => {
            if (fs_1.default.existsSync(`${path}`)) {
                fs_1.default.unlinkSync(`${path}`);
            }
            if (fs_1.default.existsSync(`${path}.map`)) {
                fs_1.default.unlinkSync(`${path}.map`);
            }
        });
    });
    commander_1.default
        .version(packageJson.version)
        .usage('<command> [options]')
        .description(description);
    commander_1.default.on('command:*', () => {
        commander_1.default.help();
    });
    commander_1.default.parse(process_1.default.argv);
    if (!process_1.default.argv.slice(2).length) {
        commander_1.default.outputHelp();
        process_1.default.exit();
    }
}));
//# sourceMappingURL=mage-db-sync.js.map