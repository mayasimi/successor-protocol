import { z } from "zod";

export const emailSchema = z.string().email().max(255);
export const passwordSchema = z.string().min(8).max(64);
export const walletAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const nameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z\s'-]+$/);
export const graceDaysSchema = z.enum(["3", "7", "14"]).transform(Number);
