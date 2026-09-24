# Ask Mode

## Question

what inside the modes/agent explain properly with example and code

## Answer

I'll explain what's inside the `modes/agent` directory with examples and code for each component. The `modes/agent` directory contains the core agent system for file manipulation and code exploration.

## Overview

The agent system allows for:
- Safe file operations (read, create, modify, delete)
- Code analysis and search capabilities
- User approval workflow for mutations
- Diff visualization of changes

Here's a breakdown of each file:

---

## 1. `types.ts` - Type Definitions

This file defines the core types for the agent system:

```typescript
export type ActionType = 
  | 'file_create'
  | 'file_modify' 
  | 'file_delete'
  | 'folder_create'
  | 'code_analysis'
  | 'tool_execute';

export type ActionStatus = 'pending' | 'executed' | 'approved' | 'rejected';

export interface ActionLog {
  id: string;
  timestamp: Date;
  type: ActionType;
  path: string;
  details: {
    before?: string;
    after?: string;
    toolName?: string;
    toolResult?: string;
    error?: string;
    command?: string;
  };
  status: ActionStatus;
  userApproved?: boolean;
}

export interface AgentConfig {
  codebasePath: string;
  maxFileSizeToRead: number;
  excludePatterns: string[];
  tools: {
    allowShellExecution: boolean;
    allowFileModification: boolean;
    allowFileCreation: boolean;
    allowFolderCreation: boolean;
  };
}
```

**Example Usage:**
```typescript
// ActionLog example showing a file modification
{
  id: "action_0",
  timestamp: new Date(),
  type: "file_modify",
  path: "src/components/Button.tsx",
  details: {
    before: "export const Button = () => {}",
    after: "export const Button = ({ onClick }) => {}",
    toolName: "modify_file"
  },
  status: "pending",
  userApproved: undefined
}
```

---

## 2. `tool-executor.ts` - Main Tool Executor

This is the core engine that executes all file operations:

```typescript
export class ToolExecutor {
  private overlay = new Map<string, string>();  // Staged changes
  private deleted = new Set<string>();          // Staged deletions
  private readonly tracker: ActionTracker;
  private readonly config: AgentConfig;

  constructor(tracker: ActionTracker, config: AgentConfig) {
    this.tracker = tracker;
    this.config = config;
  }

  // Example: Read file operation
  readFile(rel: string): string {
    this.assertNotExcluded(rel, "read_file");
    const abs = this.resolveSafe(rel);
    
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`File not found: ${rel}`);
    }
    
    const text = fs.readFileSync(abs, "utf8");
    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rel),
      details: { after: text, toolName: "read_file" },
      status: "executed",
    });
    return text;
  }

  // Example: Create file operation
  createFile(rel: string, content: string): string {
    if (!this.config.tools.allowFileCreation)
      throw new Error("File creation disabled");
    
    const key = this.norm(rel);
    this.overlay.set(key, content);
    
    this.tracker.log({
      type: "file_create",
      path: key,
      details: { after: content },
      status: "pending",
    });
    return `Staged new file: ${key}`;
  }

  // Example: Modify file operation
  modifyFile(rel: string, content: string): string {
    const before = this.getEffectiveText(rel);
    if (before === undefined)
      throw new Error(`modify_file: file not found: ${rel}`);
    
    const key = this.norm(rel);
    this.overlay.set(key, content);
    
    this.tracker.log({
      type: "file_modify",
      path: key,
      details: { before, after: content },
      status: "pending",
    });
    return `Staged update: ${key}`;
  }

  // Apply approved changes
  applyApprovedFromTracker(): { errors: string[] } {
    const all = [...this.tracker.getActions()];
    
    for (const a of all.filter(
      (x) => x.type === "file_create" && x.status === "approved"
    )) {
      try {
        fs.mkdirSync(this.resolveSafe(a.path), { recursive: true });
        fs.writeFileSync(this.resolveSafe(a.path), a.details.after ?? "", "utf8");
      } catch (e) {
        errors.push(String(e));
      }
    }
    // ... similar for other types
  }
}
```

**Code Example - Safe Path Resolution:**
```typescript
private resolveSafe(rel: string): string {
  const abs = path.resolve(this.config.codebasePath, rel);
  const root = path.resolve(this.config.codebasePath);
  const relCheck = path.relative(root, abs);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    throw new Error(`Path escapes workspace: ${rel}`);
  }
  return abs;
}
```

---

## 3. `orchestrator.ts` - Main Agent Mode

This is the entry point for running the agent:

