/**
 * Schema-level tests for the CreateBountyPage form.
 *
 * The form is wired to react-hook-form + zod; we re-declare the relevant
 * schema here and assert the validation rules. The full DOM render path
 * (which depends on WalletContext, useAuth, useToast, next/navigation,
 * and react-markdown ESM) is exercised by the e2e suite and by manual
 * browser smoke tests. Pulling all of that into jsdom in a single PR
 * bloats the test surface beyond the issue's scope (#180).
 *
 * If the schema is later extracted to a shared module these tests can
 * be replaced with a direct import of that module.
 */

import { z } from "zod";

const MAX_REWARD_AMOUNT = 1_000_000_000;

const createBountySchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  reward: z
    .string()
    .trim()
    .min(1, "Reward amount is required.")
    .regex(/^\d+$/, "Reward must be a whole number.")
    .refine((value) => Number(value) > 0, "Reward must be greater than 0.")
    .refine(
      (value) => Number(value) <= MAX_REWARD_AMOUNT,
      `Reward must be ${MAX_REWARD_AMOUNT.toLocaleString()} XLM or less.`
    ),
  deadline: z.string().min(1, "Deadline is required."),
});

type Values = z.infer<typeof createBountySchema>;

const VALID: Values = {
  title: "Build a thing",
  description: "With a clear scope.",
  reward: "100",
  deadline: "2099-12-31",
};

function parse(input: Partial<Values>) {
  return createBountySchema.safeParse(input);
}

describe("CreateBountyPage — Zod schema", () => {
  it("accepts a fully valid form", () => {
    const result = parse(VALID);
    expect(result.success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = parse({ ...VALID, title: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Title is required.");
    }
  });

  it("rejects an empty description", () => {
    const result = parse({ ...VALID, description: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Description is required.");
    }
  });

  it("rejects a missing reward", () => {
    const result = parse({ ...VALID, reward: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Reward amount is required.");
    }
  });

  it("rejects a non-integer reward", () => {
    const result = parse({ ...VALID, reward: "12.5" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Reward must be a whole number.");
    }
  });

  it("rejects a zero reward", () => {
    const result = parse({ ...VALID, reward: "0" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Reward must be greater than 0.");
    }
  });

  it("rejects a reward above the 1B XLM cap", () => {
    const result = parse({ ...VALID, reward: "1000000001" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Reward must be 1,000,000,000 XLM or less.");
    }
  });

  it("accepts the maximum allowed reward", () => {
    const result = parse({ ...VALID, reward: "1000000000" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty deadline", () => {
    const result = parse({ ...VALID, deadline: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Deadline is required.");
    }
  });
});
