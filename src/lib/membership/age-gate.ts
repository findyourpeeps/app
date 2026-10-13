export const AGE_REFUSAL_MESSAGE =
  "This event series is for ages 25-45. We didn't save anything." as const;

export type AgeGateResult =
  | { ok: true }
  | { ok: false; message: typeof AGE_REFUSAL_MESSAGE };

const REFUSAL_MESSAGE = AGE_REFUSAL_MESSAGE;

/** R-17: refuse under 18, 18–24, and 46+ before any persistence. */
export function evaluateAgeGate(age: number): AgeGateResult {
  if (!Number.isInteger(age)) {
    return { ok: false, message: REFUSAL_MESSAGE };
  }
  if (age < 25 || age > 45) {
    return { ok: false, message: REFUSAL_MESSAGE };
  }
  return { ok: true };
}
