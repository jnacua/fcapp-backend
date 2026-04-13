require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); 
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
const visitorRoutes = require('./routes/visitorRoute');
// ✅ 1. Import the New Log Route
const logRoutes = require('./routes/logRoutes');

const app = express();
const server = http.createServer(app);

// ✅ Fix for Render Proxy issues
app.set('trust proxy', 1);

// --- 1. SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    allowEIO3: true,
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
});

app.set('socketio', io);

io.on('connection', (socket) => {
    console.log(`✅ Admin Socket Connected: ${socket.id}`);
});

// --- 2. CORS & MIDDLEWARE ---
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- 3. DATABASE ---
mongoose.connect(process.env.MONGO_URI, { family: 4 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- 4. EMAIL SERVICE ---
console.log("🚀 Email service initialized via authController.");

app.get('/', (req, res) => res.send('Backend is running with Socket.io'));

// --- 5. API ROUTES ---
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
app.use('/api/visitor', visitorRoutes);
// ✅ 2. Mount the Log Route
app.use('/api/logs', logRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});