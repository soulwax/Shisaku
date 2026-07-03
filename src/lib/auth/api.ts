import { timingSafeEqual } from 'node:crypto';
import { getEnv } from '../env';
import { isAuthorizedAdminUser } from './github';

/**
 * Shared secret for the automation API (`/api/posts/**`). Like
 * `ADMIN_GITHUB_USERNAME`, it is unset by default, which disables token
 * authentication entirely — the safe default for a fresh deployment.
 */
export const API_TOKEN_ENV = 'BLOG_API_TOKEN';

export const getConfiguredApiToken = (): string => getEnv(API_TOKEN_ENV, '').trim();

export const bearerTokenFrom = (header: string | null): string | null => {
	const match = header?.match(/^Bearer\s+(\S+)$/i);
	return match ? match[1] : null;
};

export const isValidApiToken = (
	header: string | null,
	configuredToken: string = getConfiguredApiToken(),
): boolean => {
	const provided = bearerTokenFrom(header);

	if (!configuredToken || !provided) {
		return false;
	}

	const providedBytes = Buffer.from(provided);
	const expectedBytes = Buffer.from(configuredToken);

	return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
};

export interface ApiRequestAuth {
	/** True when the request may create, update, or delete posts. */
	authorized: boolean;
	/** The admin's user id when authorized via a session, otherwise null. */
	adminUserId: string | null;
}

/**
 * A request is authorized when it carries a valid `Authorization: Bearer`
 * token, or when it belongs to the signed-in admin's browser session.
 */
export const authorizeApiRequest = (
	request: Request,
	user: { id: string; username: string; email: string; role: string } | null,
	configuredToken: string = getConfiguredApiToken(),
): ApiRequestAuth => {
	const isAdminSession = user !== null && isAuthorizedAdminUser(user);

	return {
		authorized: isAdminSession || isValidApiToken(request.headers.get('authorization'), configuredToken),
		adminUserId: isAdminSession ? user.id : null,
	};
};
