import { Command } from 'commander';
import { SkillLoader } from '../services/skill-loader.js';
import { outputJSON } from '../utils/formatter.js';

/**
 * Register skill management commands
 *
 * Provides:
 * - `maestro skill list` - List all available skills
 * - `maestro skill info <name>` - Get details about a specific skill
 * - `maestro skill validate` - Validate all skills
 *
 * All commands support `--json` flag for JSON output.
 *
 * @param program - The commander program instance
 */
export function registerSkillCommands(program: Command): void {
  const skillCommand = program
    .command('skill')
    .description('Manage Claude Code skills');

  // skill list
  skillCommand
    .command('list')
    .description('List all available skills')
    .action(async () => {
      const globalOpts = program.opts();
      const loader = new SkillLoader();
      const skills = await loader.discover();

      if (globalOpts.json) {
        outputJSON(skills);
      } else {
        console.log('\nAvailable skills:');
        if (skills.length === 0) {
          console.log('  (no skills found)');
        } else {
          skills.forEach((skill) => {
            const status = skill.valid ? '✅' : '⚠️';
            console.log(`  ${status} ${skill.name}`);
            if (skill.description) {
              console.log(`     ${skill.description}`);
            }
          });
        }
        console.log('');
      }
    });

  // skill info <name>
  skillCommand
    .command('info <name>')
    .description('Get details about a specific skill')
    .action(async (name: string) => {
      const globalOpts = program.opts();
      const loader = new SkillLoader();
      const info = await loader.getSkillInfo(name);

      if (!info) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ success: false, error: `Skill not found: ${name}` }, null, 2));
        } else {
          console.error(`❌ Skill not found: ${name}`);
        }
        return;
      }

      if (globalOpts.json) {
        outputJSON(info);
      } else {
        console.log(`\nSkill: ${info.name}`);
        console.log(`Path: ${info.path}`);
        console.log(`Valid: ${info.valid ? 'Yes' : 'No'}`);
        if (info.description) {
          console.log(`Description: ${info.description}`);
        }
        console.log('');
      }
    });

  // skill validate
  skillCommand
    .command('validate')
    .description('Validate all skills')
    .action(async () => {
      const loader = new SkillLoader();
      const skills = await loader.discover();

      const valid = skills.filter((s) => s.valid);
      const invalid = skills.filter((s) => !s.valid);

      console.log('\n📋 Validating skills...\n');

      valid.forEach((s) => console.log(`✅ ${s.name} (valid)`));
      invalid.forEach((s) => console.log(`⚠️  ${s.name} (missing skill.md)`));

      console.log(`\nSummary: ${valid.length} valid, ${invalid.length} warnings\n`);
    });
}
