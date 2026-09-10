import { z } from 'zod';

// We'll use Zod for validation and then extract TypeScript types.

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const RegisterResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  created_at: z.string(),
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    created_at: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const LogoutResponseSchema = z.object({
  success: z.boolean(),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  created_at: z.string(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
