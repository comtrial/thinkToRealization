import { z } from "zod";

const edgeTypeEnum = z.enum(["related", "parent_child", "sequence", "dependency", "regression", "branch"]);

export const createEdgeSchema = z.object({
  fromNodeId: z.string(),
  toNodeId: z.string(),
  type: edgeTypeEnum.optional(),
  label: z.string().max(200).optional(),
});

export const updateEdgeSchema = z.object({
  type: edgeTypeEnum.optional(),
  label: z.string().max(200).nullable().optional(),
});

export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;
export type UpdateEdgeInput = z.infer<typeof updateEdgeSchema>;
