import { innerWidth } from 'svelte/reactivity/window';

/**
 * Centralized responsive breakpoint store.
 * Single source of truth for all device-responsive logic.
 *
 * Breakpoints (defined in app.css @theme):
 *   xs:  0–479    — Phones portrait (iPhone SE–17, Pixel, Galaxy)
 *   sm:  480–767   — Phones landscape, compact split views
 *   md:  768–1023  — Tablets (iPad mini/Air 11", Galaxy Tab, Surface Go)
 *   lg:  1024–1279 — Large tablets (iPad Pro 13", Surface Pro, Stage Manager)
 *   xl:  1280–1535 — Small laptops (MacBook Air 13", Surface Laptop)
 *   2xl: 1536–1919 — Large laptops (MacBook Pro 14–16", Dell XPS)
 *   3xl: 1920+     — Desktops (iMac, external monitors, ultrawide)
 */
class BreakpointState {
	get width() {
		return innerWidth.current ?? 1280;
	}

	get xs() {
		return this.width < 480;
	}
	get sm() {
		return this.width >= 480 && this.width < 768;
	}
	get md() {
		return this.width >= 768 && this.width < 1024;
	}
	get lg() {
		return this.width >= 1024 && this.width < 1280;
	}
	get xl() {
		return this.width >= 1280 && this.width < 1536;
	}
	get xxl() {
		return this.width >= 1536 && this.width < 1920;
	}
	get xxxl() {
		return this.width >= 1920;
	}

	/** Phone — portrait or landscape (< 768px) */
	get phone() {
		return this.width < 768;
	}
	/** Tablet — iPad mini through iPad Pro 11" (768–1023px) */
	get tablet() {
		return this.width >= 768 && this.width < 1024;
	}
	/** Laptop — MacBook Air through MacBook Pro (1024–1919px) */
	get laptop() {
		return this.width >= 1024 && this.width < 1920;
	}
	/** Desktop — iMac, external monitors (1920px+) */
	get desktop() {
		return this.width >= 1920;
	}

	/** Tablet or larger (>= 768px) — sidebar overlay threshold */
	get tabletUp() {
		return this.width >= 768;
	}
	/** Laptop or larger (>= 1024px) — persistent sidebar threshold */
	get laptopUp() {
		return this.width >= 1024;
	}
	/** Desktop or larger (>= 1920px) — extra-wide layouts */
	get desktopUp() {
		return this.width >= 1920;
	}

	/** Responsive page padding class */
	get pagePadding() {
		if (this.phone) return 'p-4';
		if (this.tablet) return 'p-6';
		if (this.laptop) return 'p-8';
		return 'p-10';
	}

	/** Responsive gap class for grids */
	get gridGap() {
		if (this.phone) return 'gap-3';
		if (this.tablet) return 'gap-4';
		return 'gap-5';
	}

	/** Responsive heading size */
	get headingSize() {
		if (this.phone) return 'text-xl';
		if (this.tablet) return 'text-2xl';
		return 'text-3xl';
	}
}

export const bp = new BreakpointState();
