import express from 'express';
import logger from '#config/logger.js';
import helmet from "helmet"
import morgan from 'morgan';
import cors from 'cors'
import cookieParser from 'cookie-parser';
import authRoutes from '#routes/auth.routes.js';
import jobsRoutes from '#routes/jobs.routes.js';
import userRoutes from '#routes/user.routes.js';
import notificationsRoutes from '#routes/notifications.routes.js';
import applicationsRoutes from '#routes/applications.routes.js';
import { securityMiddleware } from '#middleware/security.middleware.js';
import { clerkAuth } from '#middleware/clerk.middleware.js';

const app = express();

app.use(helmet());
app.use(cors(
  {
  origin: ['http://localhost:8081', 'http://localhost:19006'], // add your dev URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  }
))
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser())

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(clerkAuth);
app.use(securityMiddleware);

app.get('/', (req, res) => {

    logger.info('Root endpoint from Quickhands API');
    res.status(200).send('Hello from Quickhands API');
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime()})
})

app.get('/api', (req, res) => {
    res.status(200).json({ message: 'Quickhands API is runnning'})
})

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/applications', applicationsRoutes);

export default app;

