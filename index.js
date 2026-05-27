const express = require("express");
const db = require("./models");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const authRoute = require("./src/routes/auth");
const customerRoute = require("./src/routes/customer");
const userRoute = require("./src/routes/user");
const productRoute = require("./src/routes/product");
const orderRoute = require("./src/routes/order");
const categoryRoute = require("./src/routes/category");
const paymentRoute = require("./src/routes/payment");
const dashboardRoute = require("./src/routes/dashboard");;
const fileUpload = require("express-fileupload");
const { authMiddleware, requireRole } = require("./src/middlewares/authMiddleware");

const app = express();
const port = 3000;

const allowedOrigins = [
  "http://localhost:3000",
  "https://www.abc.com",
  "http://localhost:5173",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },

  methods: "GET,POST,PUT,DELETE,PATCH",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(
  fileUpload({
    limits: { fileSize: 30 * 1024 * 1024 },
    createParentPath: true,
  })

);
app.use(
  "/uploads/products",
  express.static(path.join(process.cwd(), "uploads/products"))
);

db.sequelize
  .authenticate()
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.log("Unable connect to database", err));

// ─── Routes ───────────────────────────────────────────────
app.use("/api/v1/auth", authRoute); 
app.use("/api/v1/payments", authMiddleware , requireRole("admin", "cashier"), paymentRoute);
app.use("/api/v1/users",     authMiddleware, requireRole("admin"), userRoute);
app.use("/api/v1/dashboard", authMiddleware, requireRole("admin"), dashboardRoute);

//  Admin + Cashier
app.use("/api/v1/orders",    authMiddleware, orderRoute);
app.use("/api/v1/products",   authMiddleware, productRoute);   
app.use("/api/v1/categories", authMiddleware, categoryRoute);



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});