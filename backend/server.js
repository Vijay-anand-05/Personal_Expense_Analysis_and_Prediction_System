const app = require('./app');
const db = require('./config/database');

const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Personal Expense Analysis and Prediction System API running at http://localhost:${PORT}/api`);
  console.log(`Database: ${db.dbPath}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Run stop.bat, or change PORT in backend/.env.`);
  } else {
    console.error('Server failed to start:', err.message);
  }
  process.exit(1);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
