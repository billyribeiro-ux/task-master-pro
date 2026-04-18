const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = BASE62.length;
const SMALLEST_CHAR = BASE62[0];
const LARGEST_CHAR = BASE62[BASE - 1];

function midpoint(a: string, b: string | undefined): string {
	let result = '';
	const maxLen = Math.max(a.length, b?.length ?? 0);

	for (let i = 0; i < maxLen; i++) {
		const aChar = i < a.length ? a[i] : SMALLEST_CHAR;
		const bChar = b !== undefined && i < b.length ? b[i] : LARGEST_CHAR;

		const aIndex = BASE62.indexOf(aChar);
		const bIndex = BASE62.indexOf(bChar);

		if (aIndex < bIndex) {
			const mid = Math.floor((aIndex + bIndex) / 2);
			result += BASE62[mid];
			if (mid > aIndex) {
				return result;
			}
		} else if (aIndex === bIndex) {
			result += aChar;
		} else {
			throw new Error(`Invalid order: a[${i}]='${aChar}' >= b[${i}]='${bChar}'`);
		}
	}

	const aLastIndex = a.length > 0 ? BASE62.indexOf(a[a.length - 1]) : -1;
	const midIndex =
		b === undefined
			? Math.min(aLastIndex + Math.floor(BASE / 2), BASE - 1)
			: Math.floor((aLastIndex + BASE) / 2);

	result += BASE62[midIndex];
	return result;
}

export function generateKeyBetween(a: string | null, b: string | null): string {
	if (a === null && b === null) {
		return 'a0';
	}

	if (a === null) {
		const bVal = b!;
		const firstCharIndex = BASE62.indexOf(bVal[0]);
		if (firstCharIndex > 0) {
			const mid = Math.floor(firstCharIndex / 2);
			return BASE62[mid];
		}
		return midpoint('', bVal);
	}

	if (b === null) {
		return midpoint(a, undefined);
	}

	if (a >= b) {
		throw new Error(`a must be less than b: a='${a}', b='${b}'`);
	}

	return midpoint(a, b);
}

export function generateNKeysBetween(a: string | null, b: string | null, n: number): string[] {
	if (n === 0) return [];
	if (n === 1) return [generateKeyBetween(a, b)];

	const keys: string[] = [];
	let prev = a;

	for (let i = 0; i < n; i++) {
		const key = generateKeyBetween(prev, b);
		keys.push(key);
		prev = key;
	}

	return keys;
}
