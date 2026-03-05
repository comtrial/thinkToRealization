import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_-]+$/, "Slug must be lowercase alphanumeric with hyphens or underscores"),
  description: z.string().max(2000).optional(),
  projectDir: z.string().min(1),
  claudeMdPath: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  claudeMdPath: z.string().nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
