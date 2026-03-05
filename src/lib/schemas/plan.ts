import { z } from "zod";

export const planStatusEnum = z.enum(["draft", "approved", "rejected", "revised"]);
const riskLevelEnum = z.enum(["low", "medium", "high"]);
const fileActionEnum = z.enum(["create", "modify", "delete"]);
const testTypeEnum = z.enum(["unit", "integration", "e2e"]);

export const planContentSchema = z.object({
  summary: z.string().min(1).max(1000),
  affectedFiles: z.array(
    z.object({
      path: z.string().min(1),
      action: fileActionEnum,
      description: z.string(),
    })
  ),
  changes: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string(),
      risk: riskLevelEnum,
    })
  ),
  testPlan: z.array(
    z.object({
      description: z.string(),
      type: testTypeEnum,
    })
  ),
  risks: z.array(
    z.object({
      description: z.string(),
      severity: riskLevelEnum,
      mitigation: z.string(),
    })
  ),
});

export const createPlanSchema = z.object({
  nodeId: z.string().min(1),
});

export const updatePlanStatusSchema = z.object({
  status: planStatusEnum,
  reviewNote: z.string().max(2000).optional(),
});

export const updatePlanContentSchema = z.object({
  content: planContentSchema,
});

export type PlanContentInput = z.infer<typeof planContentSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanStatusInput = z.infer<typeof updatePlanStatusSchema>;
export type UpdatePlanContentInput = z.infer<typeof updatePlanContentSchema>;
