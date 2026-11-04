import { z } from "zod";

export const planHandoffSearch = z.object({
  studentId: z.string().uuid().optional().catch(undefined),
  source: z.literal("predictionDemo").optional().catch(undefined),
});

/** Search parameters select only an already-accessible record; they never grant access. */
export function findHandoffStudent<T extends { id: string }>(
  students: T[],
  studentId: string | undefined,
) {
  return studentId ? students.find((student) => student.id === studentId) : undefined;
}
