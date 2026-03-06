# Maestro Documentation & Usage Guides

**Run multiple Claudes across your projects. Coordinate all of them from one place.**

---

## Documentation Map

### Getting Started
| Page | Description |
|------|-------------|
| [Welcome](01-landing/welcome.md) | What Maestro is and how to get started |
| [Why Maestro?](01-landing/why-maestro.md) | The problem Maestro solves |
| [Feature Overview](01-landing/feature-overview.md) | All features at a glance |
| [How It Works](01-landing/how-it-works.md) | 30-second architecture overview |
| [Install Guide](02-getting-started/install-guide.md) | All installation methods |
| [Quickstart: Your First Task](02-getting-started/quickstart-first-task.md) | Zero to productive in 5 minutes |
| [Quickstart: CLI Only](02-getting-started/quickstart-cli-only.md) | Terminal-first workflow |
| [Quickstart: Desktop App](02-getting-started/quickstart-desktop-app.md) | Visual workflow |

### Core Concepts
| Page | Description |
|------|-------------|
| [Projects](03-core-concepts/projects.md) | Workspaces for organizing tasks and sessions |
| [Tasks](03-core-concepts/tasks.md) | Units of work with lifecycle management |
| [Sessions](03-core-concepts/sessions.md) | Claude instances working on tasks |
| [Workers vs Orchestrators](03-core-concepts/workers-vs-orchestrators.md) | The four agent modes |
| [Teams & Members](03-core-concepts/teams-and-members.md) | Named agent profiles |
| [Skills](03-core-concepts/skills.md) | Markdown-based agent instructions |
| [Manifests](03-core-concepts/manifests.md) | Session configuration files |
| [Execution Strategies](03-core-concepts/execution-strategies.md) | Simple vs queue mode |

### Workflow Guides
| Page | Description |
|------|-------------|
| [Run a Single Task](04-workflow-guides/single-task.md) | The simplest flow |
| [Break Down Tasks](04-workflow-guides/break-down-tasks.md) | Task hierarchies and subtasks |
| [Parallel Agents](04-workflow-guides/parallel-agents.md) | Run multiple Claudes at once |
| [Orchestrator Coordination](04-workflow-guides/orchestrator-coordination.md) | Automated planning and delegation |
| [Team Setup](04-workflow-guides/team-setup.md) | Specialized agent teams |
| [Queue Mode](04-workflow-guides/queue-mode.md) | Ordered task processing |
| [Multi-Project](04-workflow-guides/multi-project.md) | Cross-project orchestration |
| [Inter-Session Messaging](04-workflow-guides/inter-session-messaging.md) | Agent-to-agent communication |
| [Real-Time Tracking](04-workflow-guides/real-time-tracking.md) | Progress monitoring |
| [Custom Skills](04-workflow-guides/custom-skills.md) | Custom agent instructions |
| [Permissions](04-workflow-guides/permissions.md) | Access control |

### Desktop App Guide
| Page | Description |
|------|-------------|
| [App Overview](05-desktop-app/app-overview.md) | Workspace layout |
| [Task Management](05-desktop-app/task-management.md) | Tasks in the UI |
| [Session Management](05-desktop-app/session-management.md) | Sessions in the UI |
| [Terminal Sessions](05-desktop-app/terminal-sessions.md) | tmux, SSH, persistent terminals |
| [File Explorer & Editor](05-desktop-app/file-explorer-editor.md) | Built-in code editor |
| [Teams & Agent View](05-desktop-app/teams-agent-view.md) | Team management UI |
| [Command Palette](05-desktop-app/command-palette.md) | Keyboard shortcuts |
| [Settings](05-desktop-app/settings.md) | Customization options |

