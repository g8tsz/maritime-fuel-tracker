import { z } from "zod";

export const cuid = z.string().cuid();
export const decimalString = z.union([z.string(), z.number()]).transform((v) => String(v));
