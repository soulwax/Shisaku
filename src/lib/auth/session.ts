import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import Redis from 'ioredis';
import { db } from '../../db/client';
import { users, type User } from '../../db/schema';
import { requireEnv } from '../env';

export const SESSION_COOKIE = 'shisaku_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const SESSION_KEY_PREFIX = 'shisaku:session:';

let redis: Redis | undefined;

export const getRedis = () => {
	if (!redis) {
		redis = new Redis(requireEnv('REDIS_URL'), {
			lazyConnect: true,
			maxRetriesPerRequest: 2,
			enableReadyCheck: true,
		});
	}

	return redis;
};

const sessionKey = (token: string) => `${SESSION_KEY_PREFIX}${token}`;

export const createSession = async (userId: string): Promise<string> => {
	const token = randomBytes(32).toString('base64url');
	await getRedis().set(sessionKey(token), userId, 'EX', SESSION_TTL_SECONDS);
	return token;
};

export const deleteSession = async (token: string): Promise<void> => {
	await getRedis().del(sessionKey(token));
};

export const getSessionUserId = async (token: string): Promise<string | null> =>
	getRedis().get(sessionKey(token));

export const getSessionUser = async (token: string | undefined): Promise<User | null> => {
	if (!token) {
		return null;
	}

	const userId = await getSessionUserId(token);

	if (!userId) {
		return null;
	}

	const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
	return user ?? null;
};

export const sessionCookieOptions = (url: URL) => ({
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: import.meta.env.PROD || url.protocol === 'https:',
	path: '/',
	maxAge: SESSION_TTL_SECONDS,
});

export const closeRedis = () => {
	redis?.disconnect();
	redis = undefined;
};
