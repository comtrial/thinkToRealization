import { z } from "zod";

export const createDecisionSchema = z.object({
  nodeId: z.string(),
  sessionId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

export const promoteDecisionSchema = z.object({
  nodeType: z.enum(["idea", "decision", "task", "issue", "milestone", "note"]),
  title: z.string().min(1).max(200),
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;
export type PromoteDecisionInput = z.infer<typeof promoteDecisionSchema>;
