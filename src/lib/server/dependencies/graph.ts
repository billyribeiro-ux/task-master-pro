import { db } from '$lib/server/db/index.js';
import { taskDependencies, tasks } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Detect whether adding a dependency from `taskId` -> `dependsOnTaskId`
 * would create a circular dependency within the project.
 *
 * Uses BFS to walk the existing dependency graph starting from `dependsOnTaskId`
 * and checks if we can reach `taskId`. If so, adding the edge would form a cycle.
 */
export async function detectCircularDependency(
	taskId: string,
	dependsOnTaskId: string,
	projectId: string
): Promise<boolean> {
	// Load all dependencies for this project's tasks in one query
	const projectTasks = await db
		.select({ id: tasks.id })
		.from(tasks)
		.where(eq(tasks.projectId, projectId));

	const projectTaskIds = new Set(projectTasks.map((t) => t.id));

	const allDeps = await db.select().from(taskDependencies);
	// Filter to only blocking-type deps within this project
	const relevantDeps = allDeps.filter(
		(d) =>
			projectTaskIds.has(d.taskId) &&
			projectTaskIds.has(d.dependsOnTaskId) &&
			(d.type === 'blocks' || d.type === 'is_blocked_by')
	);

	// Build adjacency list: taskId depends on dependsOnTaskId
	// So we follow: dependsOnTaskId -> what does IT depend on? -> ...
	// If we ever reach taskId, it's circular
	const adjacency = new Map<string, string[]>();
	for (const dep of relevantDeps) {
		if (!adjacency.has(dep.taskId)) {
			adjacency.set(dep.taskId, []);
		}
		adjacency.get(dep.taskId)!.push(dep.dependsOnTaskId);
	}

	// BFS from dependsOnTaskId following dependency edges
	const visited = new Set<string>();
	const queue: string[] = [dependsOnTaskId];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === taskId) {
			return true; // Cycle detected
		}
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);

		const neighbors = adjacency.get(current) ?? [];
		for (const neighbor of neighbors) {
			if (!visited.has(neighbor)) {
				queue.push(neighbor);
			}
		}
	}

	return false;
}

/**
 * Get the full chain of tasks that are blocking the given task.
 * Walks up the dependency tree recursively.
 *
 * Returns an ordered list from immediate blockers outward.
 */
export async function getBlockingChain(
	taskId: string
): Promise<{ id: string; taskId: string; dependsOnTaskId: string; type: string }[]> {
	const chain: { id: string; taskId: string; dependsOnTaskId: string; type: string }[] = [];
	const visited = new Set<string>();
	const queue: string[] = [taskId];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (visited.has(current)) continue;
		visited.add(current);

		const deps = await db
			.select()
			.from(taskDependencies)
			.where(and(eq(taskDependencies.taskId, current), eq(taskDependencies.type, 'blocks')));

		for (const dep of deps) {
			chain.push({
				id: dep.id,
				taskId: dep.taskId,
				dependsOnTaskId: dep.dependsOnTaskId,
				type: dep.type
			});
			if (!visited.has(dep.dependsOnTaskId)) {
				queue.push(dep.dependsOnTaskId);
			}
		}
	}

	return chain;
}

interface CriticalPathNode {
	taskId: string;
	title: string;
	status: string;
	estimateMinutes: number | null;
	depth: number;
}

/**
 * Calculate the critical path through a project's tasks.
 * The critical path is the longest chain of dependent tasks,
 * representing the minimum time to complete the project.
 *
 * Uses topological sort + longest-path algorithm on the DAG.
 */
