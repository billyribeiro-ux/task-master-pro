import type { SessionUser } from '$lib/server/auth/index.js';

class AuthState {
	user = $state<SessionUser | null>(null);
	isAuthenticated = $derived(this.user !== null);
	isPro = $derived(this.user?.plan === 'pro' || this.user?.plan === 'enterprise');
	isAdmin = $derived(this.user?.role === 'admin' || this.user?.role === 'superadmin');

	setUser(user: SessionUser | null) {
		this.user = user;
	}

	clear() {
		this.user = null;
	}
}

export const auth = new AuthState();
