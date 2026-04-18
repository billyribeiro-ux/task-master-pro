<script lang="ts">
	import type { PageData } from './$types.js';
	import { resolve } from '$app/paths';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>TaskMaster Pro</title>
</svelte:head>

<div
	class="from-brand-50 to-brand-100 flex min-h-screen flex-col items-center justify-center bg-linear-to-br dark:from-gray-950 dark:to-gray-900"
>
	<div class="mx-auto max-w-2xl {bp.phone ? 'px-4' : 'px-6'} text-center">
		<div class="mb-8 flex items-center justify-center">
			<div
				class="bg-brand-600 flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-8 w-8"
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
		</div>

		<h1
			class="mb-4 {bp.phone
				? 'text-3xl'
				: bp.tablet
					? 'text-4xl'
					: 'text-5xl'} font-bold tracking-tight text-gray-900 dark:text-white"
		>
			TaskMaster <span class="text-brand-600">Pro</span>
		</h1>

		<p class="mb-10 text-lg text-gray-600 dark:text-gray-400">
			Production-grade project management. Real-time Kanban boards, time tracking, file attachments,
			and analytics.
		</p>

		<div class="flex {bp.phone ? 'flex-col' : 'flex-row justify-center'} items-center gap-4">
			{#if data.user}
				<a
					href={resolve('/dashboard')}
					class="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600 inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					Go to Dashboard
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="ml-2 h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</a>
			{:else}
				<a
					href={resolve('/register')}
					class="bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600 inline-flex items-center rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					Get Started Free
				</a>
				<a
					href={resolve('/login')}
					class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				>
					Sign In
				</a>
			{/if}
		</div>
	</div>
</div>
