require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/db');
const { configurePassport } = require('./config/passport');
const authJwt = require('./middleware/authJwt');
const parcelleRoutes = require('./Routes/parcelleRoutes');
const alertRoutes = require('./Routes/alertRoutes');
const pushRoutes = require('./Routes/pushRoutes');
const dashboardRoutes = require('./Routes/dashboardRoutes');
const authRoutes = require('./Routes/authRoutes');
const authApiRoutes = require('./Routes/authApiRoutes');
const advisorRoutes = require('./Routes/advisorRoutes');
const adminRoutes = require('./Routes/adminRoutes');
const initializeGEE = require('./services/geeAuth');
const { configureWebPush } = require('./services/pushService');
const { startStressWorker } = require('./services/stressWorker');

const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.FRONTEND_URL || true;

const io = socketIo(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

configurePassport();

// Attach io to request for use in controllers
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(passport.initialize());

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('Nouveau client connecté:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} a rejoint la salle ${room}`);
  });

  socket.on('call-user', (data) => {
    socket.to(data.userToCall).emit('call-made', {
      offer: data.offer,
      socket: socket.id
    });
  });

  socket.on('make-answer', (data) => {
    socket.to(data.to).emit('answer-made', {
      socket: socket.id,
      answer: data.answer
    });
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
  });
});

initializeGEE();
configureWebPush();

// OAuth : même routeur sous /auth et /api/auth pour coller à l’URI enregistrée dans Google Cloud
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth', authApiRoutes);

app.use('/api/parcelles', authJwt, parcelleRoutes);
app.use('/api/alertes', authJwt, alertRoutes);
app.use('/api/push', authJwt, pushRoutes);
app.use('/api/dashboard', authJwt, dashboardRoutes);
app.use('/api/auth/conseils', advisorRoutes);
app.use('/api/admin', authJwt, adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Serveur backend opérationnel',
    database: mongoose.connection.readyState === 1 ? 'connectée' : 'déconnectée',
    timestamp: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT}`);
    });
    startStressWorker();
  } catch (error) {
    console.error('Erreur lors du démarrage:', error);
    process.exit(1);
  }
};

startServer();
