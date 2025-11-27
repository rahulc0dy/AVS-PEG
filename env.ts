import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const { NEXT_PUBLIC_ROAD_WIDTH: ROAD_WIDTH } = createEnv({
  client: {
    NEXT_PUBLIC_ROAD_WIDTH: z
      .string()
      .nonempty()
      .transform((rw) => parseInt(rw))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(20),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_ROAD_WIDTH: process.env.NEXT_PUBLIC_ROAD_WIDTH,
  },
});
