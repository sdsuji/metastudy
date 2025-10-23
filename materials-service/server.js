require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const materialRoutes = require("./routes/materialRoutes");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connected"))
.catch((err) => console.error("MongoDB connection error:", err));

app.use("/api/materials", materialRoutes);

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Materials service running on ${PORT}`));
