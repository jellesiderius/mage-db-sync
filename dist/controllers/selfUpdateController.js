"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const download_git_repo_1 = tslib_1.__importDefault(require("download-git-repo"));
const get_installed_path_1 = require("get-installed-path");
// @ts-ignore
const package_json_1 = tslib_1.__importDefault(require("../../package.json"));
class SelfUpdateController {
    constructor() {
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Get NPM path to this module
            let npmPath = '';
            let oldVersion = package_json_1.default.version;
            let newVersion = '';
            yield get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => {
                npmPath = path;
            });
            yield download_git_repo_1.default('jellesiderius/mage-db-sync', npmPath, function (err) {
                newVersion = package_json_1.default.version;
            });
            yield console.log(`Updated from ${oldVersion} to ${newVersion}`);
            return true;
        });
    }
}
exports.default = SelfUpdateController;
//# sourceMappingURL=selfUpdateController.js.map