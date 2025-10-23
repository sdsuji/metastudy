const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const discussionRoutes = require('./routes/discussionRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/discussions', discussionRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected (discussion-service)'))
  .catch((err) => console.error('MongoDB error:', err));

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Discussion service running on port ${PORT}`));
