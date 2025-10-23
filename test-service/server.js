require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const testRoutes = require("./routes/testRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Test-Service MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/tests", testRoutes);
app.use("/api/submissions", submissionRoutes);

const PORT = process.env.PORT || 5012;
app.listen(PORT, () => console.log(`🚀 Test service running on ${PORT}`));