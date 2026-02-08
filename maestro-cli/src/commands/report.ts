import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

/**
 * Report subcommand definitions mapping subcommand name to sessionStatus and timeline event type.
 */
interface ReportSubcommand {
  sessionStatus: string;
  timelineType: string;
}

const REPORT_SUBCOMMANDS: Record<string, ReportSubcommand> = {
  progress: { sessionStatus: 'working', timelineType: 'progress' },
  complete: { sessionStatus: 'completed', timelineType: 'task_completed' },
  blocked: { sessionStatus: 'blocked', timelineType: 'task_blocked' },
  error: { sessionStatus: 'failed', timelineType: 'error' },
  'needs-input': { sessionStatus: 'needs_input', timelineType: 'needs_input' },
};

/**
 * Core report logic: optionally updates sessionStatus on targeted tasks and posts a timeline event to the session.
 *
 * - If taskIds provided: updates sessionStatus on each task + posts timeline event per task
 * - If no taskIds: posts timeline event to session only (no task sessionStatus change)
 * - Special: report complete without taskIds also marks the session as completed
 */
export async function executeReport(
  subcommand: string,
  message: string,
  opts: { json?: boolean },
  taskIds?: string[]
): Promise<void> {
  const isJson = !!opts.json;
  const sessionId = config.sessionId;

  const def = REPORT_SUBCOMMANDS[subcommand];
  if (!def) {
    throw new Error(`Unknown report subcommand: ${subcommand}`);
  }

  if (!sessionId) {
    if (isJson) {
      console.log(JSON.stringify({ success: false, error: 'no_session', message: 'No session context found. MAESTRO_SESSION_ID must be set.' }));
    } else {
      console.error('Error: No session context found. MAESTRO_SESSION_ID must be set.');
    }
    process.exit(1);
  }

  const spinner = !isJson ? ora(`Reporting ${subcommand}...`).start() : null;

  try {
    if (taskIds && taskIds.length > 0) {
      // Update sessionStatus on each specified task + post timeline event per task
      for (const taskId of taskIds) {
        await api.patch(`/api/tasks/${taskId}`, {
          sessionStatus: def.sessionStatus,
          updateSource: 'session',
          sessionId,
        });

        await api.post(`/api/sessions/${sessionId}/timeline`, {
          type: def.timelineType,
          message,
          taskId,
        });
      }
    } else {
      // No task targeting: post session timeline event only
      await api.post(`/api/sessions/${sessionId}/timeline`, {
        type: def.timelineType,
        message,
      });

      // Special case: report complete without --task also marks session as completed
      if (subcommand === 'complete') {
        await api.patch(`/api/sessions/${sessionId}`, {
          status: 'completed',
        });
      }
    }

    spinner?.succeed(`${subcommand} reported`);

    if (isJson) {
      outputJSON({
        success: true,
        subcommand,
        taskIds: taskIds || [],
        sessionId,
        sessionStatus: taskIds && taskIds.length > 0 ? def.sessionStatus : undefined,
        sessionCompleted: subcommand === 'complete' && (!taskIds || taskIds.length === 0),
      });
    }
  } catch (err: any) {
    spinner?.fail(`Failed to report ${subcommand}`);
    handleError(err, isJson);
  }
}

/**
 * Parse comma-separated task IDs from --task option
 */
function parseTaskIds(taskOption?: string): string[] | undefined {
  if (!taskOption) return undefined;
  return taskOption.split(',').map(id => id.trim()).filter(Boolean);
}

/**
 * Register the `maestro report <subcommand>` command group.
 */
export function registerReportCommands(program: Command) {
  const report = program.command('report').description('Report session status updates');

  // report progress <message>
  report.command('progress <message>')
    .description('Report work progress')
    .option('--task <ids>', 'Comma-separated task IDs to update sessionStatus on')
    .action(async (message: string, cmdOpts: any) => {
      await guardCommand('report:progress');
      await executeReport('progress', message, program.opts(), parseTaskIds(cmdOpts.task));
    });

  // report complete <summary>
  report.command('complete <summary>')
    .description('Report task completion. Without --task, also marks session as completed.')
    .option('--task <ids>', 'Comma-separated task IDs to update sessionStatus on')
    .action(async (summary: string, cmdOpts: any) => {
      await guardCommand('report:complete');
      await executeReport('complete', summary, program.opts(), parseTaskIds(cmdOpts.task));
    });

  // report blocked <reason>
  report.command('blocked <reason>')
    .description('Report blocker')
    .option('--task <ids>', 'Comma-separated task IDs to update sessionStatus on')
    .action(async (reason: string, cmdOpts: any) => {
      await guardCommand('report:blocked');
      await executeReport('blocked', reason, program.opts(), parseTaskIds(cmdOpts.task));
    });

  // report error <description>
  report.command('error <description>')
    .description('Report error encountered')
    .option('--task <ids>', 'Comma-separated task IDs to update sessionStatus on')
    .action(async (description: string, cmdOpts: any) => {
      await guardCommand('report:error');
      await executeReport('error', description, program.opts(), parseTaskIds(cmdOpts.task));
    });

  // report needs-input <question>
  report.command('needs-input <question>')
    .description('Request user input')
    .option('--task <ids>', 'Comma-separated task IDs to update sessionStatus on')
    .action(async (question: string, cmdOpts: any) => {
      await guardCommand('report:needs-input');
      await executeReport('needs-input', question, program.opts(), parseTaskIds(cmdOpts.task));
    });
}
