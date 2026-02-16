# Team Member Redesign - Phase 3: Workflow Customization

## Context

Phase 1 established team members with mode/strategy. Phase 2 added capability and command permission customization. Phase 3 completes the modular team member system by making workflow phases customizable.

**Prerequisites**: Phase 1 and Phase 2 must be complete.

**Goal**: Let users customize or write workflow phases per team member. Currently workflows are hardcoded in `prompt-builder.ts` based on mode+strategy combinations. Phase 3 adds workflow templates that users can pick from, and a freeform editor to write custom workflow instructions.

## Current System (Pre-Phase 3)

### Workflow Generation
Located in `maestro-cli/src/services/prompt-builder.ts`:

Workflow phases are built by `buildWorkflow(mode, strategy)` which returns XML like:
```xml
<workflow>
  <phase name="execute">Execute the task directly...</phase>
  <phase name="report">Report progress using maestro commands...</phase>
  <phase name="complete">When done, report completion...</phase>
</workflow>
```

### Existing Workflow Templates (hardcoded)

1. **Execute + Simple**: execute → report → complete
2. **Execute + Queue**: pull → claim → execute → report → finish (loop)
3. **Execute + Tree**: analyze → plan → execute → report → complete
4. **Coordinate + Default**: analyze → decompose → spawn → monitor → verify → complete
5. **Coordinate + Intelligent-Batching**: decompose → batch → execute_batch → verify → complete
6. **Coordinate + DAG**: analyze → build_dag → execute_wave → verify → complete

## Architecture

### New Fields on TeamMember

```typescript
interface TeamMember {
  // ... existing fields from Phase 1 + Phase 2 ...

  // Phase 3: Workflow customization
  workflowTemplateId?: string;  // ID of a predefined template, or 'custom'
  customWorkflow?: string;       // Freeform workflow text (used when workflowTemplateId === 'custom')
}
```

### Workflow Templates

Templates are stored as a static registry (no database needed):

```typescript
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  mode: AgentMode;         // Which mode this template is designed for
  strategy?: string;       // Which strategy this template matches (optional)
  phases: WorkflowPhase[];
  builtIn: boolean;        // true for system templates, false for user-created
}

interface WorkflowPhase {
  name: string;
  instruction: string;
}
```

### Resolution Logic

When building the prompt:
1. If `teamMember.customWorkflow` is set and `workflowTemplateId === 'custom'` → use custom text directly
2. If `teamMember.workflowTemplateId` is set → look up template, use its phases
3. Otherwise → fall back to existing `buildWorkflow(mode, strategy)` logic

## Files to Modify

### Server Types
- **`maestro-server/src/types.ts`** - Add `workflowTemplateId` and `customWorkflow` to TeamMember
- **`maestro-ui/src/app/types/maestro.ts`** - Mirror type changes

### Workflow Templates Registry
- **NEW: `maestro-cli/src/services/workflow-templates.ts`**
  - Define all 6 built-in templates extracted from current `buildWorkflow()` logic
  - Export `getWorkflowTemplate(id)`, `getAllWorkflowTemplates()`, `getTemplatesForMode(mode)`
  - Each template includes the full phase text currently hardcoded in prompt-builder.ts

### Prompt Builder
- **`maestro-cli/src/services/prompt-builder.ts`**
  - Update `buildWorkflow()` to accept optional custom workflow text or template ID
  - If custom workflow provided: wrap in `<workflow>` tags and use directly
  - If template ID provided: look up from registry
  - Otherwise: existing logic

### Manifest Types & Generator
- **`maestro-cli/src/types/manifest.ts`** - Add workflow fields to TeamMemberData
- **`maestro-cli/src/commands/manifest-generator.ts`** - Pass workflow data through manifest

### Server API
- **NEW: `maestro-server/src/api/workflowTemplateRoutes.ts`**
  - `GET /api/workflow-templates` → list all built-in templates
  - `GET /api/workflow-templates/:id` → get specific template
  - `GET /api/workflow-templates?mode=execute` → filter by mode

