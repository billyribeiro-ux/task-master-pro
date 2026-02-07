<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types.js';
	import { PageShell } from '$lib/components/ui/index.js';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let projectName = $state('');
	let projectDescription = $state('');
	let isSubmitting = $state(false);
</script>

<svelte:head>
	<title>Projects — TaskMaster Pro</title>
</svelte:head>

<PageShell title="Projects" description="Manage your projects and boards">
	{#snippet actions()}
		<button
			onclick={() => (showCreateModal = true)}
			class="inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:bg-brand-800"
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			New Project
		</button>
	{/snippet}

	{#if form?.error}
		<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400" role="alert">
			{form.error}
		</div>
	{/if}

	{#if data.projects.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-16 dark:border-gray-700">
			<svg xmlns="http://www.w3.org/2000/svg" class="mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
			</svg>
			<p class="mb-1 text-sm font-medium text-gray-900 dark:text-white">No projects yet</p>
			<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">Create your first project to get started</p>
			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
			>
				Create Project
			</button>
		</div>
	{:else}
		<div class="grid {bp.phone ? 'grid-cols-1' : bp.tablet ? 'grid-cols-2' : 'grid-cols-3'} {bp.gridGap}">
			{#each data.projects as project (project.id)}
				<a
					href="/projects/{project.id}/board"
					class="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-700"
				>
					<div class="mb-3 flex items-center justify-between">
						<div class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
							</svg>
						</div>
						<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
							{project.visibility}
						</span>
					</div>
					<h3 class="text-sm font-semibold text-gray-900 group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400">
						{project.name}
					</h3>
					{#if project.description}
						<p class="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{project.description}</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</PageShell>

<!-- Create Project Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
		<div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
			<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Create New Project</h2>

			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update, result }) => {
						isSubmitting = false;
						if (result.type === 'redirect') {
							showCreateModal = false;
						}
						await update();
					};
				}}
				class="space-y-4"
			>
				<div>
					<label for="project-name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Project Name</label>
					<input
						id="project-name"
						name="name"
						type="text"
						required
						bind:value={projectName}
						class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						placeholder="My Awesome Project"
					/>
				</div>

				<div>
					<label for="project-description" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
					<textarea
						id="project-description"
						name="description"
						rows="3"
						bind:value={projectDescription}
						class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						placeholder="A brief description of your project"
					></textarea>
				</div>

				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
					>
						{isSubmitting ? 'Creating...' : 'Create Project'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && showCreateModal) {
			showCreateModal = false;
		}
	}}
/>
