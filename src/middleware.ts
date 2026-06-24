import { defineMiddleware } from 'astro:middleware';
import { isAuthorizedAdminUser } from './lib/auth/github';
import { getSessionUser, SESSION_COOKIE } from './lib/auth/session';

const PUBLIC_ADMIN_PATHS = new Set([
	'/admin/login',
	'/admin/oauth/github/start',
	'/admin/oauth/github/callback',
]);

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.user = null;

	const token = context.cookies.get(SESSION_COOKIE)?.value;

	if (token) {
		try {
			context.locals.user = await getSessionUser(token);
		} catch (error) {
			context.locals.user = null;
			context.logger.error(`Session lookup failed: ${String(error)}`);
		}
	}

	const path = context.url.pathname.replace(/\/$/, '') || '/';
	const isProtectedAdminPath = path.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.has(path);
	const isAuthorizedAdmin =
		context.locals.user && isAuthorizedAdminUser(context.locals.user);

	if (isProtectedAdminPath && !isAuthorizedAdmin) {
		return context.redirect('/admin/login');
	}

	return next();
});
