import { db } from '$lib/server/db/index.js';
import { goals, goalTaskLinks, tasks } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * Calculate goal progress based on its progressType.
 *
 * - manual: returns the current progressCurrent as-is (no computation)
 * - task_count: computes % of linked tasks that are completed (status = 'done')
 * - task_story_points: computes % of completed story points out of total linked story points
 * - key_result_average: averages the progress percentage of all child key_result goals
 *
 * Returns the computed progress value and updates the goal in the database.
 */
export async function calculateGoalProgress(goalId: string): Promise<number> {
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw new Error(`Goal not found: ${goalId}`);

	let progress: number;

	switch (goal.progressType) {
		case 'manual': {
			// Manual progress is managed by check-ins; nothing to compute
			progress = goal.progressCurrent;
			break;
		}

		case 'task_count': {
			// Get all linked task IDs
			const links = await db
				.select({ taskId: goalTaskLinks.taskId })
				.from(goalTaskLinks)
				.where(eq(goalTaskLinks.goalId, goalId));

			if (links.length === 0) {
				progress = 0;
				break;
			}

			let completedCount = 0;
			for (const link of links) {
				const [task] = await db
					.select({ status: tasks.status })
					.from(tasks)
					.where(eq(tasks.id, link.taskId))
					.limit(1);

				if (task && task.status === 'done') {
					completedCount++;
				}
			}

			const percentage = (completedCount / links.length) * goal.progressTarget;
			progress = Math.round(percentage * 100) / 100;
			break;
		}

		case 'task_story_points': {
			const links = await db
				.select({ taskId: goalTaskLinks.taskId })
				.from(goalTaskLinks)
				.where(eq(goalTaskLinks.goalId, goalId));

			if (links.length === 0) {
				progress = 0;
				break;
			}

			let totalPoints = 0;
			let completedPoints = 0;

			for (const link of links) {
				const [task] = await db
					.select({ status: tasks.status, storyPoints: tasks.storyPoints })
					.from(tasks)
					.where(eq(tasks.id, link.taskId))
					.limit(1);

				if (task && task.storyPoints) {
					totalPoints += task.storyPoints;
					if (task.status === 'done') {
						completedPoints += task.storyPoints;
					}
				}
			}

			if (totalPoints === 0) {
				progress = 0;
			} else {
				const percentage = (completedPoints / totalPoints) * goal.progressTarget;
				progress = Math.round(percentage * 100) / 100;
			}
			break;
		}

		case 'key_result_average': {
			// Average progress of child goals that are key_results
			const childGoals = await db
				.select()
				.from(goals)
				.where(and(eq(goals.parentGoalId, goalId), eq(goals.type, 'key_result')));

			if (childGoals.length === 0) {
				progress = 0;
				break;
			}

			let totalPercentage = 0;
			for (const child of childGoals) {
				const childPercent =
					child.progressTarget > 0 ? (child.progressCurrent / child.progressTarget) * 100 : 0;
				totalPercentage += childPercent;
			}

			const avgPercentage = totalPercentage / childGoals.length;
			// Scale to the goal's progressTarget
			progress = Math.round((avgPercentage / 100) * goal.progressTarget * 100) / 100;
			break;
		}

		default:
			progress = goal.progressCurrent;
	}

	// Persist updated progress
	await db
		.update(goals)
		.set({
			progressCurrent: progress,
			updatedAt: new Date().toISOString()
		})
		.where(eq(goals.id, goalId));

	return progress;
}

/**
 * Auto-determine goal status based on progress relative to timeline.
 *
 * Logic:
 * - If progress >= progressTarget => 'completed'
 * - If no dueDate or startDate => 'active' (cannot determine timeline risk)
 * - Otherwise, compute expected progress based on elapsed time vs total duration:
 *   - If actual progress >= expected progress => 'on_track'
 *   - If actual progress >= 70% of expected => 'behind'
 *   - Otherwise => 'at_risk'
 *
 * Returns the determined status and updates the goal in the database.
 */
export async function updateGoalStatus(goalId: string): Promise<string> {
	const [goal] = await db.select().from(goals).where(eq(goals.id, goalId)).limit(1);

	if (!goal) throw new Error(`Goal not found: ${goalId}`);

	// If already completed or cancelled, don't auto-update
	if (goal.status === 'completed' || goal.status === 'cancelled') {
		return goal.status;
	}

	const progressPercent =
		goal.progressTarget > 0 ? (goal.progressCurrent / goal.progressTarget) * 100 : 0;

	// If goal has reached its target
	if (progressPercent >= 100) {
		await db
			.update(goals)
			.set({
				status: 'completed',
				completedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			})
			.where(eq(goals.id, goalId));

		return 'completed';
	}

	// If no timeline is set, mark as active
	if (!goal.startDate || !goal.dueDate) {
		if (goal.status === 'draft') {
			return goal.status;
		}

		await db
			.update(goals)
			.set({
				status: 'active',
				updatedAt: new Date().toISOString()
			})
			.where(eq(goals.id, goalId));

		return 'active';
	}

	// Calculate expected progress based on timeline
	const now = new Date();
	const start = new Date(goal.startDate);
	const due = new Date(goal.dueDate);

	const totalDuration = due.getTime() - start.getTime();
	if (totalDuration <= 0) {
		// Due date is at or before start; treat as at_risk if not complete
		await db
			.update(goals)
			.set({
				status: 'at_risk',
				updatedAt: new Date().toISOString()
			})
			.where(eq(goals.id, goalId));

		return 'at_risk';
	}

	const elapsed = now.getTime() - start.getTime();
	const timePercent = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);

	let status: 'on_track' | 'behind' | 'at_risk';

	if (progressPercent >= timePercent) {
		status = 'on_track';
	} else if (progressPercent >= timePercent * 0.7) {
		status = 'behind';
	} else {
		status = 'at_risk';
	}

	await db
		.update(goals)
		.set({
			status,
			updatedAt: new Date().toISOString()
		})
		.where(eq(goals.id, goalId));

	return status;
}
