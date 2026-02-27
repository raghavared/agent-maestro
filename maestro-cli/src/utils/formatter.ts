import chalk from 'chalk';
import Table from 'cli-table3';
import type { TaskResponse } from '../types/api-responses.js';

export function outputJSON(data: unknown) {
    console.log(JSON.stringify({ success: true, data }, null, 2));
}

export function outputErrorJSON(error: unknown) {
    const e = error as Record<string, unknown>;
    console.error(JSON.stringify({
        success: false,
        error: (e.code as string) || 'unknown_error',
        message: (e.message as string) || String(error),
        details: e.details
    }, null, 2));
}

export function outputTable(headers: string[], rows: string[][]) {
    const table = new Table({
        head: headers.map(h => chalk.cyan(h)),
        style: { head: [], border: [] }
    });
    table.push(...rows);
    console.log(table.toString());
}

export function outputKeyValue(key: string, value: string) {
    console.log(`${chalk.bold(key)}: ${value}`);
}

export function outputTaskTree(tasks: TaskResponse[], indent: string = '') {
    tasks.forEach((task, idx) => {
        const isLast = idx === tasks.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const status = getStatusIcon(task.status);
        console.log(`${indent}${prefix} ${chalk.bold(`[${task.id}]`)} ${status} ${task.title}`);

        const children = task.children;
        if (children && children.length > 0) {
            const childIndent = indent + (isLast ? '   ' : '│  ');
            outputTaskTree(children, childIndent);
        }
    });
}

function getStatusIcon(status: string): string {
    switch (status) {
        case 'completed':
            return '✅';
        case 'in-progress':
        case 'in_progress':
            return '🔄';
        case 'blocked':
            return '🚫';
        case 'todo':
            return '⏳';
        case 'cancelled':
            return '⊘';
        default:
            return '◯';
    }
}
