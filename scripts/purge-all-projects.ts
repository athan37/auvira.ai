/**
 * Purge ALL WebsiteProject documents and related Mongo data (messages, edit jobs,
 * clone jobs, catalog, analytics, site health, etc.).
 *
 * Does NOT delete User accounts.
 *
 * IRREVERSIBLE with --execute. Default is dry-run.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/purge-all-projects.ts
 *   npx tsx --env-file=.env scripts/purge-all-projects.ts --execute
 */
import mongoose from 'mongoose';
import { WebsiteProject } from '../src/models/WebsiteProject';
import { ProjectMessage } from '../src/models/ProjectMessage';
import { ProjectEditJob } from '../src/models/ProjectEditJob';
import { ProjectAction } from '../src/models/ProjectAction';
import { WebsiteProjectLog } from '../src/models/WebsiteProjectLog';
import { BusinessProfile } from '../src/models/BusinessProfile';
import { WebsiteAnalyticsConfig } from '../src/models/WebsiteAnalyticsConfig';
import { SiteHealthIncident } from '../src/models/SiteHealthIncident';
import { OwnerMonitor } from '../src/models/OwnerMonitor';
import { Product } from '../src/models/Product';
import { SiteFixProposal } from '../src/models/SiteFixProposal';
import { AnalyticsEventBatch } from '../src/models/AnalyticsEventBatch';
import { ComponentAnalyticsTotal } from '../src/models/ComponentAnalyticsTotal';
import { ComponentAnalyticsWeekly } from '../src/models/ComponentAnalyticsWeekly';
import { CloneJob } from '../src/lib/db/models/CloneJob';

const execute = process.argv.includes('--execute');

type DeleteCounts = Record<string, number>;

/** Delete all rows in project-scoped collections, then WebsiteProject. */
async function purgeAllProjectData(): Promise<DeleteCounts> {
  const counts: DeleteCounts = {};

  const ops: Array<[string, () => Promise<{ deletedCount?: number }>]> = [
    ['ProjectMessage', () => ProjectMessage.deleteMany({})],
    ['ProjectEditJob', () => ProjectEditJob.deleteMany({})],
    ['ProjectAction', () => ProjectAction.deleteMany({})],
    ['WebsiteProjectLog', () => WebsiteProjectLog.deleteMany({})],
    ['BusinessProfile', () => BusinessProfile.deleteMany({})],
    ['WebsiteAnalyticsConfig', () => WebsiteAnalyticsConfig.deleteMany({})],
    ['SiteHealthIncident', () => SiteHealthIncident.deleteMany({})],
    ['OwnerMonitor', () => OwnerMonitor.deleteMany({})],
    ['Product', () => Product.deleteMany({})],
    ['SiteFixProposal', () => SiteFixProposal.deleteMany({})],
    ['AnalyticsEventBatch', () => AnalyticsEventBatch.deleteMany({})],
    ['ComponentAnalyticsTotal', () => ComponentAnalyticsTotal.deleteMany({})],
    ['ComponentAnalyticsWeekly', () => ComponentAnalyticsWeekly.deleteMany({})],
    ['CloneJob', () => CloneJob.deleteMany({})],
    ['WebsiteProject', () => WebsiteProject.deleteMany({})],
  ];

  for (const [name, run] of ops) {
    const result = await run();
    counts[name] = result.deletedCount ?? 0;
  }

  return counts;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required (use: npx tsx --env-file=.env ...)');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const [projectCount, cloneJobCount, messageCount] = await Promise.all([
    WebsiteProject.countDocuments({}),
    CloneJob.countDocuments({}),
    ProjectMessage.countDocuments({}),
  ]);

  console.log('\nMongo project data (preview):');
  console.log(`  WebsiteProject: ${projectCount}`);
  console.log(`  CloneJob: ${cloneJobCount}`);
  console.log(`  ProjectMessage: ${messageCount}`);

  if (projectCount === 0 && cloneJobCount === 0) {
    console.log('\nNothing to purge.');
    await mongoose.disconnect();
    return;
  }

  if (!execute) {
    console.log('\nDry-run only. Re-run with --execute to delete permanently.');
    console.log('User accounts are NOT deleted.');
    await mongoose.disconnect();
    return;
  }

  const counts = await purgeAllProjectData();

  console.log('\nDeleted:');
  for (const [collection, count] of Object.entries(counts)) {
    console.log(`  ${collection}: ${count}`);
  }

  await mongoose.disconnect();
  console.log('\nPurge complete. User accounts preserved.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
