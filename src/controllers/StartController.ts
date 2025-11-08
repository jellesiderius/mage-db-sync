/**
 * StartController - Enhanced with modern UI, performance features, and DI
 */
import MainController from './MainController';
import DatabaseTypeQuestion from '../questions/DatabaseTypeQuestion';
import SelectDatabaseQuestion from '../questions/SelectDatabaseQuestion';
import ConfigurationQuestions from '../questions/ConfigurationQuestions';
import SyncDatabasesQuestions from '../questions/SyncDatabasesQuestions';
import DownloadTypesQuestion from '../questions/DownloadTypesQuestion';
import { UI } from '../utils/UI';
import { PerformanceMonitor, SSHConnectionPool } from '../utils/Performance';
import { TaskFactory } from '../core/TaskFactory';
import { ServiceContainer } from '../core/ServiceContainer';
import configFile from '../../config/settings.json';

class StartController extends MainController {
    private taskFactory: TaskFactory;
    private services: ServiceContainer;

    constructor() {
        super();
        this.taskFactory = TaskFactory.getInstance();
        this.services = ServiceContainer.getInstance();
    }
    public async execute(): Promise<void> {
        return this.executeStart();
    }

    executeStart = async (): Promise<void> => {
        try {
            UI.showBanner();

            await this.askQuestions();
            await this.prepareTasks();

            this.showTaskSummary();

            await this.list.run();

            await this.showCompletionMessage();

            await SSHConnectionPool.closeAll();

            process.exit(0);
        } catch (e) {
            const error = e as Error;
            UI.error(`Operation failed: ${error.message}`);

            if (error.stack) {
                console.log('\n' + error.stack);
            }

            await SSHConnectionPool.closeAll();
            process.exit(1);
        }
    };

    private showTaskSummary(): void {
        console.log('');
        UI.section('📋 Task Summary');

        const tasks = [];

        if (this.config.settings.syncTypes && Array.isArray(this.config.settings.syncTypes) && this.config.settings.syncTypes.includes('Magento database')) {
            tasks.push({
                label: 'Download Database',
                value: `${this.config.databases.databaseType} (${this.config.settings.strip || 'full'})`
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

        if (this.config.settings.syncDatabases === 'yes' && this.config.databases.databaseData && this.config.databases.databaseDataSecond) {
            tasks.push({
                label: 'Sync Databases',
                value: `${this.config.databases.databaseData.username} ⟷ ${this.config.databases.databaseDataSecond.username}`
            });
        }

        UI.table(tasks);

        console.log('');
        UI.box(
            '⚡ Speed Optimizations Active:\n' +
            '  • SSH compression enabled\n' +
            '  • Parallel validation checks\n' +
            '  • Connection pooling & reuse\n' +
            '  • Real-time progress tracking\n\n' +
            '💡 This may take a few minutes...\n' +
            '   Grab some ☕ coffee while you wait!',
            { type: 'info', title: 'Starting Operations' }
        );
    }

    private async showCompletionMessage(): Promise<void> {
        console.log('\n');

        if (this.config.finalMessages.importDomain.length > 0) {
            const urls = this.config.finalMessages.domains;
            const message =
                `✅ Magento successfully imported!\n\n` +
                `🌐 Your project is available at:\n` +
                urls.map((url: string) => `   ${url}`).join('\n') +
                `\n\n` +
                `🔐 Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminUsername}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}\n\n` +
                `👤 Customer Account (all websites):\n` +
                `   Email: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: '🎉 Import Complete' });
        } else if (this.config.finalMessages.magentoDatabaseLocation.length > 0) {
            let message = `✅ Downloaded Magento database to:\n   ${this.config.finalMessages.magentoDatabaseLocation}`;

            if (
                this.config.finalMessages.wordpressDatabaseLocation.length > 0 &&
                this.config.settings.wordpressDownload === 'yes' &&
                this.config.settings.wordpressImport !== 'yes'
            ) {
                message += `\n\n✅ Downloaded WordPress database to:\n   ${this.config.finalMessages.wordpressDatabaseLocation}`;
            }

            UI.box(message, { type: 'success', title: '📦 Download Complete' });
        }

        if (this.config.settings.wordpressImport === 'yes') {
            const message =
                `✅ WordPress successfully imported!\n\n` +
                `🔐 Backend Credentials:\n` +
                `   Username: ${configFile.magentoBackend.adminEmailAddress}\n` +
                `   Password: ${configFile.magentoBackend.adminPassword}`;

            UI.box(message, { type: 'success', title: '📝 WordPress Import Complete' });
        }

        // Show performance summary with speed improvements
        PerformanceMonitor.showSummary();
        
        // Log completion
        const logger = this.services.getLogger();
        logger.info('Operation completed successfully', { 
            component: 'StartController'
        });
    }

    askQuestions = async () => {
        UI.section('⚙️  Configuration');

        let databaseTypeQuestion = await new DatabaseTypeQuestion();
        await databaseTypeQuestion.configure(this.config);

        let selectDatabaseQuestion = await new SelectDatabaseQuestion();
        await selectDatabaseQuestion.configure(this.config);

        if (
            this.config.databases.databaseData &&
            this.config.databases.databaseData.stagingUsername &&
            this.config.databases.databaseDataSecond &&
            this.config.databases.databaseDataSecond.username &&
            this.config.settings.rsyncInstalled
        ) {
            let syncDatabaseQuestion = await new SyncDatabasesQuestions();
            await syncDatabaseQuestion.configure(this.config);
        }

        let downloadTypesQuestion = await new DownloadTypesQuestion();
        await downloadTypesQuestion.configure(this.config);

        let configurationQuestions = await new ConfigurationQuestions();
        await configurationQuestions.configure(this.config);
    };

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

        if (this.config.settings.import === 'yes') {
            const importTask = this.taskFactory.createImportTask();
            await importTask.configure(this.list, this.config);
        }

        if (this.config.settings.syncDatabases === 'yes') {
            const syncImportTask = this.taskFactory.createSyncImportTask();
            await syncImportTask.configure(this.list, this.config, this.sshSecondDatabase);
        }

        if (this.config.settings.import === 'yes') {
            const magentoConfigureTask = this.taskFactory.createMagentoConfigureTask();
            await magentoConfigureTask.configure(this.list, this.config);
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
