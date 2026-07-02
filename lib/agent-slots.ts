export const MAX_AGENT_SLOTS = 3;
export const SLOT_UNLOCK_CREDITS_COST = 500;
export const SLOT_UNLOCK_WINS_PER_SLOT = 10;
export const DIRECTIVE_MAX_LENGTH = 500;

export const DIRECTIVE_REJECT_PATTERNS = [
  /ignore (all )?previous/i,
  /system prompt/i,
  /jailbreak/i,
  /reveal .*(prompt|secret|instructions)/i,
  /disregard .*(rules|instructions)/i,
] as const;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function validateDirective(text: string): { ok: true } | { ok: false } {
  if (text.length > DIRECTIVE_MAX_LENGTH) return { ok: false };
  if (CONTROL_CHARACTER_PATTERN.test(text)) return { ok: false };
  if (DIRECTIVE_REJECT_PATTERNS.some((pattern) => pattern.test(text))) return { ok: false };
  return { ok: true };
}

export function winsRequiredForNextSlot(currentSlots: number) {
  return currentSlots * SLOT_UNLOCK_WINS_PER_SLOT;
}
