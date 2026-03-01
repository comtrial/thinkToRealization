import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
});

export const endSessionSchema = z.object({
  completed: z.boolean(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type EndSessionInput = z.infer<typeof endSessionSchema>;
