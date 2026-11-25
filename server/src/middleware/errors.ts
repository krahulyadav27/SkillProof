import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
export function notFound(_req: Request, res: Response) { res.status(404).json({ error: { code: "NOT_FOUND", message: "That resource was not found." } }); }
export function errors(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Check the submitted fields.", details: err.flatten() } });
  const e = err as { status?: number; code?: string; message?: string };
  if (e.code === "23505") return res.status(409).json({ error: { code: "CONFLICT", message: "That record already exists." } });
  if (e.code === "23503") return res.status(409).json({ error: { code: "RELATED_RECORDS_EXIST", message: "This action conflicts with records that still depend on it." } });
  console.error(err);
  res.status(e.status ?? 500).json({ error: { code: e.code ?? "INTERNAL_ERROR", message: e.status ? e.message : "Something went wrong. Please try again." } });
}
