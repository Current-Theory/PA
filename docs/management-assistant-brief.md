You are working inside an existing project that I have already started building with Codex/ChatGPT.

Your job is NOT to start again from scratch.

First, inspect the entire existing codebase, understand what has already been built, identify the current architecture, data model, UI flow, task logic, persistence layer, authentication, and any existing AI/ChatGPT integrations.

Then make the best technical decisions needed to evolve the existing application into the product described below.

## Core product goal

This is not primarily a task manager.

It is a personal AI management assistant for a Programme Manager.

The task manager/database sits underneath the assistant.

The main interaction should be:

USER SPEAKS OR TYPES NATURALLY
→ AI UNDERSTANDS INTENT
→ AI EXECUTES THE APPROPRIATE ACTION
→ TASK SYSTEM IS UPDATED
→ USER CAN SEE WHAT THEY NEED TO DO

The user should spend as little mental effort as possible administering the system.

The user should be able to speak to the assistant in normal conversational language, much like speaking to ChatGPT.

Examples:

“I need to review those Moodle questions next week, but it’s not urgent.”

“I’ve finished the Logan thing.”

“Vittoria wants me to check with Prakash before we do anything else.”

“Move that Moodle review to Monday.”

“Remind me about that tomorrow.”

“What do I actually need to get done today?”

“I’ve got too much on. What should I focus on?”

“I need to email marketing about the Launchpad, but that can wait until next week.”

The assistant should interpret those statements and execute the appropriate task-management actions without requiring the user to manually complete forms.

---

# 1. FIRST: AUDIT THE EXISTING PROJECT

Before changing anything:

1. Inspect the entire repository.
2. Determine:
   - framework / stack
   - routing
   - database / persistence
   - current task schema
   - existing AI integration
   - current API architecture
   - authentication
   - voice input capability if any
   - current task CRUD functions
   - current UI components
   - deployment architecture
   - environment variable handling
3. Identify what is already useful.
4. Preserve working functionality wherever sensible.
5. Do not unnecessarily replace working components.

Create a short implementation plan based on the existing system.

Then implement it.

Do not stop at analysis unless there is a genuine blocker that cannot be solved from the codebase.

---

# 2. PRODUCT PRINCIPLE

The central principle is:

AI = BRAIN

APPLICATION DATABASE = SOURCE OF TRUTH

The AI must NOT be the only place where task/project information exists.

Tasks, notes, deadlines, status, priority, project, completion history and related metadata must persist independently of the AI conversation.

This ensures the management system still works even if models or AI providers change later.

---

# 3. IN-APP AI ASSISTANT

Implement an embedded AI assistant using the OpenAI API.

Do NOT build a workflow requiring the user to:

- open ChatGPT separately
- copy information into ChatGPT
- copy responses back into the application
- manually import/export conversations

The assistant must operate directly inside the application.

Use the current recommended OpenAI API architecture for tool/function calling.

The API key must NEVER be exposed client-side.

Use secure server-side API access.

Use environment variables and appropriate backend/serverless architecture based on the existing stack.

---

# 4. AI TOOL / ACTION LAYER

Create a controlled action layer so the AI can perform application actions.

At minimum support equivalents of:

create_task()

update_task()

complete_task()

reopen_task()

delete_task()

add_task_note()

reschedule_task()

set_task_priority()

assign_task_project()

get_task()

search_tasks()

get_today_tasks()

get_upcoming_tasks()

get_overdue_tasks()

get_waiting_tasks()

get_completed_tasks()

create_project()

update_project()

get_project_context()

search_projects()

Do not allow the AI to manipulate the database arbitrarily.

All AI actions should go through validated application functions/tools.

Use structured schemas for tool calling.

Validate all tool arguments before writing to the database.

---

# 5. NATURAL LANGUAGE SHOULD BE THE PRIMARY INTERFACE

The user should NOT normally need to fill out forms.

For example:

User:
“Need to review the Moodle capstone questions before I meet Vittoria next week.”

The AI should infer something like:

Task:
Review Moodle capstone questions

Context:
Quality-control review before meeting with Vittoria

Due:
Before the relevant meeting / next week

Priority:
Appropriate based on workload and timing

The user should then get a concise confirmation.

Example:

“Added ‘Review Moodle capstone questions’ for Monday, ahead of your meeting with Vittoria.”

If information is genuinely ambiguous and materially affects execution,
