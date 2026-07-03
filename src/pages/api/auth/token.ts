import type { APIRoute } from 'astro';
import { z } from 'zod';
import { errorResponse, jsonResponse, parseJsonBody, validationError } from '../../../lib/api';
import { bearerTokenFrom, isValidApiToken } from '../../../lib/auth/api';
import {
	isTokenIssuanceEnabled,
	issueApiToken,
	revokeApiToken,
	verifyClientCredentials,
} from '../../../lib/auth/api-tokens';

const credentialsSchema = z.object({
	clientId: z.string().min(1),
	clientSecret: z.string().min(1),
});

/** Exchanges client credentials for a short-lived bearer token. */
export const POST: APIRoute = async ({ request }) => {
	if (!isTokenIssuanceEnabled()) {
		return errorResponse('Token issuance is not configured on this deployment.', 404);
	}

	const body = await parseJsonBody(request);

	if ('error' in body) {
		return body.error;
	}

	const parsed = credentialsSchema.safeParse(body.data);

	if (!parsed.success) {
		return validationError(parsed.error);
	}

	if (!verifyClientCredentials(parsed.data.clientId, parsed.data.clientSecret)) {
		return errorResponse('Invalid client credentials.', 401);
	}

	try {
		const issued = await issueApiToken();

		return jsonResponse(
			{ accessToken: issued.token, tokenType: 'Bearer', expiresIn: issued.expiresIn },
			200,
			{ 'Cache-Control': 'no-store' },
		);
	} catch (error) {
		console.error('Token issuance failed:', error);
		return errorResponse('Internal server error.', 500);
	}
};

/** Revokes the issued token presented in the Authorization header. */
export const DELETE: APIRoute = async ({ request }) => {
	const header = request.headers.get('authorization');
	const bearer = bearerTokenFrom(header);

	if (!bearer) {
		return errorResponse('Send the token to revoke as "Authorization: Bearer <token>".', 401);
	}

	if (isValidApiToken(header)) {
		return errorResponse(
			'The static BLOG_API_TOKEN cannot be revoked via the API; rotate the environment variable instead.',
			400,
		);
	}

	const revoked = await revokeApiToken(bearer);

	return revoked
		? jsonResponse({ revoked: true })
		: errorResponse('Token is unknown, expired, or already revoked.', 404);
};
