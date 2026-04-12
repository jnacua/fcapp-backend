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

// --- 4. EMAIL TRANSPORTER (TLS/PORT 587 VERSION) ---
// IMPORTANT: EMAIL_USER must be the account that created the EMAIL_PASS
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Required for Port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  },
  tls: {
    rejectUnauthorized: false // Helps bypass Render network restrictions
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

// Verify the connection on boot
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ NODEMAILER ERROR: Connection failed. Check if EMAIL_USER matches the App Password owner.");
    console.error(error);
  } else {
    console.log("✅ EMAIL SERVER READY: Transporter verified successfully.");
  }
});

app.use((req, res, next) => {
  req.transporter = transporter;
  next();
});

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});