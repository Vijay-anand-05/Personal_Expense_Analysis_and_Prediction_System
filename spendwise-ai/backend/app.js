const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const db = require('./database/database');
const SQLiteSessionStore = require('./database/sqliteSessionStore');
const { csrfCheck } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Trust proxy if deployed behind reverse proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Allows inline SVG / charts in vanilla frontend
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration supporting session credentials
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5000,http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Persistent server-side session management
app.use(
  session({
    store: new SQLiteSessionStore({ db }),
    secret: process.env.SESSION_SECRET || 'personal-expense-analysis-secret-key-39281729',
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Apply CSRF protection on state-changing API endpoints
app.use('/api', csrfCheck);

// System health check
app.get('/api/health', (req, res) => {
  const counts = db
    .prepare(
      'SELECT (SELECT COUNT(*) FROM expenses) AS expenses, (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM users) AS users'
    )
    .get();
  res.json({
    success: true,
    status: 'ok',
    database: { connected: true, file: path.basename(db.dbPath), ...counts },
    uptime_seconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/predictions', require('./routes/predictionRoutes'));

// Serve static frontend assets
const frontendPath = path.resolve(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// 404 & error handlers for API
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
