import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { users } from '../../../../db/schema';
import {
	isAllowedGitHubIdentity,
	selectVerifiedGitHubEmail,
	type GitHubEmail,
	type GitHubIdentity,
} from '../../../../lib/auth/github';
import {
	createSession,
	SESSION_COOKIE,
	sessionCookieOptions,
} from '../../../../lib/auth/session';
import { requireEnv } from '../../../../lib/env';

const OAUTH_STATE_COOKIE = 'shisaku_oauth_state';

export const GET: APIRoute = async ({ cookies, redirect, url }) => {
	const fail = (reason: string) =>
		redirect(`/admin/login?error=${encodeURIComponent(reason)}`);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(OAUTH_STATE_COOKIE)?.value;
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

	if (!code || !state || !expectedState || state !== expectedState) {
		return fail('OAuth state validation failed.');
	}

	const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			client_id: requireEnv('GITHUB_CLIENT_ID'),
			client_secret: requireEnv('GITHUB_CLIENT_SECRET'),
			code,
			redirect_uri: new URL('/admin/oauth/github/callback', url.origin).toString(),
		}),
	});

	if (!tokenResponse.ok) {
		return fail('GitHub token exchange failed.');
	}

	const tokenPayload = (await tokenResponse.json()) as {
		access_token?: string;
		error_description?: string;
	};

	if (!tokenPayload.access_token) {
		return fail(tokenPayload.error_description ?? 'GitHub did not return an access token.');
	}

	const githubHeaders = {
		Accept: 'application/vnd.github+json',
		Authorization: `Bearer ${tokenPayload.access_token}`,
		'X-GitHub-Api-Version': '2022-11-28',
	};

	const [identityResponse, emailsResponse] = await Promise.all([
		fetch('https://api.github.com/user', { headers: githubHeaders }),
		fetch('https://api.github.com/user/emails', { headers: githubHeaders }),
	]);

	if (!identityResponse.ok || !emailsResponse.ok) {
		return fail('GitHub profile lookup failed.');
	}

	const identity = (await identityResponse.json()) as GitHubIdentity;
	const emails = (await emailsResponse.json()) as GitHubEmail[];
	const email = selectVerifiedGitHubEmail(emails, identity.email);

	if (!isAllowedGitHubIdentity(identity, email)) {
		return fail('This GitHub account is not authorized for shisaku admin.');
	}

	const now = new Date();
	const [upsertedUser] = await db
		.insert(users)
		.values({
			githubId: String(identity.id),
			username: identity.login.toLowerCase(),
			email: email!,
			role: 'admin',
			lastLoginAt: now,
		})
		.onConflictDoUpdate({
			target: users.githubId,
			set: {
				username: identity.login.toLowerCase(),
				email: email!,
				role: 'admin',
				lastLoginAt: now,
			},
		})
		.returning();

	let user = upsertedUser;

	if (!user) {
		const [existingUser] = await db
			.select()
			.from(users)
			.where(eq(users.githubId, String(identity.id)))
			.limit(1);

		if (!existingUser) {
			return fail('Unable to create the admin account.');
		}

		user = existingUser;
	}

	const sessionToken = await createSession(user.id);
	cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(url));

	return redirect('/admin');
};
