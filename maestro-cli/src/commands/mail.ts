import { Command } from 'commander';
import { api } from '../api.js';
import { config } from '../config.js';
import { outputJSON, outputTable, outputErrorJSON, outputKeyValue } from '../utils/formatter.js';
import { handleError } from '../utils/errors.js';
import { guardCommand } from '../services/command-permissions.js';
import ora from 'ora';

/**
 * Build structured body from --type and --message options.
 */
function buildBody(type: string, message?: string): Record<string, any> {
  const body: Record<string, any> = {};
  if (message) {
    switch (type) {
      case 'assignment':
        body.instructions = message;
        break;
      case 'status_update':
        body.message = message;
        break;
      case 'query':
        body.question = message;
        break;
      case 'response':
        body.answer = message;
        break;
      case 'directive':
        body.details = message;
        break;
      case 'notification':
        body.message = message;
        break;
      default:
        body.message = message;
    }
  }
  return body;
}

export function registerMailCommands(program: Command) {
  const mail = program.command('mail').description('Mailbox coordination system');

  // mail send <toSessionIds> — comma-separated session IDs or use --to-team-member
  mail.command('send [toSessionIds]')
    .description('Send mail to sessions (by ID) or team member (by --to-team-member)')
    .requiredOption('--type <type>', 'Message type (assignment, status_update, query, response, directive, notification)')
    .requiredOption('--subject <subject>', 'Mail subject')
    .option('--message <message>', 'Message body content')
    .option('--to-team-member <teamMemberId>', 'Send to active session(s) for this team member ID')
    .option('--task-id <taskId>', 'Task ID (for assignment/status_update/directive types)')
    .option('--priority <priority>', 'Priority (for assignment type)')
    .option('--status <status>', 'Status (for status_update type)')
    .option('--action <action>', 'Action (for directive type)')
    .option('--reply-to <mailId>', 'Reply to a specific mail ID')
    .action(async (toSessionIds: string | undefined, cmdOpts: any) => {
      await guardCommand('mail:send');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;

      const sessionId = config.sessionId;
      const projectId = globalOpts.project || config.projectId;

      if (!sessionId) {
        const err = { message: 'No session context found (MAESTRO_SESSION_ID not set).' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      if (!projectId) {
        const err = { message: 'No project context found (MAESTRO_PROJECT_ID not set).' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      // Either session IDs or --to-team-member must be provided
      const teamMemberId = cmdOpts.toTeamMember;
      if (!toSessionIds && !teamMemberId) {
        const err = { message: 'Either session IDs or --to-team-member is required.' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      const spinner = !isJson ? ora(teamMemberId ? `Sending mail to team member ${teamMemberId}...` : `Sending mail...`).start() : null;

      try {
        const body = buildBody(cmdOpts.type, cmdOpts.message);

        // Add optional structured fields
        if (cmdOpts.taskId) body.task_id = cmdOpts.taskId;
        if (cmdOpts.priority) body.priority = cmdOpts.priority;
        if (cmdOpts.status) body.status = cmdOpts.status;
        if (cmdOpts.action) body.action = cmdOpts.action;

        if (teamMemberId) {
          // Send via team member ID — server resolves to session(s)
          const result = await api.post('/api/mail', {
            projectId,
            fromSessionId: sessionId,
            toTeamMemberId: teamMemberId,
            replyToMailId: cmdOpts.replyTo || null,
            type: cmdOpts.type,
            subject: cmdOpts.subject,
            body,
          });

          spinner?.succeed('Mail sent to team member');

          if (isJson) {
            outputJSON(result);
          } else {
            const results = Array.isArray(result) ? result : [result];
            for (const r of results) {
              outputKeyValue('Mail ID', r.id);
              outputKeyValue('To', r.toSessionId);
            }
            outputKeyValue('Type', cmdOpts.type);
            outputKeyValue('Subject', cmdOpts.subject);
          }
        } else {
          // Send by session IDs
          const ids = (toSessionIds as string).split(',').map(s => s.trim()).filter(Boolean);
          if (ids.length === 0) {
            spinner?.stop();
            const err = { message: 'At least one session ID is required.' };
            if (isJson) { outputErrorJSON(err); process.exit(1); }
            else { console.error(err.message); process.exit(1); }
          }

          const results: any[] = [];
          for (const toId of ids) {
            const result = await api.post('/api/mail', {
              projectId,
              fromSessionId: sessionId,
              toSessionId: toId,
              replyToMailId: cmdOpts.replyTo || null,
              type: cmdOpts.type,
              subject: cmdOpts.subject,
              body,
            });
            results.push(result);
          }

          spinner?.succeed(`Mail sent to ${ids.length} session(s)`);

          if (isJson) {
            outputJSON(results.length === 1 ? results[0] : results);
          } else {
            for (const result of results) {
              outputKeyValue('Mail ID', result.id);
              outputKeyValue('To', result.toSessionId);
            }
            outputKeyValue('Type', cmdOpts.type);
            outputKeyValue('Subject', cmdOpts.subject);
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // mail inbox
  mail.command('inbox')
    .description('List inbox for current session')
    .option('--type <type>', 'Filter by message type')
    .action(async (cmdOpts: any) => {
      await guardCommand('mail:inbox');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;

      const sessionId = config.sessionId;
      const projectId = globalOpts.project || config.projectId;

      if (!sessionId) {
        const err = { message: 'No session context found (MAESTRO_SESSION_ID not set).' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      const spinner = !isJson ? ora('Fetching inbox...').start() : null;

      try {
        let endpoint = `/api/mail/inbox/${sessionId}`;
        const queryParts: string[] = [];
        if (projectId) queryParts.push(`projectId=${projectId}`);
        if (cmdOpts.type) queryParts.push(`type=${cmdOpts.type}`);
        if (queryParts.length) endpoint += '?' + queryParts.join('&');

        const messages: any[] = await api.get(endpoint);

        spinner?.stop();

        if (isJson) {
          outputJSON(messages);
        } else {
          if (messages.length === 0) {
            console.log('No mail in inbox.');
          } else {
            outputTable(
              ['ID', 'Type', 'From', 'Subject', 'Time'],
              messages.map(m => [
                m.id,
                m.type,
                m.fromSessionId.substring(0, 20),
                m.subject.substring(0, 40),
                new Date(m.createdAt).toLocaleTimeString(),
              ])
            );
          }
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // mail reply <mailId>
  mail.command('reply <mailId>')
    .description('Reply to a mail')
    .requiredOption('--message <message>', 'Reply message')
    .action(async (mailId: string, cmdOpts: any) => {
      await guardCommand('mail:reply');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;

      const sessionId = config.sessionId;
      const projectId = globalOpts.project || config.projectId;

      if (!sessionId || !projectId) {
        const err = { message: 'No session/project context found.' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      const spinner = !isJson ? ora('Sending reply...').start() : null;

      try {
        // First, fetch the original mail to get the sender
        const original: any = await api.get(`/api/mail/${mailId}`);

        const result = await api.post('/api/mail', {
          projectId,
          fromSessionId: sessionId,
          toSessionId: original.fromSessionId,
          replyToMailId: mailId,
          type: 'response',
          subject: `Re: ${original.subject}`,
          body: { answer: cmdOpts.message },
        });

        spinner?.succeed('Reply sent');

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('Mail ID', (result as any).id);
          outputKeyValue('Reply To', mailId);
          outputKeyValue('To', original.fromSessionId);
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // mail broadcast
  mail.command('broadcast')
    .description('Send to all sessions in the project')
    .requiredOption('--type <type>', 'Message type')
    .requiredOption('--subject <subject>', 'Mail subject')
    .option('--message <message>', 'Message body content')
    .action(async (cmdOpts: any) => {
      await guardCommand('mail:broadcast');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;

      const sessionId = config.sessionId;
      const projectId = globalOpts.project || config.projectId;

      if (!sessionId || !projectId) {
        const err = { message: 'No session/project context found.' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      const spinner = !isJson ? ora('Broadcasting mail...').start() : null;

      try {
        const body = buildBody(cmdOpts.type, cmdOpts.message);

        const result = await api.post('/api/mail', {
          projectId,
          fromSessionId: sessionId,
          toSessionId: null, // broadcast
          type: cmdOpts.type,
          subject: cmdOpts.subject,
          body,
        });

        spinner?.succeed('Mail broadcast sent');

        if (isJson) {
          outputJSON(result);
        } else {
          outputKeyValue('Mail ID', (result as any).id);
          outputKeyValue('To', 'broadcast (all sessions)');
          outputKeyValue('Type', cmdOpts.type);
          outputKeyValue('Subject', cmdOpts.subject);
        }
      } catch (err) {
        spinner?.stop();
        handleError(err, isJson);
      }
    });

  // mail wait
  mail.command('wait')
    .description('Long-poll, block until mail arrives')
    .option('--timeout <ms>', 'Timeout in milliseconds (max 120000)', '30000')
    .option('--since <timestamp>', 'Only return mail since this timestamp')
    .action(async (cmdOpts: any) => {
      await guardCommand('mail:wait');
      const globalOpts = program.opts();
      const isJson = globalOpts.json;

      const sessionId = config.sessionId;
      const projectId = globalOpts.project || config.projectId;

      if (!sessionId || !projectId) {
        const err = { message: 'No session/project context found.' };
        if (isJson) { outputErrorJSON(err); process.exit(1); }
        else { console.error(err.message); process.exit(1); }
      }

      if (!isJson) {
        console.log(`[mail:wait] Waiting for mail (timeout: ${cmdOpts.timeout}ms)...`);
      }

      try {
        let endpoint = `/api/mail/wait/${sessionId}`;
        const queryParts: string[] = [];
        if (projectId) queryParts.push(`projectId=${projectId}`);
        if (cmdOpts.timeout) queryParts.push(`timeout=${cmdOpts.timeout}`);
        if (cmdOpts.since) queryParts.push(`since=${cmdOpts.since}`);
        if (queryParts.length) endpoint += '?' + queryParts.join('&');

        const messages: any[] = await api.get(endpoint);

        if (isJson) {
          outputJSON(messages);
        } else {
          if (messages.length === 0) {
            console.log('[mail:wait] Timeout — no new mail arrived.');
          } else {
            console.log(`[mail:wait] Received ${messages.length} message(s):`);
            for (const m of messages) {
              console.log(`  [${m.type}] ${m.subject} (from ${m.fromSessionId.substring(0, 20)})`);
            }
          }
        }
      } catch (err) {
        handleError(err, isJson);
      }
    });
}
