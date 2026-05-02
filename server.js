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
const logRoutes = require('./routes/logRoutes');
const blockLotRoutes = require('./routes/blockLotRoute');

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// ✅ ALLOWED ORIGINS
const allowedOrigins = [
    "https://fiesta-casitas-admin.vercel.app",
    "https://fiesta-casitas-security.vercel.app",
    "https://fc-security-web.vercel.app",
    "http://localhost:51310", 
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
];

// ✅ FIXED CORS MIDDLEWARE - Added PATCH method
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
            callback(null, true);
        } else {
            console.log(`❌ CORS blocked: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ✅ PATCH added
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ SOCKET.IO SETUP
const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
});

app.set('socketio', io);

const connectedSockets = new Map();

io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    connectedSockets.set(socket.id, { id: socket.id, connectedAt: new Date() });
    
    socket.on('emergency-alert', (data) => {
        console.log(`🚨 Emergency alert:`, data);
        io.emit('emergency-alert', data);
    });
    
    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
        connectedSockets.delete(socket.id);
    });
});

// ✅ MIDDLEWARE
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ ROUTES
app.get('/health', (req, res) => {
    res.json({ status: 'ok', socketConnections: connectedSockets.size });
});

app.get('/', (req, res) => {
    res.json({ message: '🚀 FCAPP Backend is running!' });
});

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
app.use('/api/visitor', visitorRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/blocklots', blockLotRoutes);

// ✅ 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.originalUrl });
});

// ✅ Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ✅ DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI, { family: 4 })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err));

// ✅ START SERVER
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ CORS enabled for ${allowedOrigins.length} origins`);
    console.log(`✅ Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS`);
});