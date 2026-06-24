import { config } from 'dotenv';
import { resolve } from 'node:path';

config({
	path: resolve(process.cwd(), '../Shisaku/.env'),
	quiet: true,
});

export const requireEnv = (name: string): string => {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
};

export const getEnv = (name: string, fallback: string): string => process.env[name] || fallback;
