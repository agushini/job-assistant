import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);

export const db = drizzle(client);

// TEMPORARY — will be replaced once real auth is built.
// This lets us test data-saving logic without needing a real logged-in user yet.
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';