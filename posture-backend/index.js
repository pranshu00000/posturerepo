const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'https://posturerepo.vercel.app',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => {
  res.send('Posture Detection Backend is running!');
});

socketHandler(io); // Initialize socket events

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
