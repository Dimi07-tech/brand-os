import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ExportRunner } from './export-runner.js';
import { EXPORTS_QUEUE, type ExportJob } from './exports.service.js';

/** Consommateur de la file d'exports (2 exports en parallèle par processus). */
@Processor(EXPORTS_QUEUE, { concurrency: 2 })
export class ExportsProcessor extends WorkerHost {
  constructor(private readonly runner: ExportRunner) {
    super();
  }

  async process(job: Job<ExportJob>): Promise<void> {
    try {
      await this.runner.run(job.data.exportId, job.data.organizationId);
    } catch (err) {
      const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (lastAttempt) await this.runner.markFailed(job.data.exportId, job.data.organizationId, err as Error);
      throw err;
    }
  }
}
