/**
 * DownloadTask - Enhanced with connection pooling and progress tracking
 */
import {
    sshMagentoRootFolderMagerunCommand,
    sshMagentoRootFolderPhpCommand,
    sshNavigateToMagentoRootCommand,
    stripOutputString
} from '../utils/Console';
import { Listr } from 'listr2';
import { SSHConnectionPool, PerformanceMonitor } from '../utils/Performance';
import { UI } from '../utils/UI';
// @ts-ignore
import staticConfigFile from '../../config/static-settings.json';
import configFile from '../../config/settings.json';
import fs from 'fs';

class DownloadTask {
    private downloadTasks = [];

    configure = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        await this.addTasks(list, config, ssh, sshSecondDatabase);
        return list;
    };

    /**
     * Create SSH configuration object with key file reading
     */
    private createSSHConfig(databaseConfig: any, customConfig: any): any {
        const sshConfig: any = {
            host: databaseConfig.server,
            password: databaseConfig.password,
            username: databaseConfig.username,
            port: databaseConfig.port,
            readyTimeout: 20000,
            keepaliveInterval: 10000,
            keepaliveCountMax: 3
        };

        if (customConfig.sshKeyLocation && fs.existsSync(customConfig.sshKeyLocation)) {
            sshConfig.privateKey = fs.readFileSync(customConfig.sshKeyLocation, 'utf8');
            if (customConfig.sshPassphrase) {
                sshConfig.passphrase = customConfig.sshPassphrase;
            }
        }

        return sshConfig;
    }

    /**
     * Connect to SSH with connection pooling
     */
    private async connectSSH(ssh: any, config: any, isSecondary: boolean = false): Promise<void> {
        const databaseConfig = isSecondary
            ? config.databases.databaseDataSecond
            : config.databases.databaseData;

        const sshConfig = this.createSSHConfig(databaseConfig, config.customConfig);
        const host = databaseConfig.server;

        try {
            await SSHConnectionPool.getConnection(host, sshConfig, async () => {
                await ssh.connect(sshConfig);
                return ssh;
            });
        } catch (error) {
            throw new Error(
                `Failed to connect to ${host}\n` +
                `💡 Check your SSH credentials and key format\n` +
                `Error: ${error.message}`
            );
        }
    }

    addTasks = async (list: any, config: any, ssh: any, sshSecondDatabase: any) => {
        list.add({
            title: `Downloading from server (${config.databases.databaseData.username} | ${config.databases.databaseType})`,
            task: (ctx: any, task: any): Listr => task.newListr(this.downloadTasks)
        });

        this.downloadTasks.push({
            title: 'Connecting to server through SSH ⚡',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('ssh-connection');
                
                await this.connectSSH(ssh, config, false);

                if (config.settings.syncDatabases === 'yes') {
                    await this.connectSSH(sshSecondDatabase, config, true);
                }

                PerformanceMonitor.end('ssh-connection');
            }
        });

        this.downloadTasks.push({
            title: 'Retrieving server settings',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('server-settings');

                await ssh
                    .execCommand(
                        sshNavigateToMagentoRootCommand(
                            'test -e vendor/magento && echo 2 || echo 1; pwd; which php;',
                            config
                        )
                    )
                    .then((result: any) => {
                        if (result) {
                            let string = stripOutputString(result.stdout);
                            let serverValues = string.split('\n');
                            config.serverVariables.magentoVersion = parseInt(serverValues[0]);
                            config.serverVariables.magentoRoot = serverValues[1];
                            config.serverVariables.externalPhpPath = serverValues[2];
                        }
                    });

                if (
                    config.databases.databaseData.externalPhpPath &&
                    config.databases.databaseData.externalPhpPath.length > 0
                ) {
                    config.serverVariables.externalPhpPath = config.databases.databaseData.externalPhpPath;
                }

                config.serverVariables.magerunFile = `n98-magerun2-${config.requirements.magerun2Version}.phar`;

                if (config.settings.syncDatabases === 'yes') {
                    if (
                        config.databases.databaseDataSecond.externalPhpPath &&
                        config.databases.databaseDataSecond.externalPhpPath.length > 0
                    ) {
                        config.serverVariables.secondDatabaseExternalPhpPath =
                            config.databases.databaseDataSecond.externalPhpPath;
                    }
                }

                if (config.serverVariables.magentoVersion === 1) {
                    config.serverVariables.magerunFile = 'n98-magerun-1.98.0.phar';
                }

                PerformanceMonitor.end('server-settings');
            }
        });

        this.downloadTasks.push({
            title: 'Downloading Magerun to server',
            task: async (ctx: any, task: any): Promise<void> => {
                PerformanceMonitor.start('magerun-download');

                let magerunExists = await ssh
                    .execCommand(
                        sshNavigateToMagentoRootCommand(
                            'test -e ' + config.serverVariables.magerunFile + ' && echo "EXISTS"',
                            config
                        )
                    )
                    .then(function (result: any) {
                        let string = stripOutputString(result.stdout);
                        return string.includes('EXISTS');
                    });

                if (!magerunExists) {
                    await ssh.putFile(
                        `${__dirname}/../../files/${config.serverVariables.magerunFile}`,
                        `${config.serverVariables.magentoRoot}/${config.serverVariables.magerunFile}`
                    );
                } else {
                    task.skip('Magerun already exists on server');
                }

                PerformanceMonitor.end('magerun-download');
            }
        });

        this.downloadTasks.push({
            title: 'Retrieving database name from server',
            task: async (): Promise<void> => {
                await ssh
                    .execCommand(
                        sshMagentoRootFolderMagerunCommand('db:info --format=json', config)
                    )
                    .then((result: any) => {
                        if (result && result.stdout) {
                            const output = stripOutputString(result.stdout);
                            
                            try {
                                let jsonResult = JSON.parse(output);
                                
                                for (const key in jsonResult) {
                                    if (jsonResult[key].Name && jsonResult[key].Name.toLowerCase() === 'dbname') {
                                        config.serverVariables.databaseName = jsonResult[key].Value;
                                        break;
                                    }
                                }

                                if (config.serverVariables.magentoVersion === 1) {
                                    config.serverVariables.databaseName = jsonResult[3]?.Value;
                                }
                            } catch (e) {
                                throw new Error(
                                    `Could not retrieve database name from server.\n` +
                                    `Magerun output: ${output}\n` +
                                    `💡 Check if Magerun can connect to the database on the server`
                                );
                            }
                        }
                        
                        if (!config.serverVariables.databaseName) {
                            throw new Error(
                                `Database name could not be determined.\n` +
                                `💡 Check server Magento configuration and database connectivity`
                            );
                        }
                    });
            }
        });

        if (config.settings.syncTypes && config.settings.syncTypes.includes('Magento database')) {
            const stripType = config.settings.strip || 'full';
            this.downloadTasks.push({
                title: `Dumping Magento database and moving it to server root (${stripType})`,
                task: async (): Promise<void> => {
                    PerformanceMonitor.start('database-dump');

                    let dumpCommand: string;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql`;
                    
                    if (config.settings.strip === 'keep customer data') {
                        const keepCustomerOptions = (staticConfigFile as any).settings?.databaseStripKeepCustomerData || '';
                        dumpCommand = `db:dump -n --no-tablespaces --strip="${keepCustomerOptions}" ${databaseFileName}`;
                    } else if (config.settings.strip === 'full and human readable') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        if (fullStripOptions) {
                            dumpCommand = `db:dump -n --no-tablespaces --human-readable --strip="${fullStripOptions}" ${databaseFileName}`;
                        } else {
                            dumpCommand = `db:dump -n --no-tablespaces --human-readable ${databaseFileName}`;
                        }
                    } else if (config.settings.strip === 'full') {
                        const fullStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        if (fullStripOptions) {
                            dumpCommand = `db:dump -n --no-tablespaces --strip="${fullStripOptions}" ${databaseFileName}`;
                        } else {
                            dumpCommand = `db:dump -n --no-tablespaces ${databaseFileName}`;
                        }
                    } else {
                        const developmentStripOptions = (staticConfigFile as any).settings?.databaseStripDevelopment || '';
                        dumpCommand = `db:dump -n --no-tablespaces --strip="${developmentStripOptions}" ${databaseFileName}`;
                    }

                    const fullCommand = sshMagentoRootFolderMagerunCommand(
                        `${dumpCommand}; mv ${databaseFileName} ~`,
                        config
                    );

                    await ssh.execCommand(fullCommand).then(function (result: any) {
                        if (result.code && result.code !== 0) {
                            throw new Error(
                                `Database dump failed\n💡 Check database permissions and disk space\nError: ${result.stderr}`
                            );
                        }
                    });

                    PerformanceMonitor.end('database-dump');
                }
            });

            this.downloadTasks.push({
                title: 'Downloading Magento database to localhost',
                task: async (ctx: any, task: any): Promise<void> => {
                    PerformanceMonitor.start('database-download');

                    const databaseUsername = config.databases.databaseData.username;
                    const databaseServer = config.databases.databaseData.server;
                    const databasePort = config.databases.databaseData.port;
                    const databaseFileName = `${config.serverVariables.databaseName}.sql`;
                    const source = `~/${databaseFileName}`;
                    const destination = config.customConfig.localDatabaseFolderLocation;

                    let sshCommand = databasePort 
                        ? `ssh -p ${databasePort} -o StrictHostKeyChecking=no`
                        : `ssh -o StrictHostKeyChecking=no`;

                    if (config.customConfig.sshKeyLocation) {
                        sshCommand = `${sshCommand} -i ${config.customConfig.sshKeyLocation}`;
                    }

                    let rsyncCommand = `rsync -avz --progress -e "${sshCommand}" ${databaseUsername}@${databaseServer}:${source} ${destination}`;

                    if (config.databases.databaseData.password) {
                        rsyncCommand = `sshpass -p "${config.databases.databaseData.password}" ` + rsyncCommand;
                    }

                    let rsync = require('child_process').exec(rsyncCommand);

                    let lastUpdate = Date.now();
                    rsync.stdout.on('data', function (data: any) {
                        const now = Date.now();
                        if (now - lastUpdate > 500) {
                            const match = data.toString().match(/(\d+)%/);
                            if (match) {
                                task.output = `Downloading: ${match[1]}%`;
                            }
                            lastUpdate = now;
                        }
                    });

                    rsync.stderr.on('data', function (data: any) {
                        console.log('stderr: ' + data.toString());
                    });

                    await new Promise((resolve, reject) => {
                        rsync.on('exit', function (code: any) {
                            if (code !== 0) {
                                reject(
                                    new Error(
                                        `Download failed with code ${code}\n💡 Check SSH connection and file permissions`
                                    )
                                );
                            } else {
                                resolve(null);
                            }
                        });
                    });

                    const duration = PerformanceMonitor.end('database-download');
                    const downloadedFile = `${config.customConfig.localDatabaseFolderLocation}/${config.serverVariables.databaseName}.sql`;
                    const fileSize = fs.existsSync(downloadedFile)
                        ? fs.statSync(downloadedFile).size
                        : 0;
                    const sizeMB = (fileSize / (1024 * 1024)).toFixed(2);
                    task.title = `Downloaded Magento database (${sizeMB}MB in ${UI.duration(duration)})`;
                    
                    config.finalMessages.magentoDatabaseLocation = downloadedFile;
                }
            });
        }

        this.downloadTasks.push({
            title: 'Cleaning up and closing SSH connection',
            task: async (): Promise<void> => {
                PerformanceMonitor.start('cleanup');

                const databaseFileName = `${config.serverVariables.databaseName}.sql`;
                await ssh.execCommand(`rm -f ~/${databaseFileName}`);

                if (config.settings.syncDatabases === 'yes') {
                    if (sshSecondDatabase && typeof sshSecondDatabase.dispose === 'function') {
                        await sshSecondDatabase.dispose().catch(() => {});
                    }
                }

                PerformanceMonitor.end('cleanup');
            }
        });
    };
}

export default DownloadTask;
