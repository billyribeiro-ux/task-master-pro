<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Error {page.status} — TaskMaster Pro</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
	<div class="text-center">
		<p class="text-6xl font-bold text-brand-600">{page.status}</p>
		<h1 class="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
			{#if page.status === 404}
				Page not found
			{:else if page.status === 403}
				Access denied
			{:else if page.status === 500}
				Something went wrong
			{:else}
				An error occurred
			{/if}
		</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			{page.error?.message ?? 'An unexpected error occurred.'}
		</p>
		<div class="mt-6 flex items-center justify-center gap-3">
			<button
				onclick={() => history.back()}
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Go Back
			</button>
			<a
				href="/"
				class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
			>
				Go Home
			</a>
		</div>
	</div>
</div>
