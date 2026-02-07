<script lang="ts">
	import type { PageData } from './$types.js';
	import { PageShell } from '$lib/components/ui/index.js';

	let { data }: { data: PageData } = $props();

	async function markAllRead() {
		await fetch('/api/v1/notifications/read-all', { method: 'POST' });
		for (const n of data.notifications) {
			n.isRead = true;
		}
	}

	async function markRead(id: string) {
		await fetch(`/api/v1/notifications/${id}/read`, { method: 'POST' });
		const n = data.notifications.find((n) => n.id === id);
		if (n) n.isRead = true;
	}
</script>

<svelte:head>
	<title>Notifications — TaskMaster Pro</title>
</svelte:head>

<PageShell title="Notifications">
	{#snippet actions()}
		{#if data.notifications.some((n) => !n.isRead)}
			<button
				onclick={markAllRead}
				class="text-sm font-medium text-brand-600 hover:text-brand-500"
			>
				Mark all as read
			</button>
		{/if}
	{/snippet}

	{#if data.notifications.length === 0}
		<div class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 dark:border-gray-800 dark:bg-gray-900">
			<svg xmlns="http://www.w3.org/2000/svg" class="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
			</svg>
			<p class="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
		</div>
	{:else}
		<div class="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
			{#each data.notifications as notification (notification.id)}
				<div
					class="flex items-start gap-3 px-5 py-4 transition {notification.isRead ? '' : 'bg-brand-50/50 dark:bg-brand-950/20'}"
				>
					<div class="mt-0.5 h-2 w-2 shrink-0 rounded-full {notification.isRead ? 'bg-transparent' : 'bg-brand-500'}"></div>
					<div class="flex-1">
						<p class="text-sm text-gray-900 dark:text-white">{notification.body}</p>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							{new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
						</p>
					</div>
					{#if !notification.isRead}
						<button
							onclick={() => markRead(notification.id)}
							class="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
							aria-label="Mark as read"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</PageShell>
