require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); 
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');

// Route Imports
const authRoutes = require('./routes/authRoute');
const announcementRoutes = require('./routes/announcementRoute');
const auditRoutes = require('./routes/auditRoute'); 
const paymentRoutes = require('./routes/paymentRoute');
const incidentRoutes = require('./routes/incidentRoute');
const facilityRoutes = require('./routes/facilityRoute');
const forumRoutes = require('./routes/forumRoute');
const panicRoutes = require('./routes/panicRoute');
const vehicleRoutes = require('./routes/vehicleRoute');
const paymongoRoutes = require('./routes/paymongoRoutes');
const dashboardRoutes = require('./routes/dashboardRoute');

const app = express();
const server = http.createServer(app);

// --- 1. SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

app.set('socketio', io);

io.on('connection', (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);
    socket.on('disconnect', () => console.log('❌ User disconnected'));
});

// --- 2. ROBUST CORS CONFIGURATION ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200 
}));

// Middlewares and Routes exactly as you have them...
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});

app.use((req, res, next) => {
  req.transporter = transporter;
  next();
});

app.get('/', (req, res) => res.send('Backend is running with Socket.io'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/audit', auditRoutes); 
app.use('/api/payments', paymentRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/facilities', facilityRoutes); 
app.use('/api/forum', forumRoutes);
app.use('/api/panic', panicRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/paymongo', paymongoRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server + Real-time Socket running on port ${PORT}`);
});