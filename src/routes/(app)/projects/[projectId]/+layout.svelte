<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types.js';
	import { page } from '$app/state';

	interface Props {
		children: Snippet;
		data: LayoutData;
	}

	let { children, data }: Props = $props();

	let currentTab = $derived(() => {
		const path = page.url.pathname;
		if (path.endsWith('/board')) return 'board';
		if (path.endsWith('/settings')) return 'settings';
		return 'board';
	});

	const tabs = [
		{ id: 'board', label: 'Board', href: `/projects/${data.project.id}/board` },
		{ id: 'settings', label: 'Settings', href: `/projects/${data.project.id}/settings` }
	] as const;
</script>

<div class="flex h-full flex-col">
	<!-- Project header -->
	<div class="border-b border-gray-200 bg-white px-6 pt-4 dark:border-gray-800 dark:bg-gray-900">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<h1 class="text-lg font-bold text-gray-900 dark:text-white">{data.project.name}</h1>
				{#if data.project.description}
					<p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{data.project.description}</p>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				<!-- Member avatars -->
				<div class="flex -space-x-2">
					{#each data.members.slice(0, 5) as member (member.userId)}
						{#if member.avatarUrl}
							<img
								src={member.avatarUrl}
								alt={member.name}
								class="h-7 w-7 rounded-full border-2 border-white dark:border-gray-900"
								title={member.name}
							/>
						{:else}
							<div
								class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-xs font-semibold text-brand-700 dark:border-gray-900 dark:bg-brand-900 dark:text-brand-300"
								title={member.name}
							>
								{member.name.charAt(0).toUpperCase()}
							</div>
						{/if}
					{/each}
					{#if data.members.length > 5}
						<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-xs font-medium text-gray-600 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-400">
							+{data.members.length - 5}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<nav class="-mb-px flex gap-4" aria-label="Project tabs">
			{#each tabs as tab (tab.id)}
				<a
					href={tab.href}
					class="border-b-2 px-1 pb-2 text-sm font-medium transition {currentTab() === tab.id
						? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}"
				>
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
