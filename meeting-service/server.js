const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const meetingRoutes = require('./routes/meetingRoutes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/meetings', meetingRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected (meeting-service)'))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`Meeting service running on port ${PORT}`));
