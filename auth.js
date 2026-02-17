import 'dotenv/config';
import { betterAuth } from 'better-auth';
import pg from 'pg';

const { Pool } = pg;

export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,      // 1 day
    },
    account: {
        accountLinking: {
            enabled: true,
        },
    },
    // Social providers — ready to configure later
    // socialProviders: {
    //   google: {
    //     clientId: process.env.GOOGLE_CLIENT_ID,
    //     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    //   },
    //   facebook: {
    //     clientId: process.env.FACEBOOK_CLIENT_ID,
    //     clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    //   },
    // },
});
