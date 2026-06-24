import { getEnv } from '../env';

export const ADMIN_GITHUB_USERNAME = 'soulwax';

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

export const getAllowedGitHubEmailSuffix = () =>
	getEnv('GITHUB_ALLOWED_EMAIL_SUFFIX', 'users.noreply.github.com')
		.trim()
		.toLowerCase()
		.replace(/^@/, '');

export const isAllowedGitHubIdentity = (
	identity: Pick<GitHubIdentity, 'login'>,
	email: string | null,
): boolean => {
	if (identity.login.toLowerCase() !== ADMIN_GITHUB_USERNAME) {
		return false;
	}

	if (!email) {
		return false;
	}

	return email.toLowerCase().endsWith(`@${getAllowedGitHubEmailSuffix()}`);
};

export const isAuthorizedAdminUser = (user: {
	username: string;
	email: string;
	role: string;
}): boolean =>
	user.role === 'admin' &&
	isAllowedGitHubIdentity({ login: user.username }, user.email);

export const selectVerifiedGitHubEmail = (
	emails: GitHubEmail[],
	_profileEmail: string | null,
): string | null => {
	const allowedVerified = emails.filter(
		(email) =>
			email.verified &&
			email.email.toLowerCase().endsWith(`@${getAllowedGitHubEmailSuffix()}`),
	);

	return allowedVerified.find((email) => email.primary)?.email ?? allowedVerified[0]?.email ?? null;
};
