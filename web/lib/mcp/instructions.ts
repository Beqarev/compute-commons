// The workflow lives here, on the server, so a Claude schedule only needs the one-line SETUP_PROMPT.

export const MCP_INSTRUCTIONS = [
  "This server hands out your team's tasks. Each item of a task is claimed separately, so nobody does the same work twice. To work on them:",
  "1. Call list_work. It returns the items you may take, in order, and this run's budget.",
  "2. Take the first item and call claim. If it is taken, move to the next one. Never work on an item you have not claimed.",
  "3. Call get_task for the claimed item and follow the instructions it returns exactly.",
  "4. On long items, call heartbeat at least every 30 minutes, or your lease runs out and someone else may take the item.",
  "5. Finish each item with complete (a short summary, plus details: what you did, where the result is, anything a human should know), fail (reason), or skip (reason, when you decide not to take it).",
  "6. Then call list_work again. Stop when it is empty or the budget is used up.",
].join("\n");

export const SETUP_PROMPT = `Use the "commons" MCP connector and work through our team's task queue.`;
