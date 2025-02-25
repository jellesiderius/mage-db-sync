"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripOutputString = exports.localhostWpRootExec = exports.wordpressReplaces = exports.localhostRsyncDownloadCommand = exports.localhostMagentoRootExec = exports.sshMagentoRootFolderMagerunCommand = exports.sshMagentoRootFolderPhpCommand = exports.sshNavigateToMagentoRootCommand = exports.consoleCommand = exports.clearConsole = exports.emptyLine = exports.url = exports.error = exports.warning = exports.success = exports.info = exports.verbose = void 0;
const tslib_1 = require("tslib");
const kleur_1 = tslib_1.__importDefault(require("kleur"));
const readline = tslib_1.__importStar(require("readline"));
const prefix = {
    verbose: kleur_1.default.gray(kleur_1.default.bold('🛠 ')),
    info: kleur_1.default.gray(kleur_1.default.bold('✨ ')),
    success: kleur_1.default.gray(kleur_1.default.bold('✅ ')),
    warning: kleur_1.default.yellow(kleur_1.default.bold('⚠️  Warning: ')),
    error: kleur_1.default.red(kleur_1.default.bold('🚨 Error: ')),
};
const body = {
    default: kleur_1.default.white,
    verbose: kleur_1.default.gray,
    warning: kleur_1.default.yellow,
    error: kleur_1.default.red
};
const log = (prefix, body) => {
    let out = prefix;
    out = out.concat(body);
    console.log(out);
};
const verbose = (message) => {
    log(prefix.verbose, body.verbose(message));
};
exports.verbose = verbose;
const info = (message) => {
    log(prefix.info, body.default(message));
};
exports.info = info;
const warning = (message) => {
    log(prefix.warning, body.warning(message));
};
exports.warning = warning;
const error = (message) => {
    log(prefix.error, body.error(message));
};
exports.error = error;
const success = (message) => {
    log(prefix.success, body.default(message));
};
exports.success = success;
const url = (url) => {
    return kleur_1.default.bold(kleur_1.default.underline(url));
};
exports.url = url;
const emptyLine = () => {
    console.log('');
};
exports.emptyLine = emptyLine;
const clearConsole = () => {
    const blank = '\n'.repeat(process.stdout.rows);
    console.log(blank);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
};
exports.clearConsole = clearConsole;
const consoleCommand = (cmd, skipErrors) => {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error && !skipErrors) {
                // @ts-ignore
                throw new Error(error);
                process.exit();
            }
            resolve(stdout ? stdout : stderr);
        });
    });
};
exports.consoleCommand = consoleCommand;
// Navigate to Magento root folder
const sshNavigateToMagentoRootCommand = (command, config, useSecondDatabase = false, log = false) => {
    let databaseData = config.databases.databaseData;
    if (useSecondDatabase) {
        databaseData = config.databases.databaseDataSecond;
    }
    let returnString = '';
    // See if external project folder is filled in, otherwise try default path
    if (databaseData.externalProjectFolder && databaseData.externalProjectFolder.length > 0) {
        returnString = `cd ${databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
    }
    else {
        returnString = 'cd domains > /dev/null 2>&1;' +
            'cd ' + databaseData.domainFolder + ' > /dev/null 2>&1;' +
            'cd application > /dev/null 2>&1;' +
            'cd public_html > /dev/null 2>&1;' +
            'cd current > /dev/null 2>&1;' + command;
    }
    if (log) {
        console.log(returnString);
        process.exit();
    }
    return returnString;
};
exports.sshNavigateToMagentoRootCommand = sshNavigateToMagentoRootCommand;
// Execute a PHP script in the root of magento
const sshMagentoRootFolderPhpCommand = (command, config, useSecondDatabase = false, log = false) => {
    let phpPath = config.serverVariables.externalPhpPath;
    if (config.settings.syncDatabases == 'yes' && useSecondDatabase) {
        phpPath = config.serverVariables.secondDatabaseExternalPhpPath;
    }
    return sshNavigateToMagentoRootCommand(phpPath + ' ' + command, config, useSecondDatabase, log);
};
exports.sshMagentoRootFolderPhpCommand = sshMagentoRootFolderPhpCommand;
// Execute a PHP script in the root of magento
const sshMagentoRootFolderMagerunCommand = (command, config, useSecondDatabase = false, log = false) => {
    let magerunFile = config.serverVariables.magerunFile;
    return sshMagentoRootFolderPhpCommand(magerunFile + ' ' + command, config, useSecondDatabase, log);
};
exports.sshMagentoRootFolderMagerunCommand = sshMagentoRootFolderMagerunCommand;
const localhostMagentoRootExec = (command, config, skipErrors = false, removeQuote = false) => {
    if (!removeQuote) {
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }
    return consoleCommand(`cd ${config.settings.currentFolder}; ${command}`, skipErrors);
};
exports.localhostMagentoRootExec = localhostMagentoRootExec;
const localhostWpRootExec = (command, config, skipErrors = false, removeQuote = false) => {
    if (config.settings.isDdevActive) {
        command = `ddev exec "cd wp; wp ${command}"`;
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }
    if (!removeQuote) {
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }
    return consoleCommand(`cd ${config.settings.currentFolder}; ${command}`, skipErrors);
};
exports.localhostWpRootExec = localhostWpRootExec;
const localhostRsyncDownloadCommand = (source, destination, config, useSecondDatabase = false) => {
    let sshCommand, databaseUsername = config.databases.databaseData.username, databaseServer = config.databases.databaseData.server, databasePort = config.databases.databaseData.port;
    if (useSecondDatabase) {
        databaseUsername = config.databases.databaseDataSecond.username,
            databaseServer = config.databases.databaseDataSecond.server,
            databasePort = config.databases.databaseDataSecond.port;
    }
    config.databases.databaseData.port ? sshCommand = `ssh -p ${databasePort} -o StrictHostKeyChecking=no` : sshCommand = `ssh -o StrictHostKeyChecking=no`;
    if (config.customConfig.sshKeyLocation) {
        sshCommand = `${sshCommand} -i ${config.customConfig.sshKeyLocation}`;
    }
    let totalRsyncCommand = `rsync -avz -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${source} ${destination}`;
    // If password is set, use sshpass
    if (config.databases.databaseData.password) {
        totalRsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + totalRsyncCommand;
    }
    return consoleCommand(totalRsyncCommand, false);
};
exports.localhostRsyncDownloadCommand = localhostRsyncDownloadCommand;
const wordpressReplaces = (entry, text) => {
    var replacedText = entry.replace(text, ''), replacedText = replacedText.replace(`,`, ''), replacedText = replacedText.replace(`DEFINE`, ''), replacedText = replacedText.replace(`define`, ''), replacedText = replacedText.replace(`(`, ''), replacedText = replacedText.replace(` `, ''), replacedText = replacedText.replace(`;`, ''), replacedText = replacedText.replace(`$`, ''), replacedText = replacedText.replace(`)`, ''), replacedText = replacedText.replace(`=`, ''), replacedText = replacedText.replace("'", '').replace(/'/g, '');
    return replacedText.trim();
};
exports.wordpressReplaces = wordpressReplaces;
const stripOutputString = (string) => {
    let magerunRootWarning = "It's not recommended to run n98-magerun as root user";
    return string.replace(magerunRootWarning, '');
};
exports.stripOutputString = stripOutputString;
//# sourceMappingURL=console.js.map