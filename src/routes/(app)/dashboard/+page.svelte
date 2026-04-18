<script lang="ts">
	import type { PageData } from './$types.js';
	import { resolve } from '$app/paths';
	import { PageShell } from '$lib/components/ui/index.js';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard — TaskMaster Pro</title>
</svelte:head>

<PageShell
	title="Welcome back, {data.user.name}"
	description="Here's what's happening across your projects."
>
	<!-- Stats grid -->
	<div
		class="mb-6 grid {bp.phone
			? 'grid-cols-1'
			: bp.tablet
				? 'grid-cols-2'
				: 'grid-cols-4'} {bp.gridGap}"
	>
		<div
			class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-blue-600 dark:text-blue-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{data.projectCount}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Projects</p>
				</div>
			</div>
		</div>

		<div
			class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-amber-600 dark:text-amber-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{data.taskCount}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Open Tasks</p>
				</div>
			</div>
		</div>

		<div
			class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-green-600 dark:text-green-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">{data.completedThisWeek}</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Completed This Week</p>
				</div>
			</div>
		</div>

		<div
			class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5 text-purple-600 dark:text-purple-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-gray-900 dark:text-white">
						{data.hoursLoggedThisWeek}h
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400">Hours This Week</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent projects -->
	<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
		<div
			class="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800"
		>
			<h2 class="text-sm font-semibold text-gray-900 dark:text-white">Recent Projects</h2>
			<a
				href={resolve('/(app)/projects')}
				class="text-brand-600 hover:text-brand-500 text-xs font-medium">View all</a
			>
		</div>
		{#if data.recentProjects.length === 0}
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
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
					/>
				</svg>
				<p class="text-sm text-gray-500 dark:text-gray-400">No projects yet</p>
				<a
					href={resolve('/(app)/projects')}
					class="text-brand-600 hover:text-brand-500 mt-2 text-sm font-medium"
					>Create your first project</a
				>
			</div>
		{:else}
			<div class="divide-y divide-gray-100 dark:divide-gray-800">
				{#each data.recentProjects as project (project.id)}
					<a
						href={resolve('/(app)/projects/[projectId]/board', { projectId: project.id })}
						class="flex min-h-11 items-center justify-between px-4 py-3 transition hover:bg-gray-50 active:bg-gray-100 md:px-5 dark:hover:bg-gray-800/50 dark:active:bg-gray-800"
					>
						<div>
							<p class="text-sm font-medium text-gray-900 dark:text-white">{project.name}</p>
							{#if project.description}
								<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{project.description}</p>
							{/if}
						</div>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4 text-gray-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</PageShell>
