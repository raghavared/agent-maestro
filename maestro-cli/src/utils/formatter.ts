import chalk from 'chalk';
import Table from 'cli-table3';

export function outputJSON(data: any) {
    console.log(JSON.stringify({ success: true, data }, null, 2));
}

export function outputErrorJSON(error: any) {
    console.error(JSON.stringify({
        success: false,
        error: error.code || 'unknown_error',
        message: error.message || String(error),
        details: error.details
    }, null, 2));
}

export function outputTable(headers: string[], rows: any[][]) {
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

export function outputTaskTree(tasks: any[], indent: string = '') {
    tasks.forEach((task, idx) => {
        const isLast = idx === tasks.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const status = getStatusIcon(task.status);
        console.log(`${indent}${prefix} ${chalk.bold(`[${task.id}]`)} ${status} ${task.title}`);

        const children = task.children || task.subtasks;
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
