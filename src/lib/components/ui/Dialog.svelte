<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
		title?: string;
		children: Snippet;
		footer?: Snippet;
	}

	let { open, onclose, title, children, footer }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div class="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
			{#if title}
				<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
					<h2 class="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
					<button
						onclick={onclose}
						class="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
						aria-label="Close"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}
			<div class="px-6 py-4">
				{@render children()}
			</div>
			{#if footer}
				<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}
