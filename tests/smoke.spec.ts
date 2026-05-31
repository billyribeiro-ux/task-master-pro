import { test, expect } from '@playwright/test';

test.describe('public pages', () => {
	test('landing page renders with a call to action', async ({ page }) => {
		const response = await page.goto('/');
		expect(response?.status()).toBeLessThan(400);
		await expect(
			page.getByRole('link', { name: /get started|sign in|dashboard/i }).first()
		).toBeVisible();
	});

	test('login page is reachable and has a form', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
	});

	test('register page is reachable', async ({ page }) => {
		await page.goto('/register');
		await expect(page.locator('input[type="email"]')).toBeVisible();
	});
});

test.describe('security', () => {
	test('protected app routes redirect unauthenticated users to login', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login/);
	});

	test('responses carry hardening headers and a request id', async ({ request }) => {
		const res = await request.get('/');
		expect(res.headers()['x-frame-options']).toBe('DENY');
		expect(res.headers()['x-content-type-options']).toBe('nosniff');
		expect(res.headers()['content-security-policy']).toContain("default-src 'self'");
		expect(res.headers()['x-request-id']).toBeTruthy();
	});

	test('health endpoint responds ok', async ({ request }) => {
		const res = await request.get('/api/health');
		expect(res.ok()).toBeTruthy();
	});
});
