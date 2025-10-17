import 'dotenv/config';

export default {
    schema: [
        './src/models/user.model.js',
        './src/models/job.model.js',
        './src/models/notification.model.js'
    ],
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL
    }
}
