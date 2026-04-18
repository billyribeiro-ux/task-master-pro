import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';

function socketIODevPlugin() {
	return {
		name: 'socket-io-dev',
		configureServer(server: ViteDevServer) {
			if (!server.httpServer) return;

			import('./src/lib/server/realtime/ws-server.js')
				.then((mod) => {
					if (server.httpServer) {
						mod.attachSocketIO(server.httpServer as never);
					}
				})
				.catch(() => {
					console.log('[socket.io] Real-time server not yet available — will be set up later.');
				});
		}
	};
}

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), socketIODevPlugin()],
	server: {
		fs: {
			allow: ['.']
		}
	}
});
