<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	interface Props {
		children: Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 {bp.phone ? 'px-4 py-8' : 'px-6 py-12'} dark:bg-gray-950">
	<div class="w-full max-w-md">
		<div class="mb-8 flex flex-col items-center">
			<a href="/" class="flex items-center gap-2">
				<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
				</div>
				<span class="text-xl font-bold text-gray-900 dark:text-white">TaskMaster Pro</span>
			</a>
		</div>
		{@render children()}
	</div>
</div>