```typescript
export async function runAgentMode() {
  console.log(chalk.bold("\n🤖 Agent Mode\n"));
  
  const goal = await text({
    message: "What would you like the agent to do?",
    placeholder: "Concrete task for this codebase…",
  });
  
  if (isCancel(goal) || !goal.trim()) return;
  
  const config = defaultAgentConfig();
  const tracker = new ActionTracker();
  const executor = new ToolExecutor(tracker, config);
  const tools = createAgentTools(executor);
  
  const agent = new ToolLoopAgent({
    model: getAgentModel(),
    stopWhen: stepCountIs(40),
    instructions: [
      `Workspace root: ${config.codebasePath}`,
      "All mutations are staged until approval.",
    ].join("\n"),
    tools,
  });
  
  const result = await agent.generate({
    prompt: goal.trim(),
    onStepFinish: ({ toolCalls }) => {
      for (const tc of toolCalls) {
        const preview = JSON.stringify(tc.input).slice(0, 160);
        console.log(
          chalk.green("  ✓"),
          chalk.bold(String(tc.toolName)),
          chalk.dim(preview + (preview.length >= 160 ? "..." : "")),
        );
      }
    },
  });
  
  // Approval workflow
  const ok = await runApprovalFlow(tracker);
  if (!ok) return executor.clearStaging();
  
  const { errors } = executor.applyApprovedFromTracker();
  // ... handle errors
}
```

**Example Usage:**
```typescript
// User interaction example
What would you like the agent to do?
> Create a responsive navigation component and add it to the header

// Agent will then use tools like:
- search_files to find existing navigation code
- read_file to examine structure
- create_file to create new component
- modify_file to update header
```

---

## 4. `approval.ts` - User Approval Flow

This handles the interactive approval process for mutations:

```typescript
export async function runApprovalFlow(
  tracker: ActionTracker,
): Promise<boolean> {
  const pending = tracker.getPendingMutations();
  
  if (pending.length === 0) {
    console.log(
      chalk.dim("\nNo staged file, folder, or shell changes to review.\n"),
    );
    return false;
  }
  
  const choice = await select({
    message: "Apply staged changes?",
    options: [
      { value: "all", label: "Approve and apply all" },
      { value: "select", label: "Review one by one" },
      { value: "cancel", label: "Cancel" },
    ],
  });
  
  if (choice === "cancel") {
    for (const a of pending) tracker.updateStatus(a.id, "rejected", false);
    return false;
  }
  
  if (choice === "all") {
    for (const a of pending) tracker.updateStatus(a.id, "approved", true);
    return true;
  }
  
  // Review one by one example
  for (const g of groupPending(pending)) {
    while (true) {
      const opt = await select({
        message: chalk.bold(g.label),
        options: [
          { value: "accept", label: "Accept" },
          { value: "diff", label: "Show diff", hint: g.patch ? "" : "N/A" },
          { value: "reject", label: "Reject" },
        ],
      });
      
      if (opt === "diff" && g.patch) {
        console.log("\n" + renderTerminalMarkdown("```diff\n" + g.patch + "\n```\n"));
        continue;
      }
      
      for (const id of g.actionIds) {
        tracker.updateStatus(
          id,
          opt === "accept" ? "approved" : "rejected",
          opt === "accept",
        );
      }
      break;
    }
  }
}
```

**Example Diff Output:**
```
```diff
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,4 +1,4 @@
 export const Button = () => {
-  return <button>Click me</button>;
+  return <button onClick={handleClick}>Click me</button>;
 }
 
 const handleClick = () => {};
```
```

---

## 5. `action-tracker.ts` - Action Logging

This tracks all actions performed by the agent:

```typescript
export class ActionTracker {
  private actions: ActionLog[] = [];
  
  log(entry: Omit<ActionLog, 'id' | 'timestamp'> & {
    id?: string;
    timestamp?: Date;
  }): ActionLog {
    const action: ActionLog = {
      id: entry.id ?? `action_${this.actions.length}`,
      timestamp: entry.timestamp ?? new Date(),
      type: entry.type,
      path: entry.path,
      details: {...entry.details},
      status: entry.status,
      userApproved: entry.userApproved,
    };
    this.actions.push(action);
    return action;
  }
  
  getActions(): readonly ActionLog[] {
    return this.actions;
  }
  
  getPendingMutations(): ActionLog[] {
    return this.actions.filter(
      (a) => isMutationType(a.type) && a.status === "pending"
    );
  }
  
  updateStatus(id: string, status: ActionStatus, userApproved?: boolean): void {
    const a = this.actions.find((x) => x.id === id);
    if(!a) return;
    a.status = status;
    if(userApproved !== undefined) a.userApproved = userApproved;
  }
}
```

