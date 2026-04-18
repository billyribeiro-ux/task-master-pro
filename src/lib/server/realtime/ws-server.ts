import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
	return io;
}

export function attachSocketIO(httpServer: HTTPServer): SocketIOServer {
	if (io) return io;

	io = new SocketIOServer(httpServer, {
		cors: {
			origin: process.env.ORIGIN ?? 'http://localhost:5173',
			credentials: true
		},
		path: '/socket.io'
	});

	io.use(async (socket, next) => {
		const cookie = socket.handshake.headers.cookie;
		if (!cookie) {
			return next(new Error('Authentication required'));
		}

		const sessionToken = parseCookie(cookie, 'session');
		if (!sessionToken) {
			return next(new Error('Authentication required'));
		}

		try {
			const { validateSessionToken } = await import('$lib/server/auth/index.js');
			const { session, user } = await validateSessionToken(sessionToken);
			if (!session || !user) {
				return next(new Error('Invalid session'));
			}
			socket.data.user = user;
			socket.data.session = session;
			next();
		} catch {
			next(new Error('Authentication failed'));
		}
	});

	io.on('connection', (socket) => {
		const user = socket.data.user;

		socket.on('join:project', (projectId: string) => {
			socket.join(`project:${projectId}`);
			socket.to(`project:${projectId}`).emit('presence:joined', {
				userId: user.id,
				name: user.name,
				avatarUrl: user.avatarUrl
			});
		});

		socket.on('leave:project', (projectId: string) => {
			socket.leave(`project:${projectId}`);
			socket.to(`project:${projectId}`).emit('presence:left', {
				userId: user.id
			});
		});

		socket.on(
			'task:update',
			(data: { projectId: string; taskId: string; changes: Record<string, unknown> }) => {
				socket.to(`project:${data.projectId}`).emit('task:update', {
					taskId: data.taskId,
					changes: data.changes,
					actorId: user.id
				});
			}
		);

		socket.on(
			'task:move',
			(data: { projectId: string; taskId: string; columnId: string; position: string }) => {
				socket.to(`project:${data.projectId}`).emit('task:move', {
					taskId: data.taskId,
					columnId: data.columnId,
					position: data.position,
					actorId: user.id
				});
			}
		);

		socket.on('cursor:move', (data: { projectId: string; x: number; y: number }) => {
			socket.volatile.to(`project:${data.projectId}`).emit('cursor:move', {
				userId: user.id,
				x: data.x,
				y: data.y
			});
		});

		socket.on('presence:heartbeat', (projectId: string) => {
			socket.to(`project:${projectId}`).emit('presence:heartbeat', {
				userId: user.id,
				timestamp: Date.now()
			});
		});

		// ─── Future Feature Real-time Events ────────────────────────────

		socket.on(
			'task:dependency:created',
			(data: { projectId: string; taskId: string; dependsOnTaskId: string; type: string }) => {
				socket.to(`project:${data.projectId}`).emit('task:dependency:created', {
					taskId: data.taskId,
					dependsOnTaskId: data.dependsOnTaskId,
					type: data.type,
					actorId: user.id
				});
			}
		);

		socket.on(
			'task:dependency:removed',
			(data: { projectId: string; taskId: string; dependsOnTaskId: string }) => {
				socket.to(`project:${data.projectId}`).emit('task:dependency:removed', {
					taskId: data.taskId,
					dependsOnTaskId: data.dependsOnTaskId,
					actorId: user.id
				});
			}
		);

		socket.on(
			'automation:triggered',
			(data: { projectId: string; ruleId: string; ruleName: string; taskId?: string }) => {
				socket.to(`project:${data.projectId}`).emit('automation:triggered', {
					ruleId: data.ruleId,
					ruleName: data.ruleName,
					taskId: data.taskId,
					actorId: user.id,
					timestamp: Date.now()
				});
			}
		);

		socket.on(
			'custom-field:updated',
			(data: { projectId: string; taskId: string; fieldId: string; value: unknown }) => {
				socket.to(`project:${data.projectId}`).emit('custom-field:updated', {
					taskId: data.taskId,
					fieldId: data.fieldId,
					value: data.value,
					actorId: user.id
				});
			}
		);

		socket.on('goal:progress', (data: { projectId: string; goalId: string; progress: number }) => {
			socket.to(`project:${data.projectId}`).emit('goal:progress', {
				goalId: data.goalId,
				progress: data.progress,
				actorId: user.id
			});
		});

		socket.on(
			'ai:suggestion',
			(data: { projectId: string; suggestionId: string; type: string; title: string }) => {
				socket.to(`project:${data.projectId}`).emit('ai:suggestion', {
					suggestionId: data.suggestionId,
					type: data.type,
					title: data.title,
					timestamp: Date.now()
				});
			}
		);

		socket.on('disconnecting', () => {
			for (const room of socket.rooms) {
				if (room.startsWith('project:')) {
					socket.to(room).emit('presence:left', {
						userId: user.id
					});
				}
			}
		});
	});

	return io;
}

function parseCookie(cookieHeader: string, name: string): string | null {
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}
