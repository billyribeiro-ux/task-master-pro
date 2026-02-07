<script lang="ts">
	interface Props {
		src?: string | null;
		name: string;
		size?: 'xs' | 'sm' | 'md' | 'lg';
		class?: string;
	}

	let { src = null, name, size = 'md', class: className = '' }: Props = $props();

	const sizeClasses = {
		xs: 'h-5 w-5 text-[9px]',
		sm: 'h-7 w-7 text-xs',
		md: 'h-9 w-9 text-sm',
		lg: 'h-12 w-12 text-base'
	};

	let initials = $derived(name.charAt(0).toUpperCase());
</script>

{#if src}
	<img {src} alt={name} class="rounded-full object-cover {sizeClasses[size]} {className}" title={name} />
{:else}
	<div
		class="flex items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300 {sizeClasses[size]} {className}"
		title={name}
	>
		{initials}
	</div>
{/if}
