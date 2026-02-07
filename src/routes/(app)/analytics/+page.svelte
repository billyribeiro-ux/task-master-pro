<script lang="ts">
	import type { PageData } from './$types.js';
	import { PageShell } from '$lib/components/ui/index.js';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	let { data }: { data: PageData } = $props();

	const statusColors: Record<string, string> = {
		backlog: '#6b7280',
		todo: '#3b82f6',
		in_progress: '#f59e0b',
		in_review: '#8b5cf6',
		done: '#22c55e',
		cancelled: '#ef4444'
	};

	const priorityColors: Record<string, string> = {
		urgent: '#ef4444',
		high: '#f97316',
		medium: '#eab308',
		low: '#3b82f6',
		none: '#9ca3af'
	};

	let totalTasks = $derived(data.tasksByStatus.reduce((sum, s) => sum + s.total, 0));
	let maxCompletionVal = $derived(
		data.completionTrend.length > 0
			? Math.max(...data.completionTrend.map((d) => d.total))
			: 0
	);
</script>

<svelte:head>
	<title>Analytics — TaskMaster Pro</title>
</svelte:head>

<PageShell title="Analytics" description="Insights across all your projects">
	<!-- Summary cards -->
	<div class="mb-6 grid {bp.phone ? 'grid-cols-1' : 'grid-cols-3'} {bp.gridGap}">
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<p class="text-xs text-gray-500 dark:text-gray-400">Total Tasks</p>
			<p class="text-3xl font-bold text-gray-900 dark:text-white">{totalTasks}</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<p class="text-xs text-gray-500 dark:text-gray-400">Total Hours Logged</p>
			<p class="text-3xl font-bold text-gray-900 dark:text-white">{data.totalHoursLogged}h</p>
		</div>
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<p class="text-xs text-gray-500 dark:text-gray-400">Projects</p>
			<p class="text-3xl font-bold text-gray-900 dark:text-white">{data.projectStats.length}</p>
		</div>
	</div>

	<div class="grid {bp.laptopUp ? 'grid-cols-2' : 'grid-cols-1'} {bp.gridGap}">
		<!-- Tasks by Status -->
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Tasks by Status</h2>
			{#if data.tasksByStatus.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No data yet</p>
			{:else}
				<div class="space-y-3">
					{#each data.tasksByStatus as item (item.status)}
						<div>
							<div class="mb-1 flex items-center justify-between text-xs">
								<span class="font-medium text-gray-700 dark:text-gray-300">{item.status.replace('_', ' ')}</span>
								<span class="text-gray-500 dark:text-gray-400">{item.total}</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
								<div
									class="h-full rounded-full transition-all"
									style="width: {totalTasks > 0 ? (item.total / totalTasks) * 100 : 0}%; background-color: {statusColors[item.status] ?? '#9ca3af'}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Tasks by Priority -->
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Tasks by Priority</h2>
			{#if data.tasksByPriority.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No data yet</p>
			{:else}
				<div class="space-y-3">
					{#each data.tasksByPriority as item (item.priority)}
						<div>
							<div class="mb-1 flex items-center justify-between text-xs">
								<span class="font-medium text-gray-700 dark:text-gray-300">{item.priority}</span>
								<span class="text-gray-500 dark:text-gray-400">{item.total}</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
								<div
									class="h-full rounded-full transition-all"
									style="width: {totalTasks > 0 ? (item.total / totalTasks) * 100 : 0}%; background-color: {priorityColors[item.priority] ?? '#9ca3af'}"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Completion Trend -->
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Completion Trend (30 days)</h2>
			{#if data.completionTrend.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No completions in the last 30 days</p>
			{:else}
				<div class="flex items-end gap-1" style="height: 120px">
					{#each data.completionTrend as day (day.date)}
						<div
							class="flex-1 rounded-t bg-brand-500 transition-all hover:bg-brand-600"
							style="height: {maxCompletionVal > 0 ? (day.total / maxCompletionVal) * 100 : 0}%"
							title="{day.date}: {day.total} completed"
						></div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Project Progress -->
		<div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
			<h2 class="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Project Progress</h2>
			{#if data.projectStats.length === 0}
				<p class="text-sm text-gray-500 dark:text-gray-400">No projects yet</p>
			{:else}
				<div class="space-y-4">
					{#each data.projectStats as project (project.id)}
						{@const pct = project.totalTasks > 0 ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0}
						<div>
							<div class="mb-1 flex items-center justify-between text-xs">
								<span class="font-medium text-gray-700 dark:text-gray-300">{project.name}</span>
								<span class="text-gray-500 dark:text-gray-400">{project.completedTasks}/{project.totalTasks} ({pct}%)</span>
							</div>
							<div class="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
								<div
									class="h-full rounded-full bg-brand-500 transition-all"
									style="width: {pct}%"
								></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</PageShell>