export async function getCriticalPath(projectId: string): Promise<{
	path: CriticalPathNode[];
	totalEstimateMinutes: number;
}> {
	// Load all project tasks
	const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

	const taskMap = new Map(projectTasks.map((t) => [t.id, t]));
	const taskIds = new Set(projectTasks.map((t) => t.id));

	// Load all blocking dependencies within this project
	const allDeps = await db.select().from(taskDependencies);
	const projectDeps = allDeps.filter(
		(d) =>
			taskIds.has(d.taskId) &&
			taskIds.has(d.dependsOnTaskId) &&
			(d.type === 'blocks' || d.type === 'is_blocked_by')
	);

	// Build adjacency: for each task, track which tasks depend on it
	// Edge: dependsOnTaskId -> taskId (must finish dependsOn before task)
	const outEdges = new Map<string, string[]>(); // dependsOn -> [tasks that depend on it]
	const inDegree = new Map<string, number>();

	for (const id of taskIds) {
		outEdges.set(id, []);
		inDegree.set(id, 0);
	}

	for (const dep of projectDeps) {
		outEdges.get(dep.dependsOnTaskId)!.push(dep.taskId);
		inDegree.set(dep.taskId, (inDegree.get(dep.taskId) ?? 0) + 1);
	}

	// Topological sort (Kahn's algorithm) + longest path
	const dist = new Map<string, number>(); // longest distance to reach this node
	const prev = new Map<string, string | null>(); // for path reconstruction

	for (const id of taskIds) {
		dist.set(id, 0);
		prev.set(id, null);
	}

	// Start from nodes with no dependencies (in-degree = 0)
	const queue: string[] = [];
	for (const [id, degree] of inDegree) {
		if (degree === 0) {
			queue.push(id);
		}
	}

	while (queue.length > 0) {
		const current = queue.shift()!;
		const currentDist = dist.get(current)!;
		const currentWeight = taskMap.get(current)?.estimateMinutes ?? 1;

		for (const neighbor of outEdges.get(current)!) {
			const newDist = currentDist + currentWeight;
			if (newDist > dist.get(neighbor)!) {
				dist.set(neighbor, newDist);
				prev.set(neighbor, current);
			}
			inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
			if (inDegree.get(neighbor) === 0) {
				queue.push(neighbor);
			}
		}
	}

	// Find the node with the longest distance (end of critical path)
	let maxDist = 0;
	let endNode: string | null = null;
	for (const [id, d] of dist) {
		const weight = taskMap.get(id)?.estimateMinutes ?? 1;
		if (d + weight > maxDist) {
			maxDist = d + weight;
			endNode = id;
		}
	}

	if (!endNode) {
		return { path: [], totalEstimateMinutes: 0 };
	}

	// Reconstruct the path
	const pathIds: string[] = [];
	let current: string | null = endNode;
	while (current !== null) {
		pathIds.unshift(current);
		current = prev.get(current) ?? null;
	}

	let totalEstimate = 0;
	const path: CriticalPathNode[] = pathIds.map((id, index) => {
		const task = taskMap.get(id)!;
		totalEstimate += task.estimateMinutes ?? 0;
		return {
			taskId: task.id,
			title: task.title,
			status: task.status,
			estimateMinutes: task.estimateMinutes,
			depth: index
		};
	});

	return { path, totalEstimateMinutes: totalEstimate };
}

/**
 * Find all tasks in a project that are currently blocked
 * (i.e., they depend on tasks that are not yet completed).
 */
export async function getBlockedTasks(projectId: string): Promise<
	{
		taskId: string;
		title: string;
		blockedBy: { taskId: string; title: string; status: string }[];
	}[]
> {
	const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, projectId));

	const taskMap = new Map(projectTasks.map((t) => [t.id, t]));
	const taskIds = new Set(projectTasks.map((t) => t.id));

	const allDeps = await db.select().from(taskDependencies);
	const blockingDeps = allDeps.filter(
		(d) =>
			taskIds.has(d.taskId) &&
			taskIds.has(d.dependsOnTaskId) &&
			(d.type === 'blocks' || d.type === 'is_blocked_by')
	);

	// Group dependencies by taskId
	const depsByTask = new Map<string, string[]>();
	for (const dep of blockingDeps) {
		if (!depsByTask.has(dep.taskId)) {
			depsByTask.set(dep.taskId, []);
		}
		depsByTask.get(dep.taskId)!.push(dep.dependsOnTaskId);
	}

	const completedStatuses = new Set(['done', 'cancelled']);
	const blockedTasks: {
		taskId: string;
		title: string;
		blockedBy: { taskId: string; title: string; status: string }[];
	}[] = [];

	for (const [taskId, depTaskIds] of depsByTask) {
		const task = taskMap.get(taskId);
		if (!task || completedStatuses.has(task.status)) continue;

		const incompleteBlockers = depTaskIds
			.map((id) => taskMap.get(id))
			.filter((t) => t && !completedStatuses.has(t.status))
			.map((t) => ({
				taskId: t!.id,
				title: t!.title,
				status: t!.status
			}));

		if (incompleteBlockers.length > 0) {
			blockedTasks.push({
				taskId: task.id,
				title: task.title,
				blockedBy: incompleteBlockers
			});
		}
	}

	return blockedTasks;
}
