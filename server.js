'use strict'; // Enforce strict mode

require('dotenv').config();

const http = require('http');
const { sequelize } = require('./models');
const { Server } = require('socket.io');
const scheduler = require('./utils/scheduler');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    
    scheduler.start();

    // 🔄 Load app AFTER session setup is complete
    const app = await require('./app'); // ← Wait for async app

    const server = http.createServer(app);

    const io = new Server(server);
    app.set('io', io);
    require('./socket')(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Startup error:', err);
  }
})();
