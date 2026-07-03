import assert from 'node:assert/strict';
import test from 'node:test';
import { loadLocalEnv } from '../scripts/load-local-env.mjs';
import {
	API_TOKEN_TTL_SECONDS,
	isTokenIssuanceEnabled,
	timingSafeStringEqual,
	verifyClientCredentials,
} from '../src/lib/auth/api-tokens';

loadLocalEnv();

const CLIENT_ID = 'blog-bot';
const CLIENT_SECRET = 'a-long-random-client-secret';

test('timingSafeStringEqual compares strings of any length safely', () => {
	assert.equal(timingSafeStringEqual('abc', 'abc'), true);
	assert.equal(timingSafeStringEqual('abc', 'abd'), false);
	assert.equal(timingSafeStringEqual('abc', 'abcd'), false);
	assert.equal(timingSafeStringEqual('', ''), true);
});

test('token issuance is disabled unless both credentials are configured', () => {
	assert.equal(isTokenIssuanceEnabled('', ''), false);
	assert.equal(isTokenIssuanceEnabled(CLIENT_ID, ''), false);
	assert.equal(isTokenIssuanceEnabled('', CLIENT_SECRET), false);
	assert.equal(isTokenIssuanceEnabled(CLIENT_ID, CLIENT_SECRET), true);
});

test('verifyClientCredentials requires both id and secret to match exactly', () => {
	assert.equal(verifyClientCredentials(CLIENT_ID, CLIENT_SECRET, CLIENT_ID, CLIENT_SECRET), true);
	assert.equal(verifyClientCredentials('wrong', CLIENT_SECRET, CLIENT_ID, CLIENT_SECRET), false);
	assert.equal(verifyClientCredentials(CLIENT_ID, 'wrong', CLIENT_ID, CLIENT_SECRET), false);
	assert.equal(verifyClientCredentials('', '', CLIENT_ID, CLIENT_SECRET), false);
});

test('verifyClientCredentials rejects everything when issuance is disabled', () => {
	assert.equal(verifyClientCredentials('', '', '', ''), false);
	assert.equal(verifyClientCredentials(CLIENT_ID, CLIENT_SECRET, '', ''), false);
});

test(
	'issued tokens can be validated, authorize API requests, and be revoked',
	{ skip: !process.env.REDIS_URL },
	async () => {
		const { getRedis, closeRedis } = await import('../src/lib/auth/session');
		const { issueApiToken, isValidIssuedToken, revokeApiToken } = await import(
			'../src/lib/auth/api-tokens'
		);
		const { authorizeApiRequest } = await import('../src/lib/auth/api');

		process.env.BLOG_API_CLIENT_ID = CLIENT_ID;
		process.env.BLOG_API_CLIENT_SECRET = CLIENT_SECRET;

		const issued = await issueApiToken();

		try {
			assert.equal(issued.expiresIn, API_TOKEN_TTL_SECONDS);
			assert.equal(await isValidIssuedToken(issued.token), true);
			assert.equal(await isValidIssuedToken('not-a-real-token'), false);

			const ttl = await getRedis().ttl(`shisaku:api-token:${issued.token}`);
			assert.ok(ttl > 0 && ttl <= API_TOKEN_TTL_SECONDS);

			// An issued token authorizes an API request without any session,
			// but never grants an author id.
			const request = new Request('http://localhost/api/posts', {
				headers: { authorization: `Bearer ${issued.token}` },
			});
			const auth = await authorizeApiRequest(request, null, '');
			assert.equal(auth.authorized, true);
			assert.equal(auth.adminUserId, null);

			assert.equal(await revokeApiToken(issued.token), true);
			assert.equal(await isValidIssuedToken(issued.token), false);
			assert.equal((await authorizeApiRequest(request, null, '')).authorized, false);
			assert.equal(await revokeApiToken(issued.token), false);
		} finally {
			await revokeApiToken(issued.token);
			closeRedis();
		}
	},
);
