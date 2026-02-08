import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputKeyValue, outputTable } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

/**
 * Register queue commands for managing session task queues.
 *
 * Queue commands are only available for sessions using the 'queue' strategy.
 * They provide FIFO task processing capabilities.
 */
export function registerQueueCommands(program: Command) {
  const queue = program.command('queue').description('Queue operations (queue strategy sessions only)');

  // Get session ID from context or error
  const getSessionId = (): string => {
    const sessionId = config.sessionId;
    if (!sessionId) {
      throw new Error('No session context. MAESTRO_SESSION_ID must be set.');
    }
    return sessionId;
  };

  // maestro queue top - Show next task in queue
  queue.command('top')
    .description('Show the next task in the queue')
    .action(async () => {
      await guardCommand('queue:top');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Fetching next task...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.get(`/api/sessions/${sessionId}/queue/top`);

        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          if (!result.hasMore) {
            console.log('\n  Queue is empty - all tasks processed');
            console.log('');
          } else {
            console.log('\n  Next Task in Queue:');
            console.log(`    ID:     ${result.item.taskId}`);
            console.log(`    Status: ${result.item.status}`);
            console.log(`    Added:  ${new Date(result.item.addedAt).toLocaleString()}`);
            console.log('');
            console.log('  Run "maestro queue start" to begin processing this task.');
            console.log('');
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue start - Start processing the next task (blocks and polls if queue is empty)
  queue.command('start')
    .description('Start processing the next task in the queue (waits if empty)')
    .option('--poll-interval <seconds>', 'Seconds between polls when queue is empty', '10')
    .option('--poll-timeout <minutes>', 'Max minutes to wait for new tasks (0=forever)', '30')
    .action(async (cmdOpts) => {
      await guardCommand('queue:start');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const sessionId = getSessionId();
      const pollInterval = parseInt(cmdOpts.pollInterval) * 1000;
      const pollTimeout = parseInt(cmdOpts.pollTimeout) * 60 * 1000;
      const startTime = Date.now();

      const spinner = !isJson ? ora('Starting next task...').start() : null;

      // Handle graceful shutdown
      let stopped = false;
      const onSignal = () => { stopped = true; };
      process.on('SIGINT', onSignal);
      process.on('SIGTERM', onSignal);

      try {
        // First attempt — try to start immediately
        const result: any = await api.post(`/api/sessions/${sessionId}/queue/start`, {});

        if (result.item) {
          spinner?.succeed('Task started');

          if (isJson) {
            outputJSON(result);
          } else {
            console.log('');
            console.log(`  Now Processing: ${result.item.taskId}`);
            console.log(`  Started At:     ${new Date(result.item.startedAt).toLocaleString()}`);
            console.log('');
            console.log('  When done, run:');
            console.log('    maestro queue complete  - Mark as completed');
            console.log('    maestro queue fail      - Mark as failed');
            console.log('    maestro queue skip      - Skip this task');
            console.log('');
          }
          return;
        }

        // Queue is empty — enter polling mode
        if (spinner) {
          spinner.text = `Queue empty. Polling every ${cmdOpts.pollInterval}s for new tasks...`;
        }

        if (!isJson) {
          console.log('');
          console.log(`  Queue is empty. Polling every ${cmdOpts.pollInterval}s for new tasks (timeout: ${cmdOpts.pollTimeout}m)...`);
        }

        while (!stopped) {
          // Check timeout
          if (pollTimeout > 0 && (Date.now() - startTime) > pollTimeout) {
            spinner?.fail('Timed out waiting for new tasks');
            if (isJson) {
              outputJSON({ success: false, timedOut: true, message: 'No new tasks after timeout' });
            } else {
              console.log('');
              console.log(`  No new tasks after ${cmdOpts.pollTimeout} minutes.`);
              console.log('  Run "maestro report complete" to finish this session.');
              console.log('');
            }
            process.exit(1);
          }

          // Wait before next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          if (stopped) break;

          // Poll for new items
          try {
            const topResult: any = await api.get(`/api/sessions/${sessionId}/queue/top`);

            if (topResult.hasMore) {
              // New task available — claim it
              const startResult: any = await api.post(`/api/sessions/${sessionId}/queue/start`, {});

              if (startResult.item) {
                spinner?.succeed('New task started');
                if (isJson) {
                  outputJSON(startResult);
                } else {
                  console.log('');
                  console.log(`  Now Processing: ${startResult.item.taskId}`);
                  console.log(`  Started At:     ${new Date(startResult.item.startedAt).toLocaleString()}`);
                  console.log('');
                  console.log('  When done, run:');
                  console.log('    maestro queue complete  - Mark as completed');
                  console.log('    maestro queue fail      - Mark as failed');
                  console.log('    maestro queue skip      - Skip this task');
                  console.log('');
                }
                return;
              }
            }
          } catch (pollErr: any) {
            // Network error during poll — log and continue
            if (spinner) {
              spinner.text = `Poll failed (${pollErr.message}). Retrying in ${cmdOpts.pollInterval}s...`;
            }
          }
        }

        // Stopped via signal
        spinner?.stop();
        if (!isJson) {
          console.log('');
          console.log('  Polling stopped.');
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      } finally {
        process.removeListener('SIGINT', onSignal);
        process.removeListener('SIGTERM', onSignal);
      }
    });

  // maestro queue complete - Complete current task
  queue.command('complete')
    .description('Mark the current task as completed')
    .action(async () => {
      await guardCommand('queue:complete');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Completing task...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.post(`/api/sessions/${sessionId}/queue/complete`, {});

        spinner?.succeed('Task completed');

        if (isJson) {
          outputJSON(result);
        } else {
          console.log('');
          console.log(`  Completed: ${result.completedItem.taskId}`);
          if (result.hasMore) {
            console.log(`  Next Task: ${result.nextItem.taskId}`);
            console.log('');
            console.log('  Run "maestro queue start" to begin the next task.');
          } else {
            console.log('');
            console.log('  Queue is empty - all tasks processed!');
          }
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue fail - Mark current task as failed
  queue.command('fail')
    .description('Mark the current task as failed')
    .option('--reason <reason>', 'Reason for failure')
    .action(async (cmdOpts) => {
      await guardCommand('queue:fail');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Marking task as failed...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.post(`/api/sessions/${sessionId}/queue/fail`, {
          reason: cmdOpts.reason
        });

        spinner?.succeed('Task marked as failed');

        if (isJson) {
          outputJSON(result);
        } else {
          console.log('');
          console.log(`  Failed: ${result.failedItem.taskId}`);
          if (cmdOpts.reason) {
            console.log(`  Reason: ${cmdOpts.reason}`);
          }
          if (result.hasMore) {
            console.log(`  Next Task: ${result.nextItem.taskId}`);
            console.log('');
            console.log('  Run "maestro queue start" to begin the next task.');
          } else {
            console.log('');
            console.log('  Queue is empty - all tasks processed.');
          }
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue skip - Skip current/next task
  queue.command('skip')
    .description('Skip the current or next task in the queue')
    .action(async () => {
      await guardCommand('queue:skip');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Skipping task...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.post(`/api/sessions/${sessionId}/queue/skip`, {});

        spinner?.succeed('Task skipped');

        if (isJson) {
          outputJSON(result);
        } else {
          console.log('');
          console.log(`  Skipped: ${result.skippedItem.taskId}`);
          if (result.hasMore) {
            console.log(`  Next Task: ${result.nextItem.taskId}`);
            console.log('');
            console.log('  Run "maestro queue start" to begin the next task.');
          } else {
            console.log('');
            console.log('  Queue is empty - all tasks processed.');
          }
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue list - List all items in queue
  queue.command('list')
    .description('List all items in the queue')
    .action(async () => {
      await guardCommand('queue:list');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Fetching queue...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.get(`/api/sessions/${sessionId}/queue/items`);

        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          const { items, stats } = result;

          console.log('\n  Queue Status:');
          console.log(`    Total:      ${stats.total}`);
          console.log(`    Queued:     ${stats.queued}`);
          console.log(`    Processing: ${stats.processing}`);
          console.log(`    Completed:  ${stats.completed}`);
          console.log(`    Failed:     ${stats.failed}`);
          console.log(`    Skipped:    ${stats.skipped}`);
          console.log('');

          if (items.length === 0) {
            console.log('  No items in queue.');
          } else {
            console.log('  Items:');
            console.log('  ---------------------------------------------------------------');

            items.forEach((item: any, index: number) => {
              const statusIcon =
                item.status === 'queued' ? '○' :
                item.status === 'processing' ? '●' :
                item.status === 'completed' ? '✓' :
                item.status === 'failed' ? '✗' :
                item.status === 'skipped' ? '⊘' : '?';

              const statusColor =
                item.status === 'queued' ? '' :
                item.status === 'processing' ? '\x1b[33m' :
                item.status === 'completed' ? '\x1b[32m' :
                item.status === 'failed' ? '\x1b[31m' :
                item.status === 'skipped' ? '\x1b[90m' : '';

              const reset = '\x1b[0m';

              console.log(`  ${index + 1}. ${statusColor}${statusIcon} ${item.taskId} (${item.status})${reset}`);
            });
          }
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue push - Add a task to the queue
  queue.command('push')
    .description('Add a task to the queue')
    .argument('<taskId>', 'Task ID to add to the queue')
    .action(async (taskId: string) => {
      await guardCommand('queue:push');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Adding task to queue...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.post(`/api/sessions/${sessionId}/queue/push`, { taskId });

        spinner?.succeed('Task added to queue');

        if (isJson) {
          outputJSON(result);
        } else {
          console.log('');
          console.log(`  Added task ${taskId} to queue.`);
          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // maestro queue status - Show queue status summary
  queue.command('status')
    .description('Show queue status summary')
    .action(async () => {
      await guardCommand('queue:status');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;
      const spinner = !isJson ? ora('Fetching queue status...').start() : null;

      try {
        const sessionId = getSessionId();
        const result: any = await api.get(`/api/sessions/${sessionId}/queue`);

        spinner?.stop();

        if (isJson) {
          outputJSON(result);
        } else {
          const { queue, stats } = result;

          console.log('\n  Queue Strategy Session');
          console.log('  ----------------------');
          console.log(`  Session ID: ${queue.sessionId}`);
          console.log(`  Created:    ${new Date(queue.createdAt).toLocaleString()}`);
          console.log(`  Updated:    ${new Date(queue.updatedAt).toLocaleString()}`);
          console.log('');
          console.log('  Progress:');
          console.log(`    Total:      ${stats.total}`);
          console.log(`    Remaining:  ${stats.queued}`);
          console.log(`    Completed:  ${stats.completed}`);
          console.log(`    Failed:     ${stats.failed}`);
          console.log(`    Skipped:    ${stats.skipped}`);

          if (stats.processing > 0) {
            const currentItem = queue.items[queue.currentIndex];
            console.log('');
            console.log(`  Currently Processing: ${currentItem?.taskId}`);
          }

          console.log('');
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });
}
