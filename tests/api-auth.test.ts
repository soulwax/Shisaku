import assert from 'node:assert/strict';
import test from 'node:test';
import {
	authorizeApiRequest,
	bearerTokenFrom,
	isValidApiToken,
} from '../src/lib/auth/api';

// Keep these tests hermetic: disable the issued-token flow so
// authorizeApiRequest never reaches for Redis, regardless of .env.local.
process.env.BLOG_API_CLIENT_ID = '';
process.env.BLOG_API_CLIENT_SECRET = '';

const TOKEN = 'test-token-1234567890';

const requestWith = (authorization?: string): Request =>
	new Request('http://localhost/api/posts', {
		headers: authorization ? { authorization } : {},
	});

test('bearerTokenFrom extracts the token from a Bearer header', () => {
	assert.equal(bearerTokenFrom(`Bearer ${TOKEN}`), TOKEN);
	assert.equal(bearerTokenFrom(`bearer ${TOKEN}`), TOKEN);
	assert.equal(bearerTokenFrom(null), null);
	assert.equal(bearerTokenFrom('Basic dXNlcjpwYXNz'), null);
	assert.equal(bearerTokenFrom('Bearer'), null);
	assert.equal(bearerTokenFrom(''), null);
});

test('isValidApiToken accepts only the exact configured token', () => {
	assert.equal(isValidApiToken(`Bearer ${TOKEN}`, TOKEN), true);
	assert.equal(isValidApiToken(`Bearer ${TOKEN}x`, TOKEN), false);
	assert.equal(isValidApiToken(`Bearer ${TOKEN.slice(0, -1)}`, TOKEN), false);
	assert.equal(isValidApiToken(TOKEN, TOKEN), false);
	assert.equal(isValidApiToken(null, TOKEN), false);
});

test('token auth is disabled when no token is configured', () => {
	assert.equal(isValidApiToken(`Bearer ${TOKEN}`, ''), false);
	assert.equal(isValidApiToken('Bearer ', ''), false);
});

test('a valid bearer token authorizes the request without a session', async () => {
	const auth = await authorizeApiRequest(requestWith(`Bearer ${TOKEN}`), null, TOKEN);
	assert.equal(auth.authorized, true);
	assert.equal(auth.adminUserId, null);
});

test('requests without token or admin session are rejected', async () => {
	assert.equal((await authorizeApiRequest(requestWith(), null, TOKEN)).authorized, false);
	assert.equal(
		(await authorizeApiRequest(requestWith('Bearer wrong'), null, TOKEN)).authorized,
		false,
	);
});

test('an admin session authorizes the request and exposes the author id', async () => {
	process.env.ADMIN_GITHUB_USERNAME = 'configured-admin';

	const admin = {
		id: '00000000-0000-4000-8000-000000000000',
		username: 'configured-admin',
		email: 'admin@example.com',
		role: 'admin',
	};
	const auth = await authorizeApiRequest(requestWith(), admin, TOKEN);

	assert.equal(auth.authorized, true);
	assert.equal(auth.adminUserId, admin.id);
});

test('a commenter session does not authorize write access', async () => {
	process.env.ADMIN_GITHUB_USERNAME = 'configured-admin';

	const commenter = {
		id: '00000000-0000-4000-8000-000000000001',
		username: 'someone-else',
		email: 'someone@example.com',
		role: 'commenter',
	};

	assert.equal((await authorizeApiRequest(requestWith(), commenter, TOKEN)).authorized, false);
});

test('a commenter session with a valid token is authorized but not the author', async () => {
	process.env.ADMIN_GITHUB_USERNAME = 'configured-admin';

	const commenter = {
		id: '00000000-0000-4000-8000-000000000001',
		username: 'someone-else',
		email: 'someone@example.com',
		role: 'commenter',
	};
	const auth = await authorizeApiRequest(requestWith(`Bearer ${TOKEN}`), commenter, TOKEN);

	assert.equal(auth.authorized, true);
	assert.equal(auth.adminUserId, null);
});
