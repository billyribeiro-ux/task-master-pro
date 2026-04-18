<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types.js';
	import { bp } from '$lib/stores/breakpoints.svelte.js';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Form state pre-filled from server data; intentional initial capture so local edits aren't clobbered on re-render.
	// svelte-ignore state_referenced_locally
	let projectName = $state(data.project.name);
	// svelte-ignore state_referenced_locally
	let projectDescription = $state(data.project.description ?? '');
	// svelte-ignore state_referenced_locally
	let projectVisibility = $state(data.project.visibility);
	let isSaving = $state(false);

	let inviteEmail = $state('');
	let inviteRole = $state('member');
	let isInviting = $state(false);
</script>

<svelte:head>
	<title>Settings — {data.project.name} — TaskMaster Pro</title>
</svelte:head>

<div class="{bp.pagePadding} mx-auto max-w-3xl overflow-y-auto">
	{#if form?.error}
		<div
			class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
			role="alert"
		>
			{form.error}
		</div>
	{/if}

	{#if form?.success}
		<div
			class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
			role="alert"
		>
			{#if form?.invited}
				{form.invited} has been invited to the project.
			{:else}
				Project settings updated.
			{/if}
		</div>
	{/if}

	<!-- Project details -->
	<div
		class="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
	>
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Project Details</h2>
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				isSaving = true;
				return async ({ update }) => {
					isSaving = false;
					await update();
				};
			}}
			class="space-y-4"
		>
			<div>
				<label
					for="project-name"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label
				>
				<input
					id="project-name"
					name="name"
					type="text"
					required
					bind:value={projectName}
					class="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				/>
			</div>

			<div>
				<label
					for="project-description"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label
				>
				<textarea
					id="project-description"
					name="description"
					rows="3"
					bind:value={projectDescription}
					class="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				></textarea>
			</div>

			<div>
				<label
					for="project-visibility"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Visibility</label
				>
				<select
					id="project-visibility"
					name="visibility"
					bind:value={projectVisibility}
					class="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				>
					<option value="private">Private</option>
					<option value="team">Team</option>
					<option value="public">Public</option>
				</select>
			</div>

			<div class="flex justify-end">
				<button
					type="submit"
					disabled={isSaving}
					class="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
				>
					{isSaving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</form>
	</div>

	<!-- Members -->
	<div
		class="mb-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900"
	>
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Members</h2>

		<div
			class="mb-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-700"
		>
			{#each data.members as member (member.userId)}
				<div class="flex items-center justify-between px-4 py-3">
					<div class="flex items-center gap-3">
						{#if member.avatarUrl}
							<img src={member.avatarUrl} alt={member.name} class="h-8 w-8 rounded-full" />
						{:else}
							<div
								class="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
							>
								{member.name.charAt(0).toUpperCase()}
							</div>
						{/if}
						<div>
							<p class="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
						</div>
					</div>
					<span
						class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"
					>
						{member.role}
					</span>
				</div>
			{/each}
		</div>

		<!-- Invite form -->
		<form
			method="POST"
			action="?/invite"
			use:enhance={() => {
				isInviting = true;
				return async ({ update }) => {
					isInviting = false;
					inviteEmail = '';
					await update();
				};
			}}
			class="flex {bp.phone ? 'flex-col' : 'items-end'} gap-3"
		>
			<div class="flex-1">
				<label
					for="invite-email"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>Invite by email</label
				>
				<input
					id="invite-email"
					name="email"
					type="email"
					required
					bind:value={inviteEmail}
					placeholder="colleague@example.com"
					class="focus:border-brand-500 focus:ring-brand-500/20 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:ring-2 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				/>
			</div>
			<div>
				<label
					for="invite-role"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label
				>
				<select
					id="invite-role"
					name="role"
					bind:value={inviteRole}
					class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
					<option value="viewer">Viewer</option>
				</select>
			</div>
			<button
				type="submit"
				disabled={isInviting}
				class="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
			>
				{isInviting ? 'Inviting...' : 'Invite'}
			</button>
		</form>
	</div>

	<!-- Danger zone -->
	<div class="rounded-xl border border-red-200 bg-white p-6 dark:border-red-800 dark:bg-gray-900">
		<h2 class="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
		<p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
			Deleting this project will permanently remove all tasks, comments, and files.
		</p>
		<button
			class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950"
		>
			Delete Project
		</button>
	</div>
</div>
