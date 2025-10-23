require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const assignmentRoutes = require("./routes/assignmentRoutes");
const submissionRoutes = require("./routes/submissionRoutes");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => console.log(`Assignments service running on ${PORT}`));
