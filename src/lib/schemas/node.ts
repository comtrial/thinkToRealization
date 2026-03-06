import { z } from "zod";

const nodeTypeEnum = z.enum(["planning", "feature", "issue"]);
const nodeStatusEnum = z.enum(["backlog", "todo", "in_progress", "done", "archived"]);
const priorityEnum = z.enum(["none", "low", "medium", "high", "urgent"]);

export const createNodeSchema = z.object({
  type: nodeTypeEnum,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: nodeStatusEnum.optional(),
  priority: priorityEnum.optional(),
  canvasX: z.number(),
  canvasY: z.number(),
  canvasW: z.number().optional(),
  canvasH: z.number().optional(),
  parentNodeId: z.string().optional(),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  priority: priorityEnum.optional(),
  type: nodeTypeEnum.optional(),
  canvasX: z.number().optional(),
  canvasY: z.number().optional(),
  canvasW: z.number().optional(),
  canvasH: z.number().optional(),
  parentNodeId: z.string().nullable().optional(),
});

export const updateNodeStatusSchema = z.object({
  status: nodeStatusEnum,
  triggerType: z.literal("user_manual"),
});

export const updateNodePositionSchema = z.object({
  canvasX: z.number(),
  canvasY: z.number(),
});

export const bulkUpdatePositionsSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      canvasX: z.number(),
      canvasY: z.number(),
    })
  ).min(1).max(500),
});

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type UpdateNodeStatusInput = z.infer<typeof updateNodeStatusSchema>;
export type BulkUpdatePositionsInput = z.infer<typeof bulkUpdatePositionsSchema>;
