<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		actions?: Snippet;
		fullWidth?: boolean;
	}

	let { title, description, children, actions, fullWidth = false }: Props = $props();
</script>

<div class="{bp.pagePadding} {fullWidth ? '' : 'mx-auto max-w-7xl'}">
	<div
		class="mb-5 flex flex-col gap-3 {bp.tabletUp
			? 'mb-6 flex-row items-center justify-between'
			: ''}"
	>
		<div>
			<h1 class="{bp.headingSize} font-bold text-gray-900 dark:text-white">{title}</h1>
			{#if description}
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
	{@render children()}
</div>
