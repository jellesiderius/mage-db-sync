import kleur from 'kleur'
import * as readline from 'readline'
import {ExecException} from "child_process";

const prefix = {
    verbose: kleur.gray(kleur.bold('🛠 ')),
    info: kleur.gray(kleur.bold('✨ ')),
    success: kleur.gray(kleur.bold('✅ ')),
    warning: kleur.yellow(kleur.bold('⚠️  Warning: ')),
    error: kleur.red(kleur.bold('🚨 Error: ')),
}

const body = {
    default: kleur.white,
    verbose: kleur.gray,
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
    log(prefix.info, body.default(message))
}

const warning = (message: string): void => {
    log(prefix.warning, body.warning(message))
}

const error = (message: string): void => {
    log(prefix.error, body.error(message))
}

const success = (message: string): void => {
    log(prefix.success, body.default(message))
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
    return new Promise((resolve, reject) => {
        exec(cmd, (error: ExecException | null, stdout: string, stderr: string) => {
            if (error && !skipErrors) {
                // @ts-ignore
                throw new Error(error)
                process.exit();
            }
            resolve(stdout ? stdout : stderr);
        });
    });
}

// Navigate to Magento root folder
const sshNavigateToMagentoRootCommand = (command: string, config: any) => {
    // See if external project folder is filled in, otherwise try default path
    if (config.databases.databaseData.externalProjectFolder && config.databases.databaseData.externalProjectFolder.length > 0) {
        return `cd ${config.databases.databaseData.externalProjectFolder} > /dev/null 2>&1; ${command}`;
    } else {
        return 'cd domains > /dev/null 2>&1;' +
            'cd ' + config.databases.databaseData.domainFolder + ' > /dev/null 2>&1;' +
            'cd application > /dev/null 2>&1;' +
            'cd public_html > /dev/null 2>&1;' +
            'cd current > /dev/null 2>&1;' + command;
    }
}

// Execute a PHP script in the root of magento
const sshMagentoRootFolderPhpCommand = (command: string, config: any) => {
    return sshNavigateToMagentoRootCommand(config.serverVariables.externalPhpPath + ' ' + command, config);
}

// Execute a PHP script in the root of magento
const sshMagentoRootFolderMagerunCommand = (command: string, config: any) => {
    return sshMagentoRootFolderPhpCommand(config.serverVariables.magerunFile + ' ' + command, config);
}

const localhostMagentoRootExec = (command: string, config: any, skipErrors: boolean = false) => {
    return consoleCommand(`cd ${config.settings.currentFolder}; ${command};`, skipErrors);
}

const localhostRsyncDownloadCommand = (source: string, destination: string, config: any) => {
    let sshCommand: string;
    config.databases.databaseData.port ? sshCommand = `ssh -p ${config.databases.databaseData.port} -o StrictHostKeyChecking=no` : sshCommand = `ssh -o StrictHostKeyChecking=no`;

    let totalRsyncCommand = `rsync -avz -e "${sshCommand}" ${config.databases.databaseData.username}@${config.databases.databaseData.server}:${source} ${destination}`;

    // If password is set, use sshpass
    if (config.databases.databaseData.password) {
        totalRsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + totalRsyncCommand;
    }

    return consoleCommand(totalRsyncCommand, false)
}

const wordpressReplaces = (entry: string, text: string) => {
    var replacedText = entry.replace(text, ''),
        replacedText = replacedText.replace(`,`, ''),
        replacedText = replacedText.replace(`DEFINE`, ''),
        replacedText = replacedText.replace(`define`, ''),
        replacedText = replacedText.replace(`(`, ''),
        replacedText = replacedText.replace(` `, ''),
        replacedText = replacedText.replace(`;`, ''),
        replacedText = replacedText.replace(`$`, ''),
        replacedText = replacedText.replace(`)`, ''),
        replacedText = replacedText.replace(`=`, ''),
        replacedText = replacedText.replace("'", '').replace(/'/g,'');

    return replacedText.trim();
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
    wordpressReplaces
}
