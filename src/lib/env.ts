import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const localEnvPath = resolve(projectRoot, '.env.local');
const shisakuEnvPath = resolve(projectRoot, '../Shisaku/.env');

if (existsSync(shisakuEnvPath)) {
	config({ path: shisakuEnvPath, quiet: true });
}

if (existsSync(localEnvPath)) {
	config({ path: localEnvPath, quiet: true, override: false });
}

export const requireEnv = (name: string): string => {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
};

export const getEnv = (name: string, fallback: string): string => process.env[name] || fallback;
