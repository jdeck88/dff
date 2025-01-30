require("dotenv").config();
const express = require("express");
const mysql = require("mysql2"); // <-- Change from 'mysql' to 'mysql2'
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Database connection using .env variables
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
  console.log("Connected to database");
});

// Rest of your code remains the same...

// User registration
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.query(
    "INSERT INTO users (username, password) VALUES (?, ?)",
    [username, hashedPassword],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ message: "User registered successfully" });
    }
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log("Login Attempt:", username); // Debugging

  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err || results.length === 0) {
      console.error("User not found:", err || username);
      return res.status(400).json({ error: "User not found" });
    }

    console.log("DB User Found:", results[0]); // Debugging

    const validPassword = await bcrypt.compare(password, results[0].password);
    if (!validPassword) {
      console.error("Invalid password for user:", username);
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  });
});

// Get tabular data (protected)
app.get("/data", authenticateToken, (req, res) => {
  const sqlQuery = `
    SELECT productName, packageName, available_on_ll, visible, track_inventory, stock_inventory 
    FROM pricelist`;

  db.query(sqlQuery, (err, results) => {
    if (err) {
      console.error("Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.sendStatus(403);

  jwt.verify(token.split(" ")[1], process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.listen(3000, () => console.log("Server running on port 3000"));

