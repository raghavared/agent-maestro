import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

/**
 * Report subcommand definitions mapping subcommand name to timeline event type.
 */
interface ReportSubcommand {
  timelineType: string;
}

const REPORT_SUBCOMMANDS: Record<string, ReportSubcommand> = {
  progress: { timelineType: 'progress' },
  complete: { timelineType: 'task_completed' },
  blocked: { timelineType: 'task_blocked' },
  error: { timelineType: 'error' },
};

/**
 * Core report logic: posts a timeline event to the session.
 * Special case: report complete also marks the session as completed.
 */
export async function executeReport(
  subcommand: string,
  message: string,
  opts: { json?: boolean },
): Promise<void> {
  const isJson = !!opts.json;
  const sessionId = config.sessionId;

  const def = REPORT_SUBCOMMANDS[subcommand];
  if (!def) {
    throw new Error(`Unknown report subcommand: ${subcommand}`);
  }

  if (!sessionId) {
    process.exit(1);
  }

  const spinner = !isJson ? ora(`Reporting ${subcommand}...`).start() : null;

  try {
    // Post session timeline event
    await api.post(`/api/sessions/${sessionId}/timeline`, {
      type: def.timelineType,
      message,
    });

    // Special case: report complete also marks session as completed
    if (subcommand === 'complete') {
      await api.patch(`/api/sessions/${sessionId}`, {
        status: 'completed',
      });
    }

    spinner?.succeed(`${subcommand} reported`);

    if (isJson) {
      outputJSON({
        success: true,
        subcommand,
        sessionId,
        sessionCompleted: subcommand === 'complete',
      });
    }
  } catch (err: any) {
    spinner?.fail(`Failed to report ${subcommand}`);
    handleError(err, isJson);
  }
}

/**
 * Register the `maestro report <subcommand>` command group.
 */
export function registerReportCommands(program: Command) {
  const report = program.command('report').description('Report session status updates');

  // report progress <message>
  report.command('progress <message>')
    .description('Report work progress')
    .action(async (message: string) => {
      await guardCommand('report:progress');
      await executeReport('progress', message, program.opts());
    });

  // report complete <summary>
  report.command('complete <summary>')
    .description('Report completion and mark session as completed')
    .action(async (summary: string) => {
      await guardCommand('report:complete');
      await executeReport('complete', summary, program.opts());
    });

  // report blocked <reason>
  report.command('blocked <reason>')
    .description('Report blocker')
    .action(async (reason: string) => {
      await guardCommand('report:blocked');
      await executeReport('blocked', reason, program.opts());
    });

  // report error <description>
  report.command('error <description>')
    .description('Report error encountered')
    .action(async (description: string) => {
      await guardCommand('report:error');
      await executeReport('error', description, program.opts());
    });
}
