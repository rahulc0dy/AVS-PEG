import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const {
  NEXT_PUBLIC_ROAD_WIDTH: ROAD_WIDTH,
  NEXT_PUBLIC_MINICAM_HEIGHT: MINICAM_HEIGHT,
  NEXT_PUBLIC_MINICAM_FORWARD: MINICAM_FORWARD,
  NEXT_PUBLIC_MINICAM_LOOKAHEAD: MINICAM_LOOKAHEAD,
} = createEnv({
  client: {
    NEXT_PUBLIC_ROAD_WIDTH: z
      .string()
      .nonempty()
      .transform((rw) => parseInt(rw))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(20),
    NEXT_PUBLIC_MINICAM_HEIGHT: z
      .string()
      .nonempty()
      .transform((mh) => parseInt(mh))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(12),
    NEXT_PUBLIC_MINICAM_FORWARD: z
      .string()
      .transform((mf) => parseInt(mf))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(18),
    NEXT_PUBLIC_MINICAM_LOOKAHEAD: z
      .string()
      .transform((mla) => parseInt(mla))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(50),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_ROAD_WIDTH: process.env.NEXT_PUBLIC_ROAD_WIDTH,
    NEXT_PUBLIC_MINICAM_HEIGHT: process.env.NEXT_PUBLIC_MINICAM_HEIGHT,
    NEXT_PUBLIC_MINICAM_FORWARD: process.env.NEXT_PUBLIC_MINICAM_FORWARD,
    NEXT_PUBLIC_MINICAM_LOOKAHEAD: process.env.NEXT_PUBLIC_MINICAM_LOOKAHEAD,
  },
});
