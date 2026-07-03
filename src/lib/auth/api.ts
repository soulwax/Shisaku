import { getEnv } from '../env';
import {
	isTokenIssuanceEnabled,
	isValidIssuedToken,
	timingSafeStringEqual,
} from './api-tokens';
import { isAuthorizedAdminUser } from './github';

/**
 * Static shared secret for the automation API (`/api/posts/**`). Like
 * `ADMIN_GITHUB_USERNAME`, it is unset by default, which disables static
 * token authentication entirely — the safe default for a fresh deployment.
 * For automation that should not hold a long-lived secret, prefer the
 * short-lived tokens issued by `POST /api/auth/token` (see api-tokens.ts).
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

	return timingSafeStringEqual(provided, configuredToken);
};

export interface ApiRequestAuth {
	/** True when the request may create, update, or delete posts. */
	authorized: boolean;
	/** The admin's user id when authorized via a session, otherwise null. */
	adminUserId: string | null;
}

/**
 * A request is authorized when it belongs to the signed-in admin's browser
 * session, carries the static `BLOG_API_TOKEN`, or carries a short-lived
 * token previously issued by `POST /api/auth/token`.
 */
export const authorizeApiRequest = async (
	request: Request,
	user: { id: string; username: string; email: string; role: string } | null,
	configuredToken: string = getConfiguredApiToken(),
): Promise<ApiRequestAuth> => {
	if (user !== null && isAuthorizedAdminUser(user)) {
		return { authorized: true, adminUserId: user.id };
	}

	const header = request.headers.get('authorization');

	if (isValidApiToken(header, configuredToken)) {
		return { authorized: true, adminUserId: null };
	}

	const bearer = bearerTokenFrom(header);
	const authorized = bearer !== null && isTokenIssuanceEnabled() && (await isValidIssuedToken(bearer));

	return { authorized, adminUserId: null };
};
