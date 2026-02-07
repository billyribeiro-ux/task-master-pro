<script lang="ts">
	import type { PageData } from './$types.js';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let draggedTaskId = $state<string | null>(null);
	let dragOverColumnId = $state<string | null>(null);
	let dragOverPosition = $state<number | null>(null);
	let filterQuery = $state('');
	let filterPriority = $state<string | null>(null);
	let quickAddColumnId = $state<string | null>(null);
	let quickAddTitle = $state('');
	let isCreating = $state(false);

	let tasksByColumn = $derived.by(() => {
		const map = new Map<string, typeof data.tasks>();
		for (const col of data.columns) {
			map.set(col.id, []);
		}
		for (const task of data.tasks) {
			let include = true;
			if (filterQuery) {
				const q = filterQuery.toLowerCase();
				include = task.title.toLowerCase().includes(q) || task.displayId.toLowerCase().includes(q);
			}
			if (include && filterPriority) {
				include = task.priority === filterPriority;
			}
			if (include) {
				const list = map.get(task.columnId);
				if (list) list.push(task);
			}
		}
		return map;
	});

	function handleDragStart(e: DragEvent, taskId: string) {
		draggedTaskId = taskId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', taskId);
		}
	}

	function handleDragOver(e: DragEvent, columnId: string, position: number) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverColumnId = columnId;
		dragOverPosition = position;
	}

	function handleDragLeave() {
		dragOverColumnId = null;
		dragOverPosition = null;
	}

	function handleDragEnd() {
		draggedTaskId = null;
		dragOverColumnId = null;
		dragOverPosition = null;
	}

	async function handleDrop(e: DragEvent, columnId: string, position: number) {
		e.preventDefault();
		const taskId = draggedTaskId;
		handleDragEnd();

		if (!taskId) return;

		const colTasks = tasksByColumn.get(columnId) ?? [];
		let newPosition = 'a0';
		if (colTasks.length === 0) {
			newPosition = 'a0';
		} else if (position === 0) {
			const first = colTasks[0];
			newPosition = first.position.slice(0, -1) + '0';
		} else if (position >= colTasks.length) {
			const last = colTasks[colTasks.length - 1];
			newPosition = last.position + '0';
		} else {
			const before = colTasks[position - 1];
			const after = colTasks[position];
			newPosition = before.position + after.position.charAt(after.position.length - 1);
		}

		try {
			await fetch(`/api/v1/tasks/${taskId}/move`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ columnId, position: newPosition })
			});
			await invalidateAll();
		} catch (err) {
			console.error('Failed to move task:', err);
		}
	}

	async function handleQuickAdd(columnId: string) {
		if (!quickAddTitle.trim() || isCreating) return;
		isCreating = true;

		try {
			await fetch('/api/v1/tasks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: data.project.id,
					columnId,
					title: quickAddTitle.trim()
				})
			});
			quickAddTitle = '';
			quickAddColumnId = null;
			await invalidateAll();
		} catch (err) {
			console.error('Failed to create task:', err);
		} finally {
			isCreating = false;
		}
	}

	const priorityColors: Record<string, string> = {
		urgent: 'bg-red-500',
		high: 'bg-orange-500',
		medium: 'bg-yellow-500',
		low: 'bg-blue-500',
		none: 'bg-gray-300 dark:bg-gray-600'
	};
</script>

