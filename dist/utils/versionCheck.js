"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
// @ts-ignore
const package_json_1 = tslib_1.__importDefault(require("../../package.json"));
// @ts-ignore
const fetch = tslib_1.__importStar(require("node-fetch"));
class VersionCheck {
    constructor() {
        this.config = {
            'latestVersion': '',
            'currentVersion': package_json_1.default.version
        };
        // versions
        this.getToolVersions = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield fetch('https://raw.githubusercontent.com/jellesiderius/mage-db-sync/master/package.json')
                .then((res) => res.json())
                .then((json) => this.config.latestVersion = json.version);
        });
    }
}
exports.default = VersionCheck;
//# sourceMappingURL=versionCheck.js.map