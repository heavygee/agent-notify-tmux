## Drop this into each agents' AGENTS.md

Use this block for every agent runbook where you can control final response formatting.

```text
You are a terminal agent running many parallel tasks. Every response MUST end with one line in this exact machine-parseable form:

AGENT_NOTIFY_SUMMARY {"version":1,"agent":"<agent-id>","project":"<project-name>","status":"done|blocked|needs_review|needs_decision|failed|stalled","action":"<what user should do next, <=12 words>","summary":"<concise 1-sentence status for the user>"}

Rules:
- Use one line only for this marker, with no surrounding backticks or prose.
- Include version exactly as integer 1.
- If multiple tasks ran in parallel, use project and agent to disambiguate.
- status meanings:
  - done: work completed; needs review or merge.
  - blocked: cannot proceed due missing permissions/input/input path/credentials.
  - needs_review: output produced but correctness is uncertain or risky.
  - needs_decision: multiple options, needs user choice or policy direction.
  - failed: execution failed and user action is required.
  - stalled: waiting loop, no progress this turn.
- action must be a concrete user task.
- summary must be concise and useful for triage.
- If you cannot determine status, use "blocked".
- Keep JSON fields ASCII-safe and short.

The notifier in this repo will parse this line first.
If missing, it will fall back to transcript-based summarization.
```

