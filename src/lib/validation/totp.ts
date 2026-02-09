import { z } from 'zod';

export const totpSetupSchema = z.object({
	password: z.string().min(1, 'Current password is required for 2FA setup')
});

export type TotpSetupInput = z.infer<typeof totpSetupSchema>;

export const totpVerifySchema = z.object({
	code: z
		.string()
		.length(6, 'TOTP code must be exactly 6 digits')
		.regex(/^\d{6}$/, 'TOTP code must be numeric')
});

export type TotpVerifyInput = z.infer<typeof totpVerifySchema>;

export const totpDisableSchema = z.object({
	password: z.string().min(1, 'Password is required to disable 2FA'),
	code: z
		.string()
		.length(6)
		.regex(/^\d{6}$/)
});

export type TotpDisableInput = z.infer<typeof totpDisableSchema>;

export const recoveryCodeSchema = z.object({
	code: z
		.string()
		.min(1, 'Recovery code is required')
		.max(50)
});

export type RecoveryCodeInput = z.infer<typeof recoveryCodeSchema>;
