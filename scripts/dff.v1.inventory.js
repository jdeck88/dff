const fs = require("fs");
const dotenv = require("dotenv");
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet"); // ✅ Security headers
const path = require("path");

// ✅ Load Environment Variables Safely
if (fs.existsSync("/home/exouser/code/dff/scripts/.env")) {
    console.log("Loading environment variables from .env for server");
    dotenv.config({ path: "/home/exouser/code/dff/scripts/.env" });
} else if (fs.existsSync("/Users/jdeck/code/dff/scripts/.env")) {
    console.log("Loading environment variables from .env for local");
    dotenv.config({ path: "/Users/jdeck/code/dff/scripts/.env" });
} else {
    console.warn("⚠️ No .env file found! Using default system environment variables.");
}

const app = express();
app.use(express.json());
app.use(helmet()); // ✅ Adds security headers to protect against various attacks

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "https://jdeck88.github.io"
];

// ✅ Enhanced CORS Handling
app.use(cors({
    origin: function (origin, callback) {
        console.log("CORS Request Origin:", origin);
        if (!origin) {
            console.warn(`🚨 No origin: ${origin}`);
            return res.status(400).json({ error: "Bad Request: No origin" });
            //return callback(null, false);
        } 
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 Not in approved list of origins: ${origin}`);
            return res.status(400).json({ error: "Not an approved origin" });
            //return callback(null, false);
        }
        
        try {
            new URL(origin); 
        } catch (error) {
            console.warn(`🚨 Malformed Origin: ${origin}`);
            return res.status(400).json({ error: "Malformed Origin" });
            //return callback(null, false);
        }

        return callback(null, true);
    },
    credentials: true,
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization"
}));

// ✅ Handle Preflight (OPTIONS) Requests
app.options("*", cors());

// ✅ Strict Request Filtering - Only allow known API paths
const validRoutes = [
    "/dff/v1/register",
    "/dff/v1/login",
    "/dff/v1/data",
    "/dff/v1/update"
];

app.use((req, res, next) => {
    if (!validRoutes.some(route => req.path.startsWith(route))) {
        console.warn(`🚨 Blocked Unknown Request: ${req.method} ${req.path}`);
        return res.status(400).json({ error: "Bad Request: Unknown API Endpoint" });
    }
    next();
});

// ✅ Malformed URL Handling - Prevents crashes
app.use((req, res, next) => {
    try {
        decodeURIComponent(req.path);
        next();
    } catch (error) {
        console.error("🚨 Invalid URL Encoding:", req.path);
        return res.status(400).send("Bad Request: Invalid URL Encoding");
    }
});

// ✅ Request Logging for Debugging
app.use((req, res, next) => {
    //console.log(`📌 ${req.method} ${req.originalUrl}`);
    next();
});

// ✅ Secure Database Connection
const db = mysql.createConnection({
    host: process.env.DFF_DB_HOST,
    port: process.env.DFF_DB_PORT,
    user: process.env.DFF_DB_USER,
    password: process.env.DFF_DB_PASSWORD,
    database: process.env.DFF_DB_DATABASE,
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database connection error:", err);
        process.exit(1);
    }
    console.log("✅ Connected to database");
});

// ✅ User Registration
app.post("/dff/v1/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO users (username, password) VALUES (?, ?)",
            [username, hashedPassword],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: "User registered successfully" });
            }
        );
    } catch (error) {
        console.error("Registration Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ✅ User Login with JWT
app.post("/dff/v1/login", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: "User not found" });

        const validPassword = await bcrypt.compare(password, results[0].password);
        if (!validPassword) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: "90d" });

        res.json({ message: "Login successful", token });
    });
});

// ✅ Middleware: Authenticate JWT Token
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.status(403).json({ error: "Unauthorized. Please log in." });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token. Please log in again." });

        req.user = user;
        next();
    });
}

// ✅ Secure Inventory Data Route (Protected)
app.get("/dff/v1/data", authenticateToken, (req, res) => {
    const sqlQuery = `
        SELECT id, category, productName, packageName, available_on_ll, visible, track_inventory, stock_inventory
        FROM pricelist ORDER BY category, productName`;

    db.query(sqlQuery, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// ✅ Secure Data Update Route (Protected)
app.put("/dff/v1/update/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const { visible, track_inventory, stock_inventory } = req.body;
    const timestamp = new Date().toISOString();

    // Fetch productName and packageName before updating
    db.query("SELECT productName, packageName FROM pricelist WHERE id = ?", [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: "Product not found" });

        const { productName, packageName } = results[0];

        // Perform the update
        db.query(
            "UPDATE pricelist SET visible=?, track_inventory=?, stock_inventory=? WHERE id=?",
            [visible, track_inventory, stock_inventory, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Append change to CSV file
                const logFilePath = path.join(__dirname, "data/inventory_updates_log.csv");
                const logEntry = `${id},${productName},${packageName},${visible},${track_inventory},${stock_inventory},${timestamp}\n`;

                // Ensure CSV file has headers if it doesn't exist
                if (!fs.existsSync(logFilePath)) {
                    fs.writeFileSync(logFilePath, "id,productName,packageName,visible,track_inventory,stock_inventory,timestamp\n");
                }

                // Append data to the CSV file
                fs.appendFileSync(logFilePath, logEntry, "utf8");

                res.json({ message: "Updated successfully" });
            }
        );

// ✅ Global Error Handler
app.use((err, req, res, next) => {
    if (err instanceof URIError) {
        console.error("🚨 Malformed URI Error:", err);
        return res.status(400).json({ error: "Bad Request: Invalid URL Encoding" });
    }
    console.error("🔥 Unexpected Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
});

// ✅ Start Secure Server
const PORT = 3401;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

