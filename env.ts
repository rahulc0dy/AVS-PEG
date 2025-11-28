import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const {
  NEXT_PUBLIC_ROAD_WIDTH: ROAD_WIDTH,
  NEXT_PUBLIC_MINICAM_HEIGHT: MINICAM_HEIGHT,
  NEXT_PUBLIC_MINICAM_FORWARD: MINICAM_FORWARD,
  NEXT_PUBLIC_MINICAM_LOOKAHEAD: MINICAM_LOOKAHEAD,
  NEXT_PUBLIC_MINICAM_FOV: MINICAM_FOV,
  NEXT_PUBLIC_MINICAM_ASPECT: MINICAM_ASPECT,
  NEXT_PUBLIC_MINICAM_FAR: MINICAM_FAR,
  NEXT_PUBLIC_MINICAM_NEAR: MINICAM_NEAR,
  NEXT_PUBLIC_MINIVIEW_HEIGHT: MINIVIEW_HEIGHT,
  NEXT_PUBLIC_MINIVIEW_WIDTH: MINIVIEW_WIDTH,
  NEXT_PUBLIC_MINIVIEW_X: MINIVIEW_X,
  NEXT_PUBLIC_MINIVIEW_Y: MINIVIEW_Y,
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
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(50),
    NEXT_PUBLIC_MINICAM_FOV: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(90),
    NEXT_PUBLIC_MINICAM_ASPECT: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(1.778),
    NEXT_PUBLIC_MINICAM_NEAR: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(3),
    NEXT_PUBLIC_MINICAM_FAR: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(10000),
    NEXT_PUBLIC_MINIVIEW_X: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(16),
    NEXT_PUBLIC_MINIVIEW_Y: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(16),
    NEXT_PUBLIC_MINIVIEW_WIDTH: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(320),
    NEXT_PUBLIC_MINIVIEW_HEIGHT: z
      .string()
      .transform((v) => parseInt(v))
      .refine((num) => !isNaN(num) && num > 0, {
        message: "ROAD_WIDTH must be a number greater than 0",
      })
      .default(180),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_ROAD_WIDTH: process.env.NEXT_PUBLIC_ROAD_WIDTH,
    NEXT_PUBLIC_MINICAM_HEIGHT: process.env.NEXT_PUBLIC_MINICAM_HEIGHT,
    NEXT_PUBLIC_MINICAM_FORWARD: process.env.NEXT_PUBLIC_MINICAM_FORWARD,
    NEXT_PUBLIC_MINICAM_LOOKAHEAD: process.env.NEXT_PUBLIC_MINICAM_LOOKAHEAD,
    NEXT_PUBLIC_MINICAM_FOV: process.env.NEXT_PUBLIC_MINICAM_FOV,
    NEXT_PUBLIC_MINICAM_ASPECT: process.env.NEXT_PUBLIC_MINICAM_ASPECT,
    NEXT_PUBLIC_MINICAM_NEAR: process.env.NEXT_PUBLIC_MINICAM_NEAR,
    NEXT_PUBLIC_MINICAM_FAR: process.env.NEXT_PUBLIC_MINICAM_FAR,
    NEXT_PUBLIC_MINIVIEW_X: process.env.NEXT_PUBLIC_MINIVIEW_X,
    NEXT_PUBLIC_MINIVIEW_Y: process.env.NEXT_PUBLIC_MINIVIEW_Y,
    NEXT_PUBLIC_MINIVIEW_WIDTH: process.env.NEXT_PUBLIC_MINIVIEW_WIDTH,
    NEXT_PUBLIC_MINIVIEW_HEIGHT: process.env.NEXT_PUBLIC_MINIVIEW_HEIGHT,
  },
});
