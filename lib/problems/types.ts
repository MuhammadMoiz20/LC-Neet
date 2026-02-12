import { z } from "zod";

export const TestCase = z.object({
  input: z.unknown(),
  expected: z.unknown(),
});

export const Problem = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  difficulty: z.enum(["Easy", "Medium", "Hard"]),
  topic: z.string(),
  neetcode_video_url: z.url().nullable(),
  description_md: z.string(),
  starter_code: z.string(),
  test_cases: z.array(TestCase),
  editorial_md: z.string().nullable(),
});

export type Problem = z.infer<typeof Problem>;
export const Problems = z.array(Problem);