### Repository
- **`maestro-server/src/infrastructure/repositories/FileSystemTeamMemberRepository.ts`**
  - Update default definitions with `workflowTemplateId` matching their mode+strategy

### UI: Workflow Editor
- **`maestro-ui/src/components/maestro/CreateTeamMemberModal.tsx`**
- **`maestro-ui/src/components/maestro/EditTeamMemberModal.tsx`**

Add workflow section:

#### Workflow Section UI
```
▸ Workflow

  Template: [ Execute Simple ▾ ]  (dropdown of templates filtered by mode)

  ┌─────────────────────────────────────────────┐
  │ <phase name="execute">                      │
  │   You have ONE task. Read it carefully,     │
  │   then implement it directly...             │
  │ </phase>                                    │
  │ <phase name="report">                       │
  │   After each meaningful milestone...        │
  │ </phase>                                    │
  │ <phase name="complete">                     │
  │   When all acceptance criteria are met...   │
  │ </phase>                                    │
  └─────────────────────────────────────────────┘

  [ ] Custom workflow (enables freeform editing)
```

**Behavior**:
- Template dropdown pre-fills the editor with template content
- "Custom workflow" checkbox enables freeform editing
- When editing, the text is stored as `customWorkflow` and `workflowTemplateId` is set to `'custom'`
- Preview shows the rendered XML that will be sent to the agent

### MaestroClient
- **`maestro-ui/src/utils/MaestroClient.ts`**
  - Add `getWorkflowTemplates()` method
  - Add `getWorkflowTemplate(id)` method

### Store
- **`maestro-ui/src/stores/useMaestroStore.ts`**
  - Add workflow template state and fetch actions

## Built-in Template Definitions

Extract from current `prompt-builder.ts` `buildWorkflow()`:

### 1. execute-simple
```
Phase: execute - "You have ONE task. Read it carefully, then implement it directly. Work through the requirements methodically — write code, run tests, fix issues. Do not decompose or delegate. You are the executor."
Phase: report - "After each meaningful milestone (file created, test passing, feature working), report progress..."
Phase: complete - "When all acceptance criteria are met and the task is fully done..."
```

### 2. execute-queue
```
Phase: pull - "Check queue for next task..."
Phase: claim - "Claim the task..."
Phase: execute - "Implement the task..."
Phase: report - "Report progress..."
Phase: finish - "When queue is empty, report completion..."
```

### 3. execute-tree
```
Phase: analyze - "Analyze the task tree..."
Phase: plan - "Plan execution order..."
Phase: execute - "Execute each task..."
Phase: report - "Report per-task progress..."
Phase: complete - "When all tasks done..."
```

### 4. coordinate-default
```
Phase: analyze - "Analyze the task and understand scope..."
Phase: decompose - "Break into subtasks..."
Phase: spawn - "Spawn workers ONE AT A TIME..."
Phase: monitor - "Track worker progress..."
Phase: verify - "Verify completion..."
Phase: complete - "Report final status..."
```

### 5. coordinate-batching
```
Phase: decompose - "Break into batches..."
Phase: batch - "Execute batches sequentially..."
Phase: execute_batch - "Within batch, spawn parallel workers..."
Phase: verify - "Verify batch completion..."
Phase: complete - "Report final status..."
```

### 6. coordinate-dag
```
Phase: analyze - "Analyze dependencies..."
Phase: build_dag - "Build dependency graph..."
Phase: execute_wave - "Execute waves (topological layers)..."
Phase: verify - "Verify wave completion..."
Phase: complete - "Report final status..."
```

## Testing

1. Verify all 6 built-in templates load correctly from API
2. Verify template dropdown filters by mode
3. Verify selecting a template pre-fills the editor
4. Verify custom workflow checkbox enables editing
5. Verify custom workflow is saved to team member
6. Verify manifest generator uses custom workflow
7. Verify prompt builder renders custom workflow in XML
8. Verify fallback to computed workflow when no overrides
9. Verify default team members use their matching template
