<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';
	import { resolve } from '$app/paths';
	import { theme } from '$lib/stores/theme.svelte.js';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	interface Props {
		children: Snippet;
		data: LayoutData;
	}

	let { children, data }: Props = $props();

	let sidebarOpen = $state(true);
	let mobileMenuOpen = $state(false);
	let userMenuOpen = $state(false);

	$effect(() => {
		if (!bp.laptopUp) {
			mobileMenuOpen = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard — TaskMaster Pro</title>
</svelte:head>

<div class="flex h-screen overflow-hidden" class:dark={theme.resolved === 'dark'}>
	<!-- Mobile/tablet sidebar backdrop -->
	{#if mobileMenuOpen}
		<div
			class="fixed inset-0 z-40 bg-black/50 lg:hidden"
			role="button"
			tabindex="-1"
			aria-label="Close sidebar"
			onclick={() => (mobileMenuOpen = false)}
			onkeydown={(e) => e.key === 'Escape' && (mobileMenuOpen = false)}
		></div>
	{/if}

	<!-- Sidebar: off-canvas on xs/sm/md, persistent on lg+ -->
	<aside
		class="fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-100 bg-white shadow-m3-1 transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] lg:static lg:z-auto dark:border-gray-800 dark:bg-gray-900 {mobileMenuOpen
			? 'translate-x-0'
			: '-translate-x-full lg:translate-x-0'} {sidebarOpen ? 'w-68' : 'w-16 lg:w-20'}"
	>
		<!-- Sidebar header — 48px height for comfortable touch -->
		<div class="flex h-16 items-center gap-3 px-4 py-2">
			<div
				class="bg-brand-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-m3-1"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
					/>
				</svg>
			</div>
			{#if sidebarOpen}
				<span class="text-sm font-bold text-gray-900 dark:text-white">TaskMaster Pro</span>
			{/if}
		</div>

		<!-- Navigation — min 44px touch targets per Apple HIG -->
		<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
			<a
				href={resolve('/dashboard')}
				class="flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				{#if sidebarOpen}<span class="tracking-wide">Dashboard</span>{/if}
			</a>
			<a
				href={resolve('/projects')}
				class="flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
					/>
				</svg>
				{#if sidebarOpen}<span class="tracking-wide">Projects</span>{/if}
			</a>
			<a
				href={resolve('/time-tracking')}
				class="flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				{#if sidebarOpen}<span class="tracking-wide">Time Tracking</span>{/if}
			</a>
			<a
				href={resolve('/analytics')}
				class="flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
					/>
				</svg>
				{#if sidebarOpen}<span class="tracking-wide">Analytics</span>{/if}
			</a>

			{#if sidebarOpen}
				<div class="pt-4">
					<p
						class="px-4 text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500"
					>
						Settings
					</p>
				</div>
			{/if}
			<a
				href={resolve('/settings/billing')}
				class="flex min-h-11 items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
					/>
				</svg>
				{#if sidebarOpen}<span class="tracking-wide">Billing</span>{/if}
			</a>
		</nav>

		<!-- Sidebar footer: collapse toggle (desktop only) -->
		<div class="hidden border-t border-gray-100 p-3 lg:block dark:border-gray-800">
			<button
				onclick={() => (sidebarOpen = !sidebarOpen)}
				class="flex min-h-11 w-full items-center justify-center rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-800 dark:active:bg-gray-700"
				aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5 transition-transform {sidebarOpen ? '' : 'rotate-180'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
				</svg>
			</button>
		</div>
	</aside>

	<!-- Main content area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Top bar — 48px on mobile, 48px on desktop -->
		<header
			class="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-3 shadow-sm md:px-4 lg:px-6 dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="flex items-center gap-2 md:gap-3">
				<!-- Mobile/tablet menu button — 44px touch target -->
				<button
					class="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:active:bg-gray-700"
					onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
					aria-label="Toggle menu"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>

				<!-- Search — hidden on phones, compact on tablets, full on desktop -->
				<div class="relative hidden md:block">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						placeholder="Search... (⌘K)"
						class="focus:border-brand-500 focus:ring-brand-500/20 w-48 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-3 pl-9 text-sm text-gray-900 placeholder-gray-400 transition focus:bg-white focus:ring-2 focus:outline-none lg:w-64 xl:w-80 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:bg-gray-800"
					/>
				</div>
			</div>

			<div class="flex items-center gap-1 md:gap-2">
				<!-- Theme toggle — 44px touch target -->
				<button
					onclick={() => theme.toggle()}
					class="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 active:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:active:bg-gray-700"
					aria-label="Toggle theme"
				>
					{#if theme.resolved === 'dark'}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					{:else}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
							/>
						</svg>
					{/if}
				</button>

				<!-- Notifications — 44px touch target -->
				<a
					href={resolve('/notifications')}
					class="relative flex h-11 w-11 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-800 dark:active:bg-gray-700"
					aria-label="Notifications"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
						/>
					</svg>
					{#if data.unreadNotifications > 0}
						<span
							class="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
						>
							{data.unreadNotifications > 9 ? '9+' : data.unreadNotifications}
						</span>
					{/if}
				</a>

				<!-- User menu -->
				<div class="relative">
					<button
						onclick={() => (userMenuOpen = !userMenuOpen)}
						class="flex h-11 items-center gap-2 rounded-full px-2 transition-colors hover:bg-gray-100/80 active:bg-gray-200/80 dark:hover:bg-gray-800 dark:active:bg-gray-700"
						aria-label="User menu"
					>
						{#if data.user.avatarUrl}
							<img src={data.user.avatarUrl} alt={data.user.name} class="h-8 w-8 rounded-full" />
						{:else}
							<div
								class="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
							>
								{data.user.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<span class="hidden text-sm font-medium text-gray-700 lg:block dark:text-gray-300"
							>{data.user.name}</span
						>
					</button>

					{#if userMenuOpen}
						<div
							class="absolute top-full right-0 z-50 mt-2 w-56 rounded-[24px] border border-gray-100 bg-white py-2 shadow-m3-3 focus:outline-none dark:border-gray-800 dark:bg-gray-900"
							role="menu"
						>
							<div class="border-b border-gray-100 px-4 py-2 dark:border-gray-700">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{data.user.name}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400">{data.user.email}</p>
							</div>
							<a
								href={resolve('/settings')}
								class="block min-h-11 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
								role="menuitem">Settings</a
							>
							<a
								href={resolve('/settings/billing')}
								class="block min-h-11 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
								role="menuitem">Billing</a
							>
							<div class="border-t border-gray-100 dark:border-gray-700">
								<form method="POST" action="/logout">
									<button
										type="submit"
										class="block min-h-11 w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-50 dark:text-red-400 dark:hover:bg-gray-700"
										role="menuitem"
									>
										Sign Out
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</header>

		<!-- Page content — responsive padding via child pages -->
		<main class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
			<svelte:boundary>
				{@render children()}
				{#snippet failed(error)}
					<div class="flex min-h-[50vh] items-center justify-center p-6">
						<div class="text-center">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-white">
								Something went wrong
							</h2>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								{error instanceof Error ? error.message : 'An unexpected error occurred'}
							</p>
							<button
								onclick={() => location.reload()}
								class="bg-brand-600 hover:bg-brand-700 mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
								>Reload page</button
							>
						</div>
					</div>
				{/snippet}
			</svelte:boundary>
		</main>
	</div>
</div>

<!-- Close user menu on outside click -->
<svelte:window
	onclick={(e) => {
		if (userMenuOpen) {
			const target = e.target as HTMLElement;
			if (!target.closest('[aria-label="User menu"]') && !target.closest('[role="menu"]')) {
				userMenuOpen = false;
			}
		}
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			userMenuOpen = false;
			mobileMenuOpen = false;
		}
	}}
/>
