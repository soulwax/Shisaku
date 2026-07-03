import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../env';
import { getRedis } from './session';

/**
 * Client credentials for fetching short-lived API tokens from
 * `POST /api/auth/token`. Both must be set to enable the flow; when either is
 * missing, token issuance is disabled — the safe default, mirroring
 * `BLOG_API_TOKEN` and `ADMIN_GITHUB_USERNAME`.
 */
export const API_CLIENT_ID_ENV = 'BLOG_API_CLIENT_ID';
export const API_CLIENT_SECRET_ENV = 'BLOG_API_CLIENT_SECRET';

export const API_TOKEN_TTL_SECONDS = 60 * 60;
const API_TOKEN_KEY_PREFIX = 'shisaku:api-token:';

export const timingSafeStringEqual = (a: string, b: string): boolean => {
	const aBytes = Buffer.from(a);
	const bBytes = Buffer.from(b);
	return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);
};

export const getConfiguredClientId = (): string => getEnv(API_CLIENT_ID_ENV, '').trim();

export const getConfiguredClientSecret = (): string => getEnv(API_CLIENT_SECRET_ENV, '').trim();

export const isTokenIssuanceEnabled = (
	clientId: string = getConfiguredClientId(),
	clientSecret: string = getConfiguredClientSecret(),
): boolean => clientId.length > 0 && clientSecret.length > 0;

export const verifyClientCredentials = (
	providedId: string,
	providedSecret: string,
	configuredId: string = getConfiguredClientId(),
	configuredSecret: string = getConfiguredClientSecret(),
): boolean => {
	if (!isTokenIssuanceEnabled(configuredId, configuredSecret)) {
		return false;
	}

	// Evaluate both comparisons so a mismatch in one does not change timing.
	const idMatches = timingSafeStringEqual(providedId, configuredId);
	const secretMatches = timingSafeStringEqual(providedSecret, configuredSecret);
	return idMatches && secretMatches;
};

const tokenKey = (token: string) => `${API_TOKEN_KEY_PREFIX}${token}`;

export interface IssuedApiToken {
	token: string;
	expiresIn: number;
}

export const issueApiToken = async (): Promise<IssuedApiToken> => {
	const token = randomBytes(32).toString('base64url');
	await getRedis().set(tokenKey(token), new Date().toISOString(), 'EX', API_TOKEN_TTL_SECONDS);
	return { token, expiresIn: API_TOKEN_TTL_SECONDS };
};

export const isValidIssuedToken = async (token: string): Promise<boolean> => {
	if (!token) {
		return false;
	}

	try {
		return (await getRedis().get(tokenKey(token))) !== null;
	} catch (error) {
		// Redis being unreachable must fail closed, not crash the request.
		console.error('Issued-token lookup failed:', error);
		return false;
	}
};

export const revokeApiToken = async (token: string): Promise<boolean> => {
	try {
		return (await getRedis().del(tokenKey(token))) > 0;
	} catch (error) {
		console.error('Issued-token revocation failed:', error);
		return false;
	}
};
