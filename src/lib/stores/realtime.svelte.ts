import { browser } from '$app/environment';
import { io, type Socket } from 'socket.io-client';
import { SvelteMap } from 'svelte/reactivity';

interface PresenceUser {
	userId: string;
	name: string;
	avatarUrl: string | null;
}

class RealtimeState {
	socket = $state<Socket | null>(null);
	connected = $state(false);
	currentProjectId = $state<string | null>(null);
	presenceUsers = new SvelteMap<string, PresenceUser>();
	taskUpdates = $state<
		Array<{ taskId: string; changes: Record<string, unknown>; actorId: string }>
	>([]);

	connect() {
		if (!browser || this.socket) return;

		this.socket = io({
			path: '/socket.io',
			withCredentials: true,
			autoConnect: true
		});

		this.socket.on('connect', () => {
			this.connected = true;
		});

		this.socket.on('disconnect', () => {
			this.connected = false;
		});

		this.socket.on('presence:joined', (data: PresenceUser) => {
			this.presenceUsers.set(data.userId, data);
		});

		this.socket.on('presence:left', (data: { userId: string }) => {
			this.presenceUsers.delete(data.userId);
		});

		this.socket.on(
			'task:update',
			(data: { taskId: string; changes: Record<string, unknown>; actorId: string }) => {
				this.taskUpdates = [...this.taskUpdates.slice(-49), data];
			}
		);

		this.socket.on(
			'task:move',
			(data: { taskId: string; columnId: string; position: string; actorId: string }) => {
				this.taskUpdates = [
					...this.taskUpdates.slice(-49),
					{
						taskId: data.taskId,
						changes: { columnId: data.columnId, position: data.position },
						actorId: data.actorId
					}
				];
			}
		);
	}

	joinProject(projectId: string) {
		if (this.currentProjectId) {
			this.leaveProject();
		}
		this.currentProjectId = projectId;
		this.presenceUsers.clear();
		this.socket?.emit('join:project', projectId);
	}

	leaveProject() {
		if (this.currentProjectId) {
			this.socket?.emit('leave:project', this.currentProjectId);
			this.currentProjectId = null;
			this.presenceUsers.clear();
		}
	}

	emitTaskUpdate(projectId: string, taskId: string, changes: Record<string, unknown>) {
		this.socket?.emit('task:update', { projectId, taskId, changes });
	}

	emitTaskMove(projectId: string, taskId: string, columnId: string, position: string) {
		this.socket?.emit('task:move', { projectId, taskId, columnId, position });
	}

	disconnect() {
		this.leaveProject();
		this.socket?.disconnect();
		this.socket = null;
		this.connected = false;
	}
}

export const realtime = new RealtimeState();
