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
		class="mb-6 flex flex-col gap-4 {bp.tabletUp
			? 'mb-8 flex-row items-center justify-between'
			: ''}"
	>
		<div>
			<h1 class="{bp.headingSize} tracking-tight font-bold text-gray-900 dark:text-gray-100">{title}</h1>
			{#if description}
				<p class="mt-1.5 text-base text-gray-600 dark:text-gray-400">{description}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex shrink-0 items-center gap-3">
				{@render actions()}
			</div>
		{/if}
	</div>
	{@render children()}
</div>
