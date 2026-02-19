#!/usr/bin/env node

/**
 * Maestro MCP Server
 *
 * Exposes Maestro CLI commands as MCP tools for Claude Code integration.
 *
 * Usage:
 *   claude mcp add --transport stdio maestro -- node /path/to/maestro-mcp-server/index.js
 *
 * Then in Claude Code:
 *   > Create a new task titled "Fix authentication bug"
 *   > List all tasks for the current project
 *   > Mark task task_123 as completed
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const execAsync = promisify(exec);

// Get the Maestro CLI path (assumes it's in ../maestro-cli/dist/index.js)
const __dirname = dirname(fileURLToPath(import.meta.url));
const MAESTRO_CLI_PATH = join(__dirname, "../maestro-cli/dist/index.js");
const MAESTRO_CLI = `node ${MAESTRO_CLI_PATH}`;

// Get configuration from environment variables
const MAESTRO_API_URL = process.env.MAESTRO_API_URL || "http://localhost:3000";
const MAESTRO_PROJECT_ID = process.env.MAESTRO_PROJECT_ID || "";

/**
 * Execute a Maestro CLI command
 */
async function executeMaestroCLI(args) {
  try {
    const command = `${MAESTRO_CLI} ${args} --json`;
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        MAESTRO_API_URL,
        MAESTRO_PROJECT_ID,
      },
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    if (stderr && !stdout) {
      throw new Error(stderr);
    }

    // Try to parse JSON output
    try {
      return JSON.parse(stdout);
    } catch {
      // If not JSON, return as text
      return stdout.trim();
    }
  } catch (error) {
    throw new Error(`CLI Error: ${error.message}`);
  }
}

// Create the MCP server
const server = new Server(
  {
    name: "maestro-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define MCP tools that map to Maestro CLI commands
server.setRequestHandler("tools/list", async () => {
  return {
    tools: [
      // Task Management
      {
        name: "maestro_task_create",
        description: "Create a new task in Maestro. Returns the created task object with ID.",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Task title (required)",
            },
            description: {
              type: "string",
              description: "Detailed task description",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Task priority level",
              default: "medium",
            },
            initialPrompt: {
              type: "string",
              description: "Initial prompt or instructions for the agent",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "maestro_task_list",
        description: "List all tasks in the current project. Returns an array of task objects with their details and subtasks.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["pending", "in_progress", "blocked", "completed"],
              description: "Filter tasks by status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Filter tasks by priority",
            },
            taskId: {
              type: "string",
              description: "Show a specific task and its subtree",
            },
          },
        },
      },
      {
        name: "maestro_task_get",
        description: "Get detailed information about a specific task including its timeline and subtasks.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to retrieve",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "maestro_task_update",
        description: "Update task properties such as status, priority, or description.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to update",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "blocked", "completed"],
              description: "New task status",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "New task priority",
            },
            description: {
              type: "string",
              description: "New task description",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "maestro_task_delete",
        description: "Delete a task and all its subtasks.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to delete",
            },
          },
          required: ["taskId"],
        },
      },
      {
        name: "maestro_task_start",
        description: "Mark a task as in_progress. Convenience command for updating status.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to start (optional if in task context)",
            },
          },
        },
      },
      {
        name: "maestro_task_complete",
        description: "Mark a task as completed. Convenience command for updating status.",
        inputSchema: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "The task ID to complete (optional if in task context)",
            },
          },
        },
      },

      // Subtask Management
      {
        name: "maestro_subtask_create",
        description: "Create a subtask under a parent task.",
        inputSchema: {
          type: "object",
          properties: {
            parentId: {
              type: "string",
              description: "Parent task ID",
            },
            title: {
              type: "string",
              description: "Subtask title",
            },
            description: {
              type: "string",
              description: "Subtask description",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"],
              default: "medium",
            },
          },
          required: ["parentId", "title"],
        },
      },

      // Progress Updates
      {
        name: "maestro_update",
        description: "Log a progress message to the current task(s). Adds an entry to the task timeline.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Progress update message",
            },
          },
          required: ["message"],
        },
      },

      // Session Management
      {
        name: "maestro_session_list",
        description: "List all sessions in the current project.",
        inputSchema: {
          type: "object",
          properties: {
            active: {
              type: "boolean",
              description: "Filter to only active sessions",
            },
          },
        },
      },

      // Project Status
      {
        name: "maestro_status",
        description: "Show summary of current project state including task counts by status and active sessions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },

      // Context Information
      {
        name: "maestro_whoami",
        description: "Print current Maestro context (server, project ID, session ID, task IDs).",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls by executing Maestro CLI commands
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      // Task Management
      case "maestro_task_create": {
        const cliArgs = [
          "task create",
          `"${args.title}"`,
          args.description ? `--desc "${args.description}"` : "",
          args.priority ? `--priority ${args.priority}` : "",
          args.initialPrompt ? `--prompt "${args.initialPrompt}"` : "",
        ]
          .filter(Boolean)
          .join(" ");
        result = await executeMaestroCLI(cliArgs);
        break;
      }

      case "maestro_task_list": {
        const cliArgs = [
          "task list",
          args.taskId || "",
          args.status ? `--status ${args.status}` : "",
          args.priority ? `--priority ${args.priority}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        result = await executeMaestroCLI(cliArgs);
        break;
      }

      case "maestro_task_get": {
        result = await executeMaestroCLI(`task get ${args.taskId}`);
        break;
      }

      case "maestro_task_update": {
        const updates = [];
        if (args.status) updates.push(`--status ${args.status}`);
        if (args.priority) updates.push(`--priority ${args.priority}`);
        if (args.description) updates.push(`--desc "${args.description}"`);
        result = await executeMaestroCLI(
          `task update ${args.taskId} ${updates.join(" ")}`
        );
        break;
      }

      case "maestro_task_delete": {
        result = await executeMaestroCLI(`task delete ${args.taskId}`);
        break;
      }

      case "maestro_task_start": {
        const taskId = args.taskId ? args.taskId : "";
        result = await executeMaestroCLI(`task-start ${taskId}`);
        break;
      }

      case "maestro_task_complete": {
        const taskId = args.taskId ? args.taskId : "";
        result = await executeMaestroCLI(`task-complete ${taskId}`);
        break;
      }

      // Subtask Management
      case "maestro_subtask_create": {
        const cliArgs = [
          "subtask create",
          args.parentId,
          `"${args.title}"`,
          args.description ? `--desc "${args.description}"` : "",
          args.priority ? `--priority ${args.priority}` : "",
        ]
          .filter(Boolean)
          .join(" ");
        result = await executeMaestroCLI(cliArgs);
        break;
      }

      // Progress Updates
      case "maestro_update": {
        result = await executeMaestroCLI(`update "${args.message}"`);
        break;
      }

      // Session Management
      case "maestro_session_list": {
        const activeFlag = args.active ? "--active" : "";
        result = await executeMaestroCLI(`session list ${activeFlag}`);
        break;
      }

      // Project Status
      case "maestro_status": {
        result = await executeMaestroCLI("status");
        break;
      }

      // Context Information
      case "maestro_whoami": {
        result = await executeMaestroCLI("whoami");
        break;
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }

    // Format the result
    const resultText =
      typeof result === "string" ? result : JSON.stringify(result, null, 2);

    return {
      content: [
        {
          type: "text",
          text: resultText,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);
