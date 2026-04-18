<script lang="ts">
	import type { PageData } from './$types.js';
	import { PageShell } from '$lib/components/ui/index.js';

	let { data }: { data: PageData } = $props();

	let activeTimer = $state<{ id: string; taskId: string; startedAt: string } | null>(null);
	let elapsed = $state(0);
	let intervalId = $state<ReturnType<typeof setInterval> | null>(null);

	function startElapsedCounter(startedAt: string) {
		if (intervalId) clearInterval(intervalId);
		const start = new Date(startedAt).getTime();
		elapsed = Math.floor((Date.now() - start) / 1000);
		intervalId = setInterval(() => {
			elapsed = Math.floor((Date.now() - start) / 1000);
		}, 1000);
	}

	function formatDuration(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	async function stopTimer() {
		if (!activeTimer) return;
		try {
			await fetch('/api/v1/time-entries', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: activeTimer.id })
			});
			if (intervalId) clearInterval(intervalId);
			activeTimer = null;
			elapsed = 0;
		} catch (err) {
			console.error('Failed to stop timer:', err);
		}
	}

	$effect(() => {
		if (data.runningEntry) {
			activeTimer = {
				id: data.runningEntry.id,
				taskId: data.runningEntry.taskId,
				startedAt: data.runningEntry.startedAt
			};
			startElapsedCounter(data.runningEntry.startedAt);
		}

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});
</script>

<svelte:head>
	<title>Time Tracking — TaskMaster Pro</title>
</svelte:head>

<PageShell title="Time Tracking" description="Track time spent on tasks">
	<!-- Active timer -->
	{#if activeTimer}
		<div
			class="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 mb-6 rounded-xl border p-6"
		>
			<div class="flex items-center justify-between">
				<div>
					<p class="text-brand-600 dark:text-brand-400 text-xs font-medium">Timer Running</p>
					<p class="text-brand-700 dark:text-brand-300 mt-1 font-mono text-3xl font-bold">
						{formatDuration(elapsed)}
					</p>
				</div>
				<button
					onclick={stopTimer}
					class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
				>
					Stop Timer
				</button>
			</div>
		</div>
	{/if}

	<!-- Recent entries -->
	<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
		<div class="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
			<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Recent Time Entries</h2>
		</div>
		{#if data.recentEntries.length === 0}
			<div class="flex flex-col items-center justify-center py-12">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<p class="text-sm text-gray-500 dark:text-gray-400">No time entries yet</p>
				<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
					Start a timer from any task to begin tracking
				</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-100 dark:divide-gray-800">
				{#each data.recentEntries as entry (entry.id)}
					<div class="flex items-center justify-between px-5 py-3">
						<div>
							<p class="text-sm font-medium text-gray-900 dark:text-white">
								{entry.note ?? 'No description'}
							</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">
								{new Date(entry.startedAt).toLocaleDateString('en-US', {
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</p>
						</div>
						<div class="text-right">
							{#if entry.durationSeconds}
								<p class="font-mono text-sm font-medium text-gray-900 dark:text-white">
									{formatDuration(entry.durationSeconds)}
								</p>
							{:else}
								<span
									class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300"
								>
									Running
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</PageShell>
