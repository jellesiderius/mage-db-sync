/**
 * StartController - Enhanced with modern UI, performance features, and DI
 */
import path from 'path';
import MainController from './MainController';
import DatabaseTypeQuestion from '../questions/DatabaseTypeQuestion';
import SelectDatabaseQuestion from '../questions/SelectDatabaseQuestion';
import ConfigurationQuestions from '../questions/ConfigurationQuestions';
import DownloadTypesQuestion from '../questions/DownloadTypesQuestion';
import { UI } from '../utils/UI';
import { SSHConnectionPool } from '../utils/Performance';
import { TaskFactory } from '../core/TaskFactory';
import { NonInteractiveOptions, DatabaseConfig } from '../types';

class StartController extends MainController {
    private taskFactory: TaskFactory;

    constructor() {
        super();
        super.init(); // Initialize parent config
        this.taskFactory = TaskFactory.getInstance();
    }
    public async execute(opts?: NonInteractiveOptions): Promise<void> {
        return this.executeStart(opts);
    }

    executeStart = async (opts?: NonInteractiveOptions): Promise<void> => {
        try {
            this.config.settings.nonInteractiveOptions = opts;

            if (opts?.target === 'staging') {
                this.config.settings.remoteStagingSync = true;
            }

            await this.askQuestions(opts);
            await this.prepareTasks();

            this.showTaskSummary();

            await this.list.run();

            await this.showCompletionMessage();

            process.exit(0);
        } catch (e) {
            const error = e as Error;
            const logger = this.services.getLogger();

            // Log error for debugging
            logger.error('Operation failed', error);

            // Display user-friendly error message
            console.log('\n');
            UI.error(`Operation failed: ${error.message}`);

            if (error.stack && process.env.DEBUG) {
                console.log('\nStack trace:');
                console.log(error.stack);
            }

            // Try to close SSH connections on error (might already be closed)
            try {
                await SSHConnectionPool.closeAll();
            } catch (_cleanupError) {
                // Ignore cleanup errors during error handling
            }

            // Force exit with error code
            process.exitCode = 1;
            process.exit(1);
        }
    };

    private showTaskSummary(): void {
        UI.section('Task Summary');

        const tasks = [];

        if (this.config.settings.syncTypes && Array.isArray(this.config.settings.syncTypes) && this.config.settings.syncTypes.includes('Magento database')) {
            tasks.push({
                label: 'Download Database',
                value: `${this.config.databases.databaseType} (${this.config.settings.strip === 'custom' ? 'custom strip' : this.config.settings.strip || 'full'})`
            });
        }

        if (this.config.settings.import === 'yes') {
            tasks.push({
                label: 'Import to Magento',
                value: this.config.settings.currentFolder
            });
        }

        if (this.config.settings.wordpressDownload === 'yes') {
            tasks.push({
                label: 'Download WordPress',
                value: 'Yes'
            });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            tasks.push({
                label: 'Import WordPress',
                value: 'Yes'
            });
        }


        UI.table(tasks);

        console.log('');
        UI.box(
            'This may take a few minutes...\n' +
            'Grab some coffee while you wait!',
            { type: 'info', title: 'Starting Operations' }
        );
    }

    private async showCompletionMessage(): Promise<void> {
        console.log('\n');

        if (this.config.finalMessages.importDomain.length > 0) {
            const configService = this.services.getConfig();
            const settingsConfig = configService.getSettingsConfig();
            const urls = this.config.finalMessages.domains;
            const message =
                `Magento successfully imported!\n\n` +
                `Your project is available at:\n` +
                urls.map((url: string) => `   ${url}`).join('\n') +
                `\n\n` +
                `Backend Credentials:\n` +
                `   Username: ${settingsConfig.magentoBackend.adminUsername}\n` +
                `   Password: ${settingsConfig.magentoBackend.adminPassword}\n\n` +
                `Customer Account (all websites):\n` +
                `   Email: ${settingsConfig.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${settingsConfig.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: 'Magento Import Complete' });
        } else if (this.config.finalMessages.magentoDatabaseLocation.length > 0) {
            let message = `Downloaded Magento database to:\n${this.config.finalMessages.magentoDatabaseLocation}`;

            if (
                this.config.finalMessages.wordpressDatabaseLocation.length > 0 &&
                this.config.settings.wordpressDownload === 'yes' &&
                this.config.settings.wordpressImport !== 'yes'
            ) {
                message += `\n\nDownloaded WordPress database to:\n${this.config.finalMessages.wordpressDatabaseLocation}`;
            }

            UI.box(message, { type: 'success', title: 'Download Complete' });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            const configService = this.services.getConfig();
            const settingsConfig = configService.getSettingsConfig();
            let message =
                `WordPress successfully imported!\n\n`;

            // Add blog URLs if available
            if (this.config.finalMessages.wordpressBlogUrls && this.config.finalMessages.wordpressBlogUrls.length > 0) {
                message += `Your WordPress sites are available at:\n`;
                message += this.config.finalMessages.wordpressBlogUrls
                    .map((blog: {blogId: string, domain: string}) => `   Blog ID ${blog.blogId}: ${blog.domain}`)
                    .join('\n');
                message += `\n\n`;
            }

            message +=
                `Backend Credentials:\n` +
                `   Username: ${settingsConfig.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${settingsConfig.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: 'WordPress Import Complete' });
        }

        // Log completion
        const logger = this.services.getLogger();
        logger.info('Operation completed successfully', {
            component: 'StartController'
        });
    }

