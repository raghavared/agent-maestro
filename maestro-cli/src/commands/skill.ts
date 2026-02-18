import { Command } from 'commander';
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { SkillLoader, SkillInfo } from '../services/skill-loader.js';
import { outputJSON, outputTable } from '../utils/formatter.js';

/**
 * Build a SkillLoader from command options
 */
function buildLoader(cmdOpts: any): SkillLoader {
  const projectPath = cmdOpts.projectPath || undefined;
  return new SkillLoader(projectPath);
}

/**
 * Register skill management commands
 *
 * Provides:
 * - `maestro skill list` - List all available skills (grouped by scope)
 * - `maestro skill info <name>` - Get details about a specific skill
 * - `maestro skill validate` - Validate all skills across all scopes
 * - `maestro skill install <repo>` - Install a skill from a GitHub repo
 * - `maestro skill browse [query]` - Browse skills on skills.sh
 *
 * All commands support `--json` flag for JSON output.
 *
 * @param program - The commander program instance
 */
export function registerSkillCommands(program: Command): void {
  const skillCommand = program
    .command('skill')
    .description('Manage Claude Code and Agent skills');

  // skill list
  skillCommand
    .command('list')
    .description('List all available skills')
    .option('--project-path <path>', 'Path to the project root for project-scoped skills')
    .option('--scope <scope>', 'Filter by scope: project, global, or all', 'all')
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const loader = buildLoader(cmdOpts);
      let skills = await loader.discover();

      // Apply scope filter
      if (cmdOpts.scope === 'project') {
        skills = skills.filter(s => s.scope === 'project');
      } else if (cmdOpts.scope === 'global') {
        skills = skills.filter(s => s.scope === 'global');
      }

      if (globalOpts.json) {
        outputJSON(skills);
        return;
      }

      if (skills.length === 0) {
        console.log('\nNo skills found.');
        if (!cmdOpts.projectPath) {
          console.log(chalk.gray('  Tip: Use --project-path to include project-scoped skills'));
        }
        console.log('');
        return;
      }

      const projectSkills = skills.filter(s => s.scope === 'project');
      const globalSkills = skills.filter(s => s.scope === 'global');

      if (projectSkills.length > 0) {
        console.log(chalk.bold('\n  PROJECT SKILLS'));
        printSkillTable(projectSkills);
      }

      if (globalSkills.length > 0) {
        console.log(chalk.bold('\n  GLOBAL SKILLS'));
        printSkillTable(globalSkills);
      }

      console.log('');
    });

  // skill info <name>
  skillCommand
    .command('info <name>')
    .description('Get details about a specific skill')
    .option('--project-path <path>', 'Path to the project root for project-scoped skills')
    .action(async (name: string, cmdOpts) => {
      const globalOpts = program.opts();
      const loader = buildLoader(cmdOpts);
      const info = await loader.getSkillInfo(name);

      if (!info) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ success: false, error: `Skill not found: ${name}` }, null, 2));
        } else {
          console.error(`Skill not found: ${name}`);
        }
        return;
      }

      if (globalOpts.json) {
        outputJSON(info);
      } else {
        console.log('');
        console.log(`  ${chalk.bold('Skill:')}   ${info.name}`);
        console.log(`  ${chalk.bold('Path:')}    ${info.path}`);
        console.log(`  ${chalk.bold('Valid:')}   ${info.valid ? 'Yes' : 'No'}`);
        console.log(`  ${chalk.bold('Scope:')}   ${info.scope}`);
        console.log(`  ${chalk.bold('Source:')}  ${info.source}`);
        if (info.description) {
          console.log(`  ${chalk.bold('Desc:')}    ${info.description}`);
        }
        console.log('');
      }
    });

  // skill validate
  skillCommand
    .command('validate')
    .description('Validate all skills across all scopes')
    .option('--project-path <path>', 'Path to the project root for project-scoped skills')
    .action(async (cmdOpts) => {
      const globalOpts = program.opts();
      const loader = buildLoader(cmdOpts);
      // Use discoverAll to get all skills without deduplication
      const skills = await loader.discoverAll();

      const valid = skills.filter(s => s.valid);
      const invalid = skills.filter(s => !s.valid);

      if (globalOpts.json) {
        outputJSON({ valid, invalid, summary: { valid: valid.length, invalid: invalid.length } });
        return;
      }

      console.log(chalk.bold('\n  Validating skills...\n'));

      const projectSkills = skills.filter(s => s.scope === 'project');
      const globalSkills = skills.filter(s => s.scope === 'global');

      if (projectSkills.length > 0) {
        console.log(chalk.bold('  PROJECT SKILLS'));
        for (const s of projectSkills) {
          const icon = s.valid ? chalk.green('[OK]') : chalk.yellow('[!!]');
          const note = s.valid ? '' : chalk.gray(' (missing SKILL.md)');
          console.log(`    ${icon} ${s.name} ${chalk.gray(`[${s.source}]`)}${note}`);
        }
        console.log('');
      }

      if (globalSkills.length > 0) {
        console.log(chalk.bold('  GLOBAL SKILLS'));
        for (const s of globalSkills) {
          const icon = s.valid ? chalk.green('[OK]') : chalk.yellow('[!!]');
          const note = s.valid ? '' : chalk.gray(' (missing SKILL.md)');
          console.log(`    ${icon} ${s.name} ${chalk.gray(`[${s.source}]`)}${note}`);
        }
        console.log('');
      }

      if (skills.length === 0) {
        console.log('  No skills found.\n');
        return;
      }

      console.log(`  Summary: ${chalk.green(String(valid.length) + ' valid')}, ${chalk.yellow(String(invalid.length) + ' warnings')}\n`);
    });

  // skill install <repo>
  skillCommand
    .command('install <repo>')
    .description('Install a skill from a GitHub repository (owner/repo format)')
    .option('--scope <scope>', 'Install scope: project or global', 'project')
    .option('--target <target>', 'Target directory: claude or agents', 'claude')
    .option('--project-path <path>', 'Path to the project root (required for project scope)')
    .action(async (repo: string, cmdOpts) => {
      const globalOpts = program.opts();
      const scope = cmdOpts.scope as 'project' | 'global';
      const target = cmdOpts.target as 'claude' | 'agents';

      // Validate repo format
      if (!repo.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ success: false, error: 'Invalid repo format. Use owner/repo.' }, null, 2));
        } else {
          console.error('Invalid repo format. Expected: owner/repo');
        }
        process.exit(1);
      }

      if (scope === 'project' && !cmdOpts.projectPath) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ success: false, error: 'Project scope requires --project-path' }, null, 2));
        } else {
          console.error('Project scope requires --project-path <path>');
        }
        process.exit(1);
      }

      const loader = buildLoader(cmdOpts);
      const installDir = loader.getInstallDir(scope, target);
      const repoName = repo.split('/')[1];
      const skillDir = join(installDir, repoName);

      if (existsSync(skillDir)) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ success: false, error: `Skill directory already exists: ${skillDir}` }, null, 2));
        } else {
          console.error(`Skill directory already exists: ${skillDir}`);
          console.log(chalk.gray('Remove it first if you want to reinstall.'));
        }
        process.exit(1);
      }

      // Ensure parent directory exists
      if (!existsSync(installDir)) {
        mkdirSync(installDir, { recursive: true });
      }

      if (!globalOpts.json) {
        console.log(`\n  Installing ${chalk.bold(repo)} into ${chalk.gray(installDir)}...`);
      }

      // Try npx skillsadd first, fall back to git clone
      let installed = false;
      try {
        execSync(`npx skillsadd ${repo}`, {
          cwd: installDir,
          stdio: globalOpts.json ? 'pipe' : 'inherit',
          timeout: 60000,
        });
        installed = true;
      } catch {
        // skillsadd not available, fall back to git clone
        try {
          const cloneUrl = `https://github.com/${repo}.git`;
          execSync(`git clone --depth 1 ${cloneUrl} ${repoName}`, {
            cwd: installDir,
            stdio: globalOpts.json ? 'pipe' : 'inherit',
            timeout: 60000,
          });
          installed = true;
        } catch (err: any) {
          if (globalOpts.json) {
            console.log(JSON.stringify({ success: false, error: `Failed to install: ${err.message}` }, null, 2));
          } else {
            console.error(`\n  Failed to install skill: ${err.message}`);
          }
          process.exit(1);
        }
      }

      if (installed) {
        if (globalOpts.json) {
          outputJSON({ repo, path: skillDir, scope, source: target });
        } else {
          console.log(`  ${chalk.green('Installed')} ${repo} -> ${skillDir}`);
          console.log(`  Scope: ${scope}, Source: ${target}\n`);
        }
      }
    });

  // skill browse
  skillCommand
    .command('browse')
    .description('Browse available skills on skills.sh')
    .argument('[query]', 'Optional search query')
    .action(async (query?: string) => {
      const globalOpts = program.opts();
      const url = query
        ? `https://skills.sh/search?q=${encodeURIComponent(query)}`
        : 'https://skills.sh';

      if (globalOpts.json) {
        outputJSON({ url, query: query || null });
        return;
      }

      console.log('');
      console.log(chalk.bold('  Agent Skills Directory'));
      console.log(`  ${chalk.cyan(url)}`);
      console.log('');
      console.log(chalk.gray('  Install a skill with:'));
      console.log(chalk.gray('    maestro skill install <owner/repo>'));
      console.log('');

      // Try to open in browser
      try {
        const openCmd = process.platform === 'darwin' ? 'open'
          : process.platform === 'win32' ? 'start'
          : 'xdg-open';
        execSync(`${openCmd} ${url}`, { stdio: 'ignore' });
      } catch {
        // Silent fail - URL is already printed
      }
    });
}

/**
 * Print a table of skills for terminal output
 */
function printSkillTable(skills: SkillInfo[]): void {
  outputTable(
    ['Name', 'Source', 'Valid', 'Description'],
    skills.map(s => [
      s.name,
      s.source,
      s.valid ? chalk.green('yes') : chalk.yellow('no'),
      s.description || chalk.gray('-'),
    ]),
  );
}
