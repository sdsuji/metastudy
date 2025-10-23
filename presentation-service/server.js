require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');

const presentationRoutes = require('./routes/presentationRoutes');
const submissionRoutes = require('./routes/submissionRoutes');

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

// Root endpoint
app.get('/', (req, res) => res.json({ msg: 'Presentation service up' }));

// Routes
app.use('/api/presentations', presentationRoutes);
app.use('/api/submissions', submissionRoutes);

// Handle 404
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 5011;
app.listen(PORT, () => console.log(`Presentation service running on ${PORT}`));
