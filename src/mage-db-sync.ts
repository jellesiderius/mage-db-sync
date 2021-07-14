import program from 'commander'
import commandLoader from './commands/index'
import fs from 'fs';
// @ts-ignore
import {getInstalledPath} from 'get-installed-path'
import {success, error} from "./utils/console";

getInstalledPath('mage-db-sync').then((path: any) => {
    // Lets make sure all required files are in place before running the tool
    let npmPath = path;
    let missingFiles = false;
    let requiredFiles = [
        'config/static-settings.json',
        'config/settings.json',
        'config/databases/staging.json',
        'config/databases/production.json'
    ];

    var bar = new Promise((resolve, reject) => {
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

    commandLoader(program)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json')

    program
        .version(packageJson.version)
        .usage('<command> [options]')
        .description(`Magento Database Synchronizer, based on Magerun - ${packageJson.version}`)

    program.on('command:*', () => {
        program.help()
    })

    program.parse(process.argv)

    if (!process.argv.slice(2).length) {
        program.outputHelp()
        process.exit()
    }
});