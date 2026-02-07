import { browser } from '$app/environment';

type ThemeMode = 'light' | 'dark' | 'system';

class ThemeState {
	mode = $state<ThemeMode>('system');
	resolved = $derived.by(() => {
		if (this.mode !== 'system') return this.mode;
		if (!browser) return 'light';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	});

	constructor() {
		if (browser) {
			const saved = localStorage.getItem('theme') as ThemeMode | null;
			if (saved) {
				this.mode = saved;
			}
		}
	}

	toggle() {
		this.mode = this.resolved === 'light' ? 'dark' : 'light';
		if (browser) {
			localStorage.setItem('theme', this.mode);
		}
	}

	setMode(mode: ThemeMode) {
		this.mode = mode;
		if (browser) {
			localStorage.setItem('theme', mode);
		}
	}
}

export const theme = new ThemeState();
