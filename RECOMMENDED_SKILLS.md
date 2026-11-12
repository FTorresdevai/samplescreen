# 🛠️ Recommended Agent Skills Guide for the Team

This document outlines the recommended suite of **Agent Skills** for our development workflow using AI coding assistants (such as Google Antigravity, Claude Code, Cursor, and GitHub Copilot).

---

## 🎯 Why Do We Use Agent Skills?

**Agent Skills** leverage the open *progressive disclosure* standard based on `SKILL.md` files. Rather than relying on generic instructions or long system prompts that pollute the context window:
- The AI assistant only retrieves detailed instructions when a specific task requires them.
- Ensures the AI adheres to strict engineering practices (TDD, testing, security audits, semantic commits).
- Standardizes code quality across all team members.

---

## 🚀 How to Install Skills

### Option A: Global Installation on Your Machine (Recommended for all projects)

#### For Antigravity / Gemini CLI:
Global skills reside in:
```bash
~/.gemini/config/skills/
```

To clone and install the complete software engineering skills suite at once:
```bash
# Create directory if it does not exist
mkdir -p ~/.gemini/config/skills

# Clone temporarily and copy skills
git clone --depth 1 https://github.com/addyosmani/agent-skills.git /tmp/addyosmani-agent-skills
cp -r /tmp/addyosmani-agent-skills/skills/* ~/.gemini/config/skills/
rm -rf /tmp/addyosmani-agent-skills
```

#### For Claude Code / other agents via official CLI:
```bash
npx skills add addyosmani/agent-skills
```

---

### Option B: Repository / Workspace Level Installation

To ensure that anyone (or any agent) opening this repository shares the exact same rules and procedures, skills can be placed in the project repository:
```text
.agents/skills/<skill-name>/SKILL.md
```
Committing `.agents/skills/` ensures all engineers and automated agents share identical guidelines.

---

## 📚 Recommended Skills Catalog

The skills below are curated from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) and [google/skills](https://github.com/google/skills).

### 1. Planning and Requirements Alignment

| Skill | When to Use | How to Prompt the Agent |
| :--- | :--- | :--- |
| **`interview-me`** | Before starting a complex feature. The agent asks clarifying questions before writing code. | *"Use the interview-me skill to clarify requirements for feature X."* |
| **`spec-driven-development`** | To draft a clear technical specification or PRD prior to implementation. | *"Generate a technical specification before we begin coding."* |
| **`planning-and-task-breakdown`** | To break down a large task into atomic, verifiable milestones. | *"Decompose this task into incremental steps with validation checklists."* |

---

### 2. High-Integrity & Anti-Hallucination Development

| Skill | When to Use | How to Prompt the Agent |
| :--- | :--- | :--- |
| **`test-driven-development`** | Mandatory for new business logic and sensitive algorithms. Follows Red-Green-Refactor. | *"Implement this feature following Test-Driven Development (TDD)."* |
| **`incremental-implementation`** | Prevents giant code rewrites by delivering thin, testable slices. | *"Deliver this implementation in small testable increments."* |
| **`doubt-driven-development`** | Compels the agent to verify code and filesystem reality rather than guessing solutions. | *"Verify your assumptions directly against the codebase before suggesting edits."* |
| **`debugging-and-error-recovery`** | Systematic root-cause diagnosis and regression prevention. | *"Debug this issue by finding the root cause and creating a regression test."* |

---

### 3. Quality, Code Review and Security

| Skill | When to Use | How to Prompt the Agent |
| :--- | :--- | :--- |
| **`code-review-and-quality`** | Before opening or approving any Pull Request. Evaluates correctness, readability, architecture, security, and performance. | *"Perform a thorough code review on the changes in this PR / diff."* |
| **`code-simplification`** | Refactoring code with accidental complexity, deep nesting, or premature abstractions. | *"Simplify this module while preserving behavior and test coverage."* |
| **`security-and-hardening`** | Auditing against injection, XSS, secret exposure, and input validation vulnerabilities. | *"Audit this code for security vulnerabilities and apply defensive best practices."* |

---

### 4. Frontend, Performance and UI

| Skill | When to Use | How to Prompt the Agent |
| :--- | :--- | :--- |
| **`frontend-ui-engineering`** | Building accessible (WCAG), responsive UI components with clean state management. | *"Develop this component adhering to modern frontend best practices and accessibility."* |
| **`performance-optimization`** | Optimizing bundle sizes, Core Web Vitals, re-renderings, and canvas pipeline throughput. | *"Profile performance bottlenecks and optimize render throughput."* |
| **`browser-testing-with-devtools`** | In-browser testing using Chrome DevTools to inspect console errors, network requests, and layouts. | *"Verify the UI in the browser and check for any console or layout issues."* |

---

### 5. Git and Version Control

| Skill | When to Use | How to Prompt the Agent |
| :--- | :--- | :--- |
| **`git-workflow-and-versioning`** | Writing Conventional Commits, clean branch naming, and comprehensive PR summaries. | *"Prepare semantic commits for the completed changes."* |
| **`documentation-and-adrs`** | Documenting significant architecture decisions (ADRs) and public APIs. | *"Document this architectural decision in an ADR file."* |

---

## 🔗 Reference Repositories

- **[addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)**: SDLC and senior software engineering agent skills.
- **[google/skills](https://github.com/google/skills)**: Official Google skills for cloud architectures, Firebase, and development workflows.
- **[VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)**: Curated catalog of community agent skills.
- **[anthropics/skills](https://github.com/anthropics/skills)**: Open agent skills specification.

---

## 💡 Pro-Tip for Daily Pair Programming

> Before prompting your AI assistant to "build the entire feature at once", activate a planning skill (`planning-and-task-breakdown` or `interview-me`). Taking two minutes to align on design decisions and edge cases saves hours of debugging and produces production-grade code.
