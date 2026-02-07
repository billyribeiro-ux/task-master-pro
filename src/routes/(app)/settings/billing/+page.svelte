<script lang="ts">
	import type { PageData } from './$types.js';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();

	let isUpgrading = $state(false);
	let isManaging = $state(false);

	let successMessage = $derived(page.url.searchParams.get('success') === 'true' ? 'Your plan has been upgraded!' : null);
	let cancelledMessage = $derived(page.url.searchParams.get('cancelled') === 'true' ? 'Checkout was cancelled.' : null);

	const planDetails = {
		free: { name: 'Free', price: '$0', features: ['3 projects', '5 members per project', '10MB file uploads'] },
		pro: { name: 'Pro', price: '$12/mo', features: ['50 projects', '50 members per project', '100MB file uploads', 'Advanced analytics', 'Priority support'] },
		enterprise: { name: 'Enterprise', price: 'Custom', features: ['Unlimited projects', 'Unlimited members', '500MB file uploads', 'SSO', 'Dedicated support'] }
	};

	let currentPlan = $derived(planDetails[data.user.plan as keyof typeof planDetails] ?? planDetails.free);
</script>

<svelte:head>
	<title>Billing — TaskMaster Pro</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<h1 class="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Billing & Plan</h1>

	{#if successMessage}
		<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400" role="alert">
			{successMessage}
		</div>
	{/if}

	{#if cancelledMessage}
		<div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400" role="alert">
			{cancelledMessage}
		</div>
	{/if}

	<!-- Current plan -->
	<div class="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm text-gray-500 dark:text-gray-400">Current Plan</p>
				<p class="text-2xl font-bold text-gray-900 dark:text-white">{currentPlan.name}</p>
				<p class="text-lg font-semibold text-brand-600">{currentPlan.price}</p>
			</div>
			<div class="flex gap-3">
				{#if data.user.plan === 'free'}
					<form method="POST" action="/api/v1/billing/checkout">
						<button
							type="submit"
							disabled={isUpgrading}
							onclick={() => (isUpgrading = true)}
							class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
						>
							{isUpgrading ? 'Redirecting...' : 'Upgrade to Pro'}
						</button>
					</form>
				{:else if data.user.stripeCustomerId}
					<form method="POST" action="/api/v1/billing/portal">
						<button
							type="submit"
							disabled={isManaging}
							onclick={() => (isManaging = true)}
							class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
						>
							{isManaging ? 'Redirecting...' : 'Manage Subscription'}
						</button>
					</form>
				{/if}
			</div>
		</div>

		<div class="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
			<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Includes</p>
			<ul class="space-y-1">
				{#each currentPlan.features as feature}
					<li class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
						{feature}
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<!-- Plan comparison -->
	<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Compare Plans</h2>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		{#each Object.entries(planDetails) as [key, plan] (key)}
			<div class="rounded-xl border p-5 {key === data.user.plan ? 'border-brand-500 bg-brand-50 dark:border-brand-700 dark:bg-brand-950' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}">
				<p class="text-sm font-semibold text-gray-900 dark:text-white">{plan.name}</p>
				<p class="mb-3 text-xl font-bold text-gray-900 dark:text-white">{plan.price}</p>
				<ul class="space-y-1">
					{#each plan.features as feature}
						<li class="text-xs text-gray-600 dark:text-gray-400">• {feature}</li>
					{/each}
				</ul>
				{#if key === data.user.plan}
					<p class="mt-3 text-xs font-medium text-brand-600">Current plan</p>
				{/if}
			</div>
		{/each}
	</div>
</div>
