require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());

app.use(cors({
  origin: function (origin, callback) {
    callback(null, true); // ✅ Allows all origins dynamically (but still supports credentials)
  },
  credentials: true, // ✅ Needed if using authentication (cookies or Authorization headers)
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Content-Type,Authorization"
}));


// ✅ Database Connection
const db = mysql.createConnection({
  host: process.env.DFF_DB_HOST,
  port: process.env.DFF_DB_PORT,
  user: process.env.DFF_DB_USER,
  password: process.env.DFF_DB_PASSWORD,
  database: process.env.DFF_DB_DATABASE,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
  console.log("✅ Connected to database");
});

// ✅ User Registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "User registered successfully" });
    }
  );
});

// ✅ User Login (Returns JWT Token)
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err || results.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const validPassword = await bcrypt.compare(password, results[0].password);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // ✅ Generate JWT Token
    const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: "90d" });

    //console.log("✅ Generated Token:", token);

    res.json({ message: "Login successful", token });
  });
});

// ✅ Middleware: Authenticate Token from Header (No Cookies)
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(403).json({ error: "Unauthorized. Please log in." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token. Please log in again." });
    }

    req.user = user;
    next();
  });
}

// ✅ Protected Route: Fetch Inventory Data
app.get("/data", authenticateToken, (req, res) => {
  const sqlQuery = `
    SELECT id, category, productName, packageName, available_on_ll, visible, track_inventory, stock_inventory
    FROM pricelist order by category,productName`;

  db.query(sqlQuery, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

app.put("/update/:id", authenticateToken, (req, res) => {
  const { id } = req.params;
  const { available_on_ll, visible, track_inventory, stock_inventory } = req.body;

  const sqlQuery = `UPDATE pricelist SET visible=?, track_inventory=?, stock_inventory=? WHERE id=?`;
  
  db.query(sqlQuery, [visible, track_inventory, stock_inventory, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Updated successfully" });
  });
});


// ✅ Start Server
app.listen(3401, () => console.log("🚀 Server running on port 3401"));