**Example Usage:**
```typescript
// Tracking file creation
executor.readFile("src/components/Button.tsx");  // Logs as code_analysis
executor.createFile("src/components/Navbar.tsx", "<nav>...</nav>");  // Logs as file_create (pending)

// The tracker keeps history for:
- User review (approval system)
- Diff generation
- Error reporting
```

---

## 6. `diff-view.ts` - Diff Visualization

This generates and formats diffs for changes:

```typescript
export function formatPatch(
  filePath: string,
  before: string,
  after: string,
): string {
  return createTwoFilesPatch(filePath, filePath, before, after, "", "", {
    context: 3,
  });
}

export function composeBeforeAfter(sorted: ActionLog[]): {
  before: string;
  after: string;
} {
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  
  if (last.type === "file_delete")
    return { before: last.details.before ?? "", after: "" };
    
  const before = 
    first.type === "file_create" ? "" : (first.details.before ?? "");
  const after = last.details.after ?? "";
  
  return { before, after };
}
```

**Example Diff Generation:**
```typescript
// When agent modifies multiple files:
executor.modifyFile("src/styles/theme.ts", "light-mode: true");
executor.modifyFile("src/components/Dashboard.tsx", "<div>Updated</div>");

// System creates diffs for user review
// Shows exactly what changed in each file
```

---

## 7. `agent-tools.ts` - Available Agent Tools

This defines all tools the agent can use:

```typescript
export function createAgentTools(executor: ToolExecutor) {
  return {
    read_file: tool({
      description: "Read a text file from the workspace.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => executor.readFile(p),
    }),
    
    create_file: tool({
      description: "Stage creation of a new file (pending approval).",
      inputSchema: z.object({ 
        path: z.string(), 
        content: z.string() 
      }),
      execute: async ({ path: p, content }) => executor.createFile(p, content),
    }),
    
    modify_file: tool({
      description: "Stage a full-file replacement (pending approval).",
      inputSchema: z.object({ 
        path: z.string(), 
        content: z.string() 
      }),
      execute: async ({ path: p, content }) => executor.modifyFile(p, content),
    }),
    
    delete_file: tool({
      description: "Stage deletion of a file (pending approval).",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => executor.deleteFile(p),
    }),
    
    list_files: tool({
      description: "List files and directories under a path.",
      inputSchema: z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      }),
      execute: async ({ path: p, recursive }) => executor.listFiles(p, recursive),
    }),
    
    search_files: tool({
      description: 'Find files matching a glob pattern.',
      inputSchema: z.object({
        root: z.string(),
        pattern: z.string(),
        content_contains: z.string().optional(),
      }),
      execute: async ({ root, pattern, content_contains }) => 
        executor.searchFiles(root, pattern, content_contains),
    }),
    
    analyze_codebase: tool({
      description: "Summarize structure: file counts, size, extensions.",
      inputSchema: z.object({ path: z.string().default(".") }),
      execute: async ({ path: p }) => executor.analyzeCodebase(p),
    }),
    
    execute_shell: tool({
      description: "Queue a shell command to run after approval.",
      inputSchema: z.object({ command: z.string() }),
      execute: async ({ command }) => executor.queueShell(command),
    }),
    
    list_skills: tool({
      description: "List absolute paths to SKILL.md files.",
      inputSchema: z.object({}),
      execute: async () => executor.listSkills(),
    }),
    
    read_skill: tool({
      description: "Read a SKILL.md file.",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path: p }) => executor.readSkill(p),
    }),
  };
}
```

**Example Agent Workflow:**
```typescript
// User asks: "Find all React components in the codebase"

1. Agent uses: search_files("*/*.tsx")
2. Agent uses: read_file() on each component found
3. Agent uses: analyze_codebase() for overview
4. All operations are logged as pending
5. User reviews each change type
6. User approves/rejects interactively
7. Approved changes are applied to filesystem
```

---

## Key Features

1. **Safety First**: Path escaping prevention and exclusion patterns
2. **Staged Operations**: All mutations are staged until user approval
3. **Interactive Review**: User can review diffs and approve/reject changes
4. **Action Tracking**: Complete history of all operations
5. **Flexible Tools**: 8 core tools for file and code manipulation
6. **Error Handling**: Comprehensive error reporting and recovery

This system provides a secure, interactive environment for AI agents to explore and modify codebases while maintaining user control over all changes.
