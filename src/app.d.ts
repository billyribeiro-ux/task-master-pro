declare global {
	namespace App {
		interface Locals {
			user: import('$lib/server/auth').SessionUser | null;
			session: import('$lib/server/auth').Session | null;
			requestId: string;
		}
		interface Error {
			message: string;
			code?: string;
		}
		interface PageData {
			user: import('$lib/server/auth').SessionUser | null;
		}
	}
}

export {};
