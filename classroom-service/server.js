const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const classroomRoutes = require('./routes/classroomRoutes');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/classroom-service')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api/classrooms', classroomRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Classroom service running on port ${PORT}`));
