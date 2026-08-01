import config from './config.js';
import app, { ensureDatabase } from './app.js';

ensureDatabase()
  .then(() => {
    const server = app.listen(config.port, () => {
      console.log(`Money Tracker API running on http://localhost:${config.port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use.`);
        console.error('Run: taskkill -F -IM node.exe  (Windows)');
        console.error('Or:  kill -9 $(lsof -ti:3001)  (Linux/Mac)');
        process.exit(1);
      }
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
