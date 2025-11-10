import kleur from 'kleur'
import * as readline from 'readline'
import {ExecException} from "child_process";

const prefix = {
    verbose: kleur.gray(kleur.bold('[DEBUG] ')),
    info: kleur.cyan(kleur.bold('[INFO] ')),
    success: kleur.green(kleur.bold('[SUCCESS] ')),
    warning: kleur.yellow(kleur.bold('[WARNING] ')),
    error: kleur.red(kleur.bold('[ERROR] ')),
}

const body = {
    default: kleur.white,
    verbose: kleur.gray,
    info: kleur.cyan,
    success: kleur.green,
    warning: kleur.yellow,
    error: kleur.red
}

const log = (prefix: string, body: string): void => {
    let out = prefix
    out = out.concat(body)

    console.log(out)
}

const verbose = (message: string): void => {
    log(prefix.verbose, body.verbose(message))
}

const info = (message: string): void => {
    log(prefix.info, body.info(message))
}

const warning = (message: string): void => {
    log(prefix.warning, body.warning(message))
}

const error = (message: string): void => {
    log(prefix.error, body.error(message))
}

const success = (message: string): void => {
    log(prefix.success, body.success(message))
}

const url = (url: string): string => {
    return kleur.bold(kleur.underline(url))
}

const emptyLine = (): void => {
    console.log('')
}

const clearConsole = (): void => {
    const blank = '\n'.repeat(process.stdout.rows)
    console.log(blank)
    readline.cursorTo(process.stdout, 0, 0)
    readline.clearScreenDown(process.stdout)
}

const consoleCommand = (cmd: string, skipErrors: boolean) => {
    const exec = require('child_process').exec;
    return new Promise((resolve, _reject) => {
        exec(cmd, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error && !skipErrors) {
                throw new Error(String(error));
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

// Navigate to Magento root folder
const sshNavigateToMagentoRootCommand = (command: string, config: any, _useSecondDatabase: boolean = false, log: boolean = false) => {
    const databaseData = config.databases.databaseData;

    let returnString = '';

    // See if external project folder is filled in, otherwise try default path
    if (databaseData.externalProjectFolder && databaseData.externalProjectFolder.length > 0) {
        returnString = `cd ${databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
    } else {
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
}

// Execute a PHP script in the root of magento
const sshMagentoRootFolderPhpCommand = (command: string, config: any, useSecondDatabase: boolean = false, log: boolean = false) => {
    const phpPath = config.serverVariables.externalPhpPath;

    return sshNavigateToMagentoRootCommand(phpPath + ' ' + command, config, useSecondDatabase, log);
}

// Execute a PHP script in the root of magento
const sshMagentoRootFolderMagerunCommand = (command: string, config: any, useSecondDatabase: boolean = false, log: boolean = false) => {
    const magerunFile = config.serverVariables.magerunFile;

    return sshMagentoRootFolderPhpCommand(magerunFile + ' ' + command, config, useSecondDatabase, log);
}

const localhostMagentoRootExec = (command: string, config: any, skipErrors: boolean = false, removeQuote = false) => {
    if (!removeQuote) {
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }

    return consoleCommand(`cd ${config.settings.currentFolder}; ${command}`, skipErrors);
}

const localhostWpRootExec = (command: string, config: any, skipErrors: boolean = false, removeQuote = false) => {
    if (config.settings.isDdevActive) {
        command = `ddev exec "cd wp; wp ${command}"`;
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }

    if (!removeQuote) {
        return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
    }

    return consoleCommand(`cd ${config.settings.currentFolder}; ${command}`, skipErrors);
}

const localhostRsyncDownloadCommand = (source: string, destination: string, config: any, _useSecondDatabase: boolean = false) => {
    const databaseUsername = config.databases.databaseData.username;
    const databaseServer = config.databases.databaseData.server;
    const databasePort = config.databases.databaseData.port;

    let sshCommand = config.databases.databaseData.port 
        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no` 
        : `ssh -o StrictHostKeyChecking=no`;

    if (config.customConfig.sshKeyLocation) {
        sshCommand = `${sshCommand} -i ${config.customConfig.sshKeyLocation}`;
    }

    let totalRsyncCommand = `rsync -avz -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${source} ${destination}`;

    // If password is set, use sshpass
    if (config.databases.databaseData.password) {
        totalRsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + totalRsyncCommand;
    }

    return consoleCommand(totalRsyncCommand, false)
}

const wordpressReplaces = (entry: string, text: string) => {
    let replacedText = entry.replace(text, '');
    replacedText = replacedText.replace(`,`, '');
    replacedText = replacedText.replace(`DEFINE`, '');
    replacedText = replacedText.replace(`define`, '');
    replacedText = replacedText.replace(`(`, '');
    replacedText = replacedText.replace(` `, '');
    replacedText = replacedText.replace(`;`, '');
    replacedText = replacedText.replace(`$`, '');
    replacedText = replacedText.replace(`)`, '');
    replacedText = replacedText.replace(`=`, '');
    replacedText = replacedText.replace("'", '').replace(/'/g,'');

    return replacedText.trim();
}

const stripOutputString = (string: string) => {
    const magerunRootWarning = "It's not recommended to run n98-magerun as root user";
    return string.replace(magerunRootWarning, '');
}

export {
    verbose,
    info,
    success,
    warning,
    error,
    url,
    emptyLine,
    clearConsole,
    consoleCommand,
    sshNavigateToMagentoRootCommand,
    sshMagentoRootFolderPhpCommand,
    sshMagentoRootFolderMagerunCommand,
    localhostMagentoRootExec,
    localhostRsyncDownloadCommand,
    wordpressReplaces,
    localhostWpRootExec,
    stripOutputString
}
