/**
 * TaskFactory - Factory for creating tasks with dependency injection
 * 
 * Features:
 * - Creates task instances with injected dependencies
 * - Centralized task creation
 * - Easy to test and mock
 */

import { ServiceContainer } from './ServiceContainer';
import ChecksTask from '../tasks/ChecksTask';
import DownloadTask from '../tasks/DownloadTask';
import ImportTask from '../tasks/ImportTask';
import MagentoConfigureTask from '../tasks/MagentoConfigureTask';
import WordpressConfigureTask from '../tasks/WordpressConfigureTask';
import SyncImportTask from '../tasks/SyncImportTask';

export class TaskFactory {
    private static instance: TaskFactory;
    private container: ServiceContainer;

    private constructor() {
        this.container = ServiceContainer.getInstance();
    }

    public static getInstance(): TaskFactory {
        if (!TaskFactory.instance) {
            TaskFactory.instance = new TaskFactory();
        }
        return TaskFactory.instance;
    }

    /**
     * Create ChecksTask instance
     */
    public createChecksTask(): ChecksTask {
        return new ChecksTask();
    }

    /**
     * Create DownloadTask instance
     */
    public createDownloadTask(): DownloadTask {
        return new DownloadTask();
    }

    /**
     * Create ImportTask instance
     */
    public createImportTask(): ImportTask {
        return new ImportTask();
    }

    /**
     * Create MagentoConfigureTask instance
     */
    public createMagentoConfigureTask(): MagentoConfigureTask {
        return new MagentoConfigureTask();
    }

    /**
     * Create WordpressConfigureTask instance
     */
    public createWordpressConfigureTask(): WordpressConfigureTask {
        return new WordpressConfigureTask();
    }

    /**
     * Create SyncImportTask instance
     */
    public createSyncImportTask(): SyncImportTask {
        return new SyncImportTask();
    }
}
