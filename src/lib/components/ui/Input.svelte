<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends HTMLInputAttributes {
		label?: string;
		error?: string | null;
		value?: string;
	}

	let {
		label,
		error = null,
		value = $bindable(''),
		id,
		class: className = '',
		...rest
	}: Props = $props();
</script>

<div>
	{#if label}
		<label for={id} class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
	{/if}
	<input
		{id}
		bind:value
		class="block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:ring-2 focus:outline-none dark:text-white {error
			? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700'
			: 'border-gray-300 focus:border-brand-500 focus:ring-brand-500/20 dark:border-gray-700'} bg-white dark:bg-gray-800 {className}"
		{...rest}
	/>
	{#if error}
		<p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
	{/if}
</div>
