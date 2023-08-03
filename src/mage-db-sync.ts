import program from 'commander'
import commandLoader from './commands/index'
import fs from 'fs';
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {error} from "./utils/console";
import VersionCheck from "./utils/versionCheck";
import kleur from "kleur";

getInstalledPath('mage-db-sync').then(async (path: any) => {
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
            if (!fs.existsSync(`${npmPath}/${path}`)) {
                error(`${path} was not found. Make sure this file exists (${npmPath}/${path})`);
                missingFiles = true;
            }
        });
    });

    // If there are files missing, stop the program from running
    if (missingFiles) {
        return;
    }

    commandLoader(program);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json')
    let versionCheck = new VersionCheck();
    await versionCheck.getToolVersions();
    let description = `Magento Database Synchronizer, based on Magerun - ${packageJson.version}\n• Github Page: https://github.com/jellesiderius/mage-db-sync\n• Docs: https://github.com/jellesiderius/mage-db-sync/wiki\n• Report an issue: https://github.com/jellesiderius/mage-db-sync/issues`;
    if (versionCheck.config.currentVersion < versionCheck.config.latestVersion) {
        description = `${description}\nRun 'mage-db-sync self-update' to download the newest version: ${versionCheck.config.latestVersion}`;
    }

    description += `\n\n${kleur.bgYellow(kleur.bold('Sponsored by:'))}
• HYPR (https://www.hypershop.nl)`;

    let deleteFiles = [
        `${npmPath}/dist/controllers/importController.js`,
        `${npmPath}/dist/commands/importCommand.js`
    ];

    // Remove old files... Kinda dirty but it works
    new Promise((resolve, reject) => {
        deleteFiles.forEach((path) => {
            if (fs.existsSync(`${path}`)) {
                fs.unlinkSync(`${path}`)
            }

            if (fs.existsSync(`${path}.map`)) {
                fs.unlinkSync(`${path}.map`)
            }
        });
    });

    program
        .version(packageJson.version)
        .usage('<command> [options]')
        .description(description)

    program.on('command:*', () => {
        program.help()
    })

    program.parse(process.argv)

    if (!process.argv.slice(2).length) {
        program.outputHelp()
        process.exit()
    }
});
