<script lang="ts">
	interface ToastItem {
		id: string;
		type: 'info' | 'success' | 'warning' | 'error';
		message: string;
	}

	let toasts = $state<ToastItem[]>([]);

	const typeStyles = {
		info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300',
		success:
			'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
		warning:
			'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
		error:
			'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
	};

	export function addToast(type: ToastItem['type'], message: string) {
		const id = crypto.randomUUID();
		toasts = [...toasts, { id, type, message }];
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 5000);
	}

	function dismiss(id: string) {
		toasts = toasts.filter((t) => t.id !== id);
	}
</script>

<div class="fixed right-4 bottom-4 z-[100] flex flex-col gap-2">
	{#each toasts as toast (toast.id)}
		<div
			class="flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg {typeStyles[toast.type]}"
			role="alert"
		>
			<p class="text-sm font-medium">{toast.message}</p>
			<button
				onclick={() => dismiss(toast.id)}
				class="ml-2 shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
				aria-label="Dismiss"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>