### CLI Reference
| Page | Description |
|------|-------------|
| [Global Options](06-cli-reference/01-global-options.md) | Flags available on every command |
| [Project Commands](06-cli-reference/02-project-commands.md) | `maestro project` |
| [Task Commands](06-cli-reference/03-task-commands.md) | `maestro task` |
| [Session Commands](06-cli-reference/04-session-commands.md) | `maestro session` |
| [Report Commands](06-cli-reference/05-report-commands.md) | `maestro report` |
| [Task Report Commands](06-cli-reference/05b-task-report-commands.md) | `maestro task report` |
| [Team Commands](06-cli-reference/06-team-commands.md) | `maestro team` |
| [Team Member Commands](06-cli-reference/07-team-member-commands.md) | `maestro team-member` |
| [Skill Commands](06-cli-reference/08-skill-commands.md) | `maestro skill` |
| [Task List Commands](06-cli-reference/09-task-list-commands.md) | `maestro task-list` |
| [Master Commands](06-cli-reference/10-master-commands.md) | `maestro master` |
| [Manifest Commands](06-cli-reference/11-manifest-commands.md) | `maestro manifest` |
| [Utility Commands](06-cli-reference/12-utility-commands.md) | `maestro whoami`, `status`, etc. |
| [Environment Variables](06-cli-reference/13-environment-variables.md) | All env vars |

### Advanced Patterns
| Page | Description |
|------|-------------|
| [Custom Workflows](07-advanced-patterns/custom-workflows.md) | Combining features for complex automation |
| [Hook System](07-advanced-patterns/hook-system.md) | Lifecycle hooks deep dive |
| [Manifest Customization](07-advanced-patterns/manifest-customization.md) | Hand-crafting manifests |
| [Team Member Memory & Identity](07-advanced-patterns/team-member-memory-identity.md) | Persistent agent context |
| [Multi-Level Orchestration](07-advanced-patterns/multi-level-orchestration.md) | Orchestrators of orchestrators |
| [External Integrations](07-advanced-patterns/external-integrations.md) | MCP, modals, scripting |

### Troubleshooting & FAQ
| Page | Description |
|------|-------------|
| [Install Issues](08-troubleshooting/install-issues.md) | Common installation problems |
| [Session Issues](08-troubleshooting/session-issues.md) | Session startup problems |
| [WebSocket Issues](08-troubleshooting/websocket-issues.md) | Real-time connection problems |
| [Agent Issues](08-troubleshooting/agent-issues.md) | Agent behavior problems |
| [FAQ](08-troubleshooting/faq.md) | Frequently asked questions |

### Reference
| Page | Description |
|------|-------------|
| [API Reference](09-reference/api-reference.md) | All server endpoints |
| [Glossary](09-reference/glossary.md) | Every Maestro term defined |
| [Status Reference](09-reference/status-reference.md) | All status types and transitions |
| [Configuration Reference](09-reference/configuration-reference.md) | Config files, paths, env vars |

### Visual Assets
| Page | Description |
|------|-------------|
| [Architecture Diagram](10-visual-assets/architecture-diagram.md) | System architecture (Mermaid) |
| [Task Lifecycle](10-visual-assets/task-lifecycle.md) | Task status flow (Mermaid) |
| [Session Lifecycle](10-visual-assets/session-lifecycle.md) | Session status flow (Mermaid) |
| [Orchestrator Flow](10-visual-assets/orchestrator-flow.md) | Orchestrator sequence (Mermaid) |
| [Team Structure](10-visual-assets/team-structure.md) | Team hierarchy (Mermaid) |
| [Spawn Flow](10-visual-assets/spawn-flow.md) | Session spawn sequence (Mermaid) |
| [Screenshot Guide](10-visual-assets/screenshot-guide.md) | What screenshots to capture |

### Real-World Examples
| Page | Description |
|------|-------------|
| [Build a Blog API](11-examples/blog-api.md) | Beginner: single task workflow |
| [E-Commerce Feature](11-examples/ecommerce-feature.md) | Intermediate: orchestrator + team |
| [Monorepo Migration](11-examples/monorepo-migration.md) | Advanced: multi-project |
| [Open Source Contribution](11-examples/open-source-contribution.md) | Meta: custom skills + queue |

### Meta
| Page | Description |
|------|-------------|
| [Style Guide](style-guide.md) | Writing conventions |
| [Templates](templates.md) | Page templates |
| [Navigation Conventions](navigation-conventions.md) | Cross-linking rules |

---

**Total: 79 pages across 11 sections + meta guides.**
