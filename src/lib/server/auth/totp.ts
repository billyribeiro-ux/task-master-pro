import { createHash, randomBytes, createHmac } from 'crypto';

const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const TOTP_ISSUER = 'TaskMasterPro';
const TOTP_WINDOW = 1; // Allow 1 step before/after for clock skew

// Base32 alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode a buffer to base32 string.
 */
function base32Encode(buffer: Buffer): string {
	let result = '';
	let bits = 0;
	let value = 0;

	for (const byte of buffer) {
		value = (value << 8) | byte;
		bits += 8;

		while (bits >= 5) {
			bits -= 5;
			result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
		}
	}

	if (bits > 0) {
		result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
	}

	return result;
}

/**
 * Decode a base32 string to a buffer.
 */
function base32Decode(encoded: string): Buffer {
	const cleanInput = encoded.replace(/=+$/, '').toUpperCase();
	const bytes: number[] = [];
	let bits = 0;
	let value = 0;

	for (const char of cleanInput) {
		const idx = BASE32_ALPHABET.indexOf(char);
		if (idx === -1) {
			throw new Error(`Invalid base32 character: ${char}`);
		}

		value = (value << 5) | idx;
		bits += 5;

		if (bits >= 8) {
			bits -= 8;
			bytes.push((value >>> bits) & 0xff);
		}
	}

	return Buffer.from(bytes);
}

/**
 * Generate a random TOTP secret (20 bytes, base32-encoded).
 */
export function generateTotpSecret(): string {
	const buffer = randomBytes(20);
	return base32Encode(buffer);
}

/**
 * Generate an otpauth:// URI for QR code generation.
 */
export function generateTotpUri(secret: string, email: string): string {
	const encodedIssuer = encodeURIComponent(TOTP_ISSUER);
	const encodedEmail = encodeURIComponent(email);
	return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate an HOTP code for a given counter value.
 */
function generateHotp(secret: string, counter: number): string {
	const secretBuffer = base32Decode(secret);

	// Convert counter to 8-byte big-endian buffer
	const counterBuffer = Buffer.alloc(8);
	let temp = counter;
	for (let i = 7; i >= 0; i--) {
		counterBuffer[i] = temp & 0xff;
		temp = Math.floor(temp / 256);
	}

	// HMAC-SHA1
	const hmac = createHmac(TOTP_ALGORITHM, secretBuffer);
	hmac.update(counterBuffer);
	const digest = hmac.digest();

	// Dynamic truncation
	const offset = digest[digest.length - 1] & 0x0f;
	const binary =
		((digest[offset] & 0x7f) << 24) |
		((digest[offset + 1] & 0xff) << 16) |
		((digest[offset + 2] & 0xff) << 8) |
		(digest[offset + 3] & 0xff);

	const otp = binary % Math.pow(10, TOTP_DIGITS);
	return otp.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a 6-digit TOTP code against a secret.
 * Allows a window of +/- 1 time step for clock skew tolerance.
 */
export function verifyTotpCode(secret: string, code: string): boolean {
	const currentTime = Math.floor(Date.now() / 1000);
	const currentCounter = Math.floor(currentTime / TOTP_PERIOD);

	for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
		const expectedCode = generateHotp(secret, currentCounter + i);
		// Constant-time comparison to prevent timing attacks
		if (timingSafeEqual(code, expectedCode)) {
			return true;
		}
	}

	return false;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);

	let result = 0;
	for (let i = 0; i < bufA.length; i++) {
		result |= bufA[i] ^ bufB[i];
	}

	return result === 0;
}

/**
 * Generate a set of recovery codes.
 */
export function generateRecoveryCodes(count: number = 8): string[] {
	const codes: string[] = [];
	for (let i = 0; i < count; i++) {
		const bytes = randomBytes(5);
		const code = bytes.toString('hex').toUpperCase();
		// Format as XXXXX-XXXXX
		codes.push(`${code.substring(0, 5)}-${code.substring(5, 10)}`);
	}
	return codes;
}

/**
 * SHA-256 hash a recovery code for secure storage.
 */
export function hashRecoveryCode(code: string): string {
	return createHash('sha256').update(code.toUpperCase()).digest('hex');
}
