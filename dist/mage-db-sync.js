"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const commander_1 = tslib_1.__importDefault(require("commander"));
const index_1 = tslib_1.__importDefault(require("./commands/index"));
index_1.default(commander_1.default);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');
commander_1.default
    .version(packageJson.version)
    .usage('<command> [options]')
    .description(`Magento Database Synchronizer, based on Magerun - ${packageJson.version}`);
commander_1.default.on('command:*', () => {
    commander_1.default.help();
});
commander_1.default.parse(process.argv);
if (!process.argv.slice(2).length) {
    commander_1.default.outputHelp();
    process.exit();
}
//# sourceMappingURL=mage-db-sync.js.map