// Builds the prompt Claude gets: team policy first, then the task prompt, with blanks filled.

const BLANK = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

/** Replaces {{ name }} with values. Unknown blanks stay as they are and are listed in `missing`. */
export function fillBlanks(template: string, values: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const text = template.replace(BLANK, (whole, name: string) => {
    if (name in values) return values[name];
    missing.add(name);
    return whole;
  });
  return { text, missing: [...missing] };
}

export function buildPrompt(p: { teamPolicy: string; taskPrompt: string; values: Record<string, string> }) {
  const parts = [p.teamPolicy.trim(), p.taskPrompt.trim()].filter(Boolean);
  return fillBlanks(parts.join("\n\n---\n\n"), p.values);
}
