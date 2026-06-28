import { getEnv } from '../env';

/**
 * The GitHub login that is granted admin (authoring) rights.
 *
 * This is intentionally not hardcoded: anyone deploying their own instance sets
 * `ADMIN_GITHUB_USERNAME` to their own GitHub handle. When it is unset, nobody is
 * an admin, which is the safe default for a fresh/public deployment.
 */
export const getAdminGitHubUsername = (): string =>
	getEnv('ADMIN_GITHUB_USERNAME', '').trim().toLowerCase();

export interface GitHubIdentity {
	id: number;
	login: string;
	email: string | null;
}

export interface GitHubEmail {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
}

export const isAllowedGitHubIdentity = (identity: Pick<GitHubIdentity, 'login'>): boolean =>
	identity.login.trim().length > 0;

export const roleForGitHubLogin = (
	login: string,
	adminUsername: string = getAdminGitHubUsername(),
): 'admin' | 'commenter' =>
	adminUsername.length > 0 && login.trim().toLowerCase() === adminUsername
		? 'admin'
		: 'commenter';

export const isAuthenticatedGitHubUser = (user: {
	username: string;
	email: string;
	role: string;
}): boolean =>
	(user.role === 'admin' || user.role === 'commenter') &&
	isAllowedGitHubIdentity({ login: user.username });

export const isAuthorizedAdminUser = (
	user: {
		username: string;
		email: string;
		role: string;
	},
	adminUsername: string = getAdminGitHubUsername(),
): boolean =>
	user.role === 'admin' &&
	adminUsername.length > 0 &&
	user.username.trim().toLowerCase() === adminUsername;

export const selectVerifiedGitHubEmail = (
	emails: GitHubEmail[],
	profileEmail: string | null,
): string | null => {
	const verified = emails.filter((email) => email.verified);

	return verified.find((email) => email.primary)?.email ?? verified[0]?.email ?? profileEmail;
};
