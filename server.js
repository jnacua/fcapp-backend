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

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// ✅ MASTER LIST OF ALLOWED ORIGINS - UPDATED with your security web app
const allowedOrigins = [
    "https://fiesta-casitas-admin.vercel.app",
    "https://fiesta-casitas-security.vercel.app",
    "https://fc-security-web.vercel.app", // ✅ Your security web app URL
    "https://fc-security-web.vercel.app/", // ✅ With trailing slash
    "http://localhost:51310", 
    "http://localhost:3000",
    "http://localhost:8080", // Flutter web default
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
];

// --- 1. SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: { 
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps) 
            // or those in the allowedOrigins list or any localhost
            if (!origin || 
                allowedOrigins.indexOf(origin) !== -1 || 
                origin.startsWith('http://localhost') || 
                origin.startsWith('http://127.0.0.1') ||
                origin.startsWith('https://fc-security-web.vercel.app')) {
                callback(null, true);
            } else {
                console.log(`❌ CORS blocked: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST", "OPTIONS"], 
        credentials: true,
        allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"]
    },
    allowEIO3: true,
    transports: ['websocket', 'polling'], 
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    // Enable serving of client files
    serveClient: false,
    // Handle preflight requests
    handlePreflightRequest: true,
});

// Make io accessible to routes
app.set('socketio', io);

// Store connected sockets for broadcast
const connectedSockets = new Map();

io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);
    
    // Store socket with additional info
    connectedSockets.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        userAgent: socket.handshake.headers['user-agent']
    });
    
    // Join room based on user role (if provided)
    socket.on('join', (room) => {
        socket.join(room);
        console.log(`📌 Socket ${socket.id} joined room: ${room}`);
    });
    
    // Handle emergency alerts
    socket.on('emergency-alert', (data) => {
        console.log(`🚨 Emergency alert received from ${socket.id}:`, data);
        // Broadcast to all connected clients except sender
        socket.broadcast.emit('emergency-alert', data);
    });
    
    // Handle panic alerts
    socket.on('panic-alert', (data) => {
        console.log(`🆘 Panic alert received:`, data);
        // Broadcast to all connected clients
        io.emit('emergency-alert', data);
    });
    
    socket.on('disconnect', () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
        connectedSockets.delete(socket.id);
    });
    
    socket.on('error', (err) => {
        console.error(`⚠️ Socket error for ${socket.id}:`, err);
    });
});

// --- 2. CORS & MIDDLEWARE ---
app.use(cors({ 
    origin: function (origin, callback) {
        if (!origin || 
            allowedOrigins.indexOf(origin) !== -1 || 
            origin.startsWith('http://localhost') || 
            origin.startsWith('http://127.0.0.1') ||
            origin.startsWith('https://fc-security-web.vercel.app')) {
            callback(null, true);
        } else {
            console.log(`❌ CORS blocked request from: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' })); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Health check endpoint with socket status
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        socketConnections: connectedSockets.size,
        allowedOrigins: allowedOrigins,
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// ✅ Root route
app.get('/', (req, res) => {
    res.json({
        message: '🚀 FCAPP Backend is running and healthy!',
        socketStatus: {
            connections: connectedSockets.size,
            active: true
        },
        endpoints: {
            health: '/health',
            api: '/api/*'
        }
    });
});

// --- 3. DATABASE ---
mongoose.connect(process.env.MONGO_URI, { 
    family: 4,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// --- 4. API ROUTES ---
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

// ✅ 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Global error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ Allowed CORS origins:`);
    allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
    console.log(`📡 Socket.io ready for connections`);
});