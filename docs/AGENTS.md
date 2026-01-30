# AGENT BEHAVIOR & CONSTRAINTS

**Target**: All AI Agents working on this codebase.
**Severity**: STRICT.

## 1. Tooling & Environment Constraints
*   **NO IDE BROWSER TOOLS**: Do NOT use any "browser testing" or "visual verification" tools inside the IDE. Rely on **Code Analysis** and strict **Forensic logic**.
*   **PowerShell Hygiene**:
    *   **NEVER use `&&`**: It is not supported in standard Windows PowerShell.
    *   **USE `;`**: Chain commands with semicolons (e.g., `git add . ; git commit ...`).
    *   **Verify**: Always verify the command string before running.

## 2. Workflow Rules
*   **"Just Do It" Mode**:
    *   Do **NOT** pause to ask the user for approval on Implementation Plans unless there is a critical Blocking Ambiguity or High Risk of destruction.
    *   Assume competence. Write the plan, then execute it immediately in the same turn or next turn.
    *   Do not ask "Should I proceed?". Proceed.
*   **Side Report Protocol**:
    *   **After Each Work Unit**: You MUST write a markdown report in `docs/` summarizing what you did (Forensic style).
    *   **Git Commit**: You MUST commit changes immediately after the report.
    *   *Mnemonic*: "If it's not in `docs/` and git, it didn't happen."

## 3. Communication Limits
*   **Task Boundaries**:
    *   **The 3+2 Rule**: Use `task_boundary` sparingly.
    *   **Ratio**: Approx 1 boundary per ~5 heavy tool calls.
    *   **Goal**: Do not spam the user's UI. Group logical chunks of work (e.g., "Analyzing Layout" -> "Implementing Fixes" -> "Verifying").

## 4. Documentation Maintenance
*   **Keep It Alive**: If you change the system, update `system.md`, `repo_xray.md`, or `physics_xray.md`.
*   **Forensic Trace**: Future agents rely on your `docs/` reports to know state. Be detailed.
