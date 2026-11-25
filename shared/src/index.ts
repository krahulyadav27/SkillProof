export const roles = ["STUDENT", "ADMIN", "REVIEWER"] as const;
export type Role = (typeof roles)[number];
export const difficulties = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof difficulties)[number];
export type ApiError = { error: { code: string; message: string; details?: unknown } };