    askQuestions = async (opts?: NonInteractiveOptions) => {
        UI.section('Configuration');

        if (opts?.inlineMode) {
            this.applyInlineParams(opts);

            const downloadTypesQuestion = await new DownloadTypesQuestion();
            await downloadTypesQuestion.configure(this.config, opts);

            const configurationQuestions = await new ConfigurationQuestions();
            await configurationQuestions.configure(this.config, opts);
            return;
        }

        const databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config, opts);

        const selectDatabaseQuestion = await new SelectDatabaseQuestion();
        await selectDatabaseQuestion.configure(this.config, opts);

        // If remote staging sync is requested, load the staging DB config via stagingUsername
        if (this.config.settings.remoteStagingSync) {
            const stagingKey = this.config.databases.databaseData?.stagingUsername;
            if (!stagingKey) {
                throw new Error(
                    `Remote staging sync requires a "stagingUsername" entry in the selected production database config.\n` +
                    `Add it to your production.json pointing at the matching key in staging.json.`
                );
            }
            const databasesModel = new (await import('../models/DatabasesModel')).default();
            databasesModel.collectStagingDatabaseData(stagingKey, this.config);
        }

        const downloadTypesQuestion = await new DownloadTypesQuestion();
        await downloadTypesQuestion.configure(this.config, opts);

        const configurationQuestions = await new ConfigurationQuestions();
        await configurationQuestions.configure(this.config, opts);
    };

    private applyInlineParams(opts: NonInteractiveOptions): void {
        if (!opts.sourceSsh) {
            throw new Error('--source-ssh is required for inline mode.');
        }

        const atIndex = opts.sourceSsh.indexOf('@');
        if (atIndex === -1) {
            throw new Error(`--source-ssh must be in user@host format, got: ${opts.sourceSsh}`);
        }
        const sourceUsername = opts.sourceSsh.substring(0, atIndex);
        const sourceHost = opts.sourceSsh.substring(atIndex + 1);

        const sourceDatabaseData: DatabaseConfig = {
            username: sourceUsername,
            password: '',
            server: sourceHost,
            domainFolder: sourceHost,
            port: opts.sourcePort ?? 22,
            externalProjectFolder: opts.sourcePath ?? '',
            localProjectFolder: '',
            sshKeyLocation: opts.sshKey ?? '',
        };

        this.config.databases.databaseData = sourceDatabaseData;
        this.config.databases.databaseType = 'production';
        this.config.databases.databaseKey = sourceHost;

        if (opts.sshKey) {
            this.config.customConfig.sshKeyLocation = opts.sshKey;
        }

        if (opts.localMagerun2) {
            this.config.settings.magerun2CommandLocal = opts.localMagerun2;
        }

        if (opts.target === 'staging' && opts.targetSsh) {
            const targetAtIndex = opts.targetSsh.indexOf('@');
            if (targetAtIndex === -1) {
                throw new Error(`--target-ssh must be in user@host format, got: ${opts.targetSsh}`);
            }
            const targetUsername = opts.targetSsh.substring(0, targetAtIndex);
            const targetHost = opts.targetSsh.substring(targetAtIndex + 1);

            this.config.databases.stagingDatabaseData = {
                username: targetUsername,
                password: '',
                server: targetHost,
                domainFolder: targetHost,
                port: opts.targetPort ?? 22,
                externalProjectFolder: opts.targetPath ?? '',
                localProjectFolder: '',
                sshKeyLocation: opts.sshKey ?? '',
            };

            this.config.settings.remoteStagingSync = true;
        } else if (opts.localPath) {
            this.config.settings.currentFolder = opts.localPath;
            this.config.settings.currentFolderName = path.basename(path.resolve(opts.localPath));
        }

        if (!opts.import) {
            this.config.settings.import = 'yes';
        }
    }

    prepareTasks = async () => {
        console.log('');
        UI.info('Preparing tasks...\n');

        const logger = this.services.getLogger();
        logger.info('Preparing task pipeline', { component: 'StartController' });

        // Create tasks via factory (DI pattern)
        const checksTask = this.taskFactory.createChecksTask();
        await checksTask.configure(this.list, this.config, this.ssh);

        const downloadTask = this.taskFactory.createDownloadTask();
        await downloadTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);

        if (this.config.settings.remoteStagingSync) {
            // Guard: refuse to sync if source and staging resolve to the same server+path,
            // regardless of whether params came from inline flags or config files.
            const prod = this.config.databases.databaseData;
            const staging = this.config.databases.stagingDatabaseData;
            if (
                prod && staging &&
                prod.server === staging.server &&
                prod.username === staging.username &&
                (prod.externalProjectFolder || '') === (staging.externalProjectFolder || '')
            ) {
                throw new Error(
                    'Source and staging point to the same server and path — ' +
                    'refusing to sync onto itself.'
                );
            }

            // Remote staging sync: transfer + import + configure on staging server via SSH
            const stagingDeployTask = this.taskFactory.createStagingDeployTask();
            await stagingDeployTask.configure(this.list, this.config, this.ssh, this.sshSecondDatabase);
        } else {
            // Local import flow
            if (this.config.settings.import === 'yes') {
                const importTask = this.taskFactory.createImportTask();
                await importTask.configure(this.list, this.config);
            }

            if (this.config.settings.import === 'yes') {
                const magentoConfigureTask = this.taskFactory.createMagentoConfigureTask();
                await magentoConfigureTask.configure(this.list, this.config);
            }
        }

        if (this.config.settings.wordpressImport === 'yes') {
            const wordpressConfigureTask = this.taskFactory.createWordpressConfigureTask();
            await wordpressConfigureTask.configure(this.list, this.config);
        }

        logger.info('Task pipeline prepared successfully', {
            taskCount: this.list.tasks.length
        });
    };
}

export default StartController;
export { StartController };
