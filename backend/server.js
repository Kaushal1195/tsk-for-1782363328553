require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const paymentMethodRoutes = require('./src/routes/paymentMethodRoutes');
const merchantRoutes = require('./src/routes/merchantRoutes');
const tagRoutes = require('./src/routes/tagRoutes');
const expenseRoutes = require('./src/routes/expenseRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const { connectDB } = require('./src/db'); // Import connectDB to ensure connection

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Database Connection Test (optional, but good for startup)
connectDB()
  .then(() => console.log('Database connected successfully.'))
  .catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1); // Exit if DB connection fails
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.send('Expense Tracker Backend is running!');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
