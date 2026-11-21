import { z } from "zod";

export const pageNumber = z.string().regex(/^\d{1,5}$/).transform(Number).pipe(z.number().min(1).max(10_000)).default(1);
export const pageLimit = z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().min(1).max(100)).default(20);
export const blank = (value: unknown) => value === "" ? undefined : value;
