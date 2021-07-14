"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const download_git_repo_1 = tslib_1.__importDefault(require("download-git-repo"));
const get_installed_path_1 = require("get-installed-path");
class SelfUpdateController {
    constructor() {
        this.executeStart = (serviceName) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            // Get NPM path to this module
            let npmPath = '';
            yield get_installed_path_1.getInstalledPath('mage-db-sync').then((path) => {
                npmPath = path;
            });
            download_git_repo_1.default('jellesiderius/mage-db-sync', npmPath, function (err) {
            });
            return true;
        });
    }
}
exports.default = SelfUpdateController;
//# sourceMappingURL=selfUpdateController.js.map