<div class="flex h-full flex-col">
	<!-- Filter bar -->
	<div class="flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-2 dark:border-gray-800 dark:bg-gray-900">
		<div class="relative">
			<svg xmlns="http://www.w3.org/2000/svg" class="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				type="text"
				placeholder="Filter tasks..."
				bind:value={filterQuery}
				class="w-48 rounded-md border border-gray-200 bg-gray-50 py-1 pl-8 pr-3 text-xs text-gray-900 placeholder-gray-400 transition focus:border-brand-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
			/>
		</div>
		<select
			bind:value={filterPriority}
			class="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
		>
			<option value={null}>All priorities</option>
			<option value="urgent">Urgent</option>
			<option value="high">High</option>
			<option value="medium">Medium</option>
			<option value="low">Low</option>
			<option value="none">None</option>
		</select>
	</div>

	<!-- Board columns -->
	<div class="flex flex-1 gap-4 overflow-x-auto p-4">
		{#each data.columns as column (column.id)}
			{@const colTasks = tasksByColumn.get(column.id) ?? []}
			<div
				class="flex w-72 shrink-0 flex-col rounded-xl bg-gray-100 dark:bg-gray-900"
				ondragover={(e) => handleDragOver(e, column.id, colTasks.length)}
				ondragleave={handleDragLeave}
				ondrop={(e) => handleDrop(e, column.id, colTasks.length)}
			>
				<!-- Column header -->
				<div class="flex items-center justify-between px-3 py-2.5">
					<div class="flex items-center gap-2">
						<div class="h-2.5 w-2.5 rounded-full" style="background-color: {column.color}"></div>
						<span class="text-xs font-semibold text-gray-700 dark:text-gray-300">{column.name}</span>
						<span class="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
							{colTasks.length}
						</span>
					</div>
					<button
						onclick={() => { quickAddColumnId = column.id; quickAddTitle = ''; }}
						class="rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
						aria-label="Add task to {column.name}"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
						</svg>
					</button>
				</div>

				<!-- Tasks list -->
				<div class="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
					{#each colTasks as task, index (task.id)}
						<div
							class="group cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800 dark:hover:border-brand-700 {draggedTaskId === task.id ? 'opacity-50' : ''}"
							draggable="true"
							role="button"
							tabindex="0"
							ondragstart={(e) => handleDragStart(e, task.id)}
							ondragover={(e) => handleDragOver(e, column.id, index)}
							ondragend={handleDragEnd}
						>
							<div class="mb-1.5 flex items-center gap-1.5">
								<div class="h-2 w-2 rounded-full {priorityColors[task.priority]}"></div>
								<span class="text-[10px] font-medium text-gray-400 dark:text-gray-500">{task.displayId}</span>
							</div>
							<p class="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>

							{#if data.taskLabels[task.id]?.length}
								<div class="mt-2 flex flex-wrap gap-1">
									{#each data.taskLabels[task.id] as label (label.id)}
										<span
											class="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
											style="background-color: {label.color}"
										>
											{label.name}
										</span>
									{/each}
								</div>
							{/if}

							<div class="mt-2 flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if task.dueDate}
										{@const isOverdue = new Date(task.dueDate) < new Date()}
										<span class="text-[10px] {isOverdue ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-500'}">
											{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
										</span>
									{/if}
									{#if task.storyPoints}
										<span class="rounded bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
											{task.storyPoints}pt
										</span>
									{/if}
								</div>
								{#if task.assigneeId && data.assignees[task.assigneeId]}
									{@const assignee = data.assignees[task.assigneeId]}
									{#if assignee.avatarUrl}
										<img src={assignee.avatarUrl} alt={assignee.name} class="h-5 w-5 rounded-full" title={assignee.name} />
									{:else}
										<div class="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[9px] font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300" title={assignee.name}>
											{assignee.name.charAt(0).toUpperCase()}
										</div>
									{/if}
								{/if}
							</div>
						</div>

						<!-- Drop indicator -->
						{#if dragOverColumnId === column.id && dragOverPosition === index}
							<div class="h-0.5 rounded-full bg-brand-500"></div>
						{/if}
					{/each}

					<!-- Drop indicator at end -->
					{#if dragOverColumnId === column.id && dragOverPosition === colTasks.length}
						<div class="h-0.5 rounded-full bg-brand-500"></div>
					{/if}

					<!-- Quick add form -->
					{#if quickAddColumnId === column.id}
						<div class="rounded-lg border border-brand-300 bg-white p-2 dark:border-brand-700 dark:bg-gray-800">
							<input
								type="text"
								placeholder="Task title..."
								bind:value={quickAddTitle}
								onkeydown={(e) => {
									if (e.key === 'Enter') handleQuickAdd(column.id);
									if (e.key === 'Escape') quickAddColumnId = null;
								}}
								class="mb-2 block w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
							/>
							<div class="flex gap-1">
								<button
									onclick={() => handleQuickAdd(column.id)}
									disabled={isCreating || !quickAddTitle.trim()}
									class="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
								>
									{isCreating ? 'Adding...' : 'Add'}
								</button>
								<button
									onclick={() => (quickAddColumnId = null)}
									class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>
