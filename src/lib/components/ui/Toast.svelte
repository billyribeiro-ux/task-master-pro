<script lang="ts">
	interface ToastItem {
		id: string;
		type: 'info' | 'success' | 'warning' | 'error';
		message: string;
	}

	let toasts = $state<ToastItem[]>([]);

	const typeStyles = {
		info: 'bg-gray-900 text-gray-50 dark:bg-gray-100 dark:text-gray-900 border border-gray-800 dark:border-gray-200',
		success:
			'bg-green-800 text-green-50 dark:bg-green-200 dark:text-green-900 border border-green-700 dark:border-green-300',
		warning:
			'bg-amber-800 text-amber-50 dark:bg-amber-200 dark:text-amber-900 border border-amber-700 dark:border-amber-300',
		error:
			'bg-red-800 text-red-50 dark:bg-red-200 dark:text-red-900 border border-red-700 dark:border-red-300'
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

<div class="fixed right-4 bottom-4 z-100 flex flex-col gap-2">
	{#each toasts as toast (toast.id)}
		<div
			class="flex items-center gap-3 rounded-xl shadow-m3-3 px-4 py-3 {typeStyles[toast.type]}"
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
