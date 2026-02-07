<script lang="ts">
	import type { PageData } from './$types.js';
	import { PageShell } from '$lib/components/ui/index.js';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let email = $state('');

	$effect(() => {
		name = data.user.name;
		email = data.user.email;
	});
	let isSaving = $state(false);
	let saveMessage = $state<string | null>(null);

	async function handleSave() {
		isSaving = true;
		saveMessage = null;
		try {
			const res = await fetch('/api/v1/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});
			if (res.ok) {
				saveMessage = 'Profile updated successfully';
			} else {
				saveMessage = 'Failed to update profile';
			}
		} catch {
			saveMessage = 'An error occurred';
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>Settings — TaskMaster Pro</title>
</svelte:head>

<PageShell title="Settings">

	{#if saveMessage}
		<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" role="alert">
			{saveMessage}
		</div>
	{/if}

	<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>

		<div class="space-y-4">
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					class="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				/>
			</div>

			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
				<input
					id="email"
					type="email"
					value={email}
					disabled
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
				/>
				<p class="mt-1 text-xs text-gray-400">Email cannot be changed</p>
			</div>

			<div>
				<span class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Plan</span>
				<div class="flex items-center gap-2">
					<span class="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
						{data.user.plan}
					</span>
					<a href="/settings/billing" class="text-xs font-medium text-brand-600 hover:text-brand-500">Manage billing</a>
				</div>
			</div>

			<div class="flex justify-end pt-2">
				<button
					onclick={handleSave}
					disabled={isSaving}
					class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
				>
					{isSaving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>

	<div class="mt-6 rounded-xl border border-red-200 bg-white p-6 dark:border-red-800 dark:bg-gray-900">
		<h2 class="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
		<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
			Once you delete your account, there is no going back. Please be certain.
		</p>
		<button
			class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950"
		>
			Delete Account
		</button>
	</div>
</PageShell>
