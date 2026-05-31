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
		<label for={id} class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>{label}</label
		>
	{/if}
	<input
		{id}
		bind:value
		class="block w-full rounded-xl border-2 px-4 py-3 text-sm text-gray-900 placeholder-gray-500 transition-colors focus:outline-none dark:text-white {error
			? 'border-red-500 focus:border-red-600 dark:border-red-500 dark:focus:border-red-400 bg-red-50/50 dark:bg-red-900/10'
			: 'border-gray-300 focus:border-brand-600 dark:border-gray-700 dark:focus:border-brand-400 bg-transparent hover:border-gray-400 dark:hover:border-gray-500'} {className}"
		{...rest}
	/>
	{#if error}
		<p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
	{/if}
</div>
