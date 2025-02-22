const fs = require("fs");
const dotenv = require("dotenv");
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet"); // ✅ Security headers
const path = require("path");
const axios = require("axios");
const utilities = require('./utilities');
const rateLimit = require("express-rate-limit");
const fastCsv = require("fast-csv");

const limiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests, please try again later."
});


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
// ✅ Enable trusting reverse proxies (e.g., Nginx, Cloudflare)
app.set("trust proxy", 1);
app.use(express.json());
app.use(helmet()); // ✅ Adds security headers to protect against various attacks
app.use(limiter); // Apply rate limiting globally

const allowedOrigins = [
    "http://127.0.0.1:5500",
    "http://localhost:3000",
    "https://jdeck88.github.io"
];

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

// ✅ Enhanced CORS Handling
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) {
            console.warn(`🚨 No origin: ${origin}`);
            return callback(new Error("Bad Request: No origin"), false);
        }
        if (!allowedOrigins.includes(origin)) {
            console.warn(`🚨 Not in approved list of origins: ${origin}`);
            return callback(new Error("Not an approved origin"), false);
        }

        try {
            new URL(origin);
        } catch (error) {
            console.warn(`🚨 Malformed Origin: ${origin}`);
            return callback(new Error("Malformed Origin"), false);
        }

        return callback(null, true);
    },
    credentials: true,
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization"
}));

// ✅ Handle Preflight (OPTIONS) Requests
app.options("*", cors());


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
const db = mysql.createPool({
    host: process.env.DFF_DB_HOST,
    port: process.env.DFF_DB_PORT,
    user: process.env.DFF_DB_USER,
    password: process.env.DFF_DB_PASSWORD,
    database: process.env.DFF_DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10, // Adjust as needed
    queueLimit: 0
});

setInterval(() => {
    db.query('SELECT 1', (err) => {
        if (err) console.error("❌ Connection issue:", err);
    });
}, 30000); // Runs every 30s to keep the connection alive

db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection error:", err);
    } else {
        console.log("✅ Connected to database");
        connection.release();
    }
});

db.on('error', (err) => {
    console.error("🚨 MySQL Error:", err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log("🔄 Reconnecting...");
        db.getConnection((err, connection) => {
            if (err) {
                console.error("❌ Reconnection failed:", err);
            } else {
                console.log("✅ Reconnected!");
                connection.release();
            }
        });
    }
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
  /*
  db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: "User not found" });

        const validPassword = await bcrypt.compare(password, results[0].password);
        if (!validPassword) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: "90d" });

        res.json({ message: "Login successful", token });
    });
  */
db.query("SELECT * FROM users WHERE username = ?", [username], async (err, results) => {
    if (err) {
        console.error("Database error:", err); // Log the full error internally
        return res.status(500).json({ error: "Database error", details: err.message }); // Send a safe error message to the client
    }

    if (results.length === 0) {
        return res.status(404).json({ error: "User does not exist" });
    }

    try {
        const validPassword = await bcrypt.compare(password, results[0].password);
        if (!validPassword) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const token = jwt.sign({ userId: results[0].id }, process.env.JWT_SECRET, { expiresIn: "90d" });

        res.json({ message: "Login successful", token });
    } catch (bcryptError) {
        console.error("Password comparison error:", bcryptError);
        return res.status(500).json({ error: "Internal server error" });
    }
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
        SELECT id, category, productName, packageName, localLineProductID, visible, track_inventory, stock_inventory
        FROM pricelist ORDER BY category, productName WHERE available_on_ll is true`;

    db.query(sqlQuery, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});


// ✅ Secure Data Update Route (Protected)
app.put("/dff/v1/update/:id", authenticateToken, async (req, res) => {
    try {
        // Retrieve Access Token
        const tokenData = await utilities.getAccessToken();
        const accessToken = JSON.parse(tokenData).access;
        const LOCALLINE_API_URL = "https://localline.ca/api/backoffice/v2/products/";

        const { id } = req.params;
        const { visible, track_inventory, stock_inventory, productName, description } = req.body;
        const timestamp = new Date().toISOString();

        // Query product details
        db.query("SELECT productName as origProductName, origPackageName, localLineProductID FROM pricelist WHERE id = ?", [id], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            if (results.length === 0) return res.status(404).json({ error: "Product not found" });

            const { origProductName, origPackageName, localLineProductID } = results[0];

            // ✅ Structured response object
            let updateStatus = {
                id,
                origProductName,
                databaseUpdate: false,
                localLineUpdate: false,
            };

            // ✅ Perform the database update
            db.query(
                "UPDATE pricelist SET visible=?, track_inventory=?, stock_inventory=?, productName=?, description=?  WHERE id=?",
                [visible, track_inventory, stock_inventory, productName, description, id],
                async (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    updateStatus.databaseUpdate = true; // ✅ Mark DB update as successful

                    // ✅ Append change to CSV file
                    const logFilePath = path.join(__dirname, "../docs/inventory_updates_log.csv");

                    // Ensure file exists with headers
                    if (!fs.existsSync(logFilePath)) {
                        fs.writeFileSync(
                            logFilePath,
                            "id,productName,packageName,visible,track_inventory,stock_inventory,timestamp\n",
                            "utf8"
                        );
                    }

                    // ✅ Prepare log entry
                    const logEntry = [
                        id,
                        origProductName,
                        origPackageName,
                        visible,
                        track_inventory,
                        stock_inventory,
                        timestamp,
                    ];

                    // ✅ Open the writable stream in append mode
                    const writableStream = fs.createWriteStream(logFilePath, { flags: "a", encoding: "utf8" });

                    // ✅ Append row manually with a newline
                    fastCsv
                        .writeToStream(writableStream, [logEntry], { headers: false, quote: true })
                        .on("finish", () => {
                            fs.appendFileSync(logFilePath, "\n"); // ✅ Manually force a new line
                            console.log("✅ Data appended to CSV successfully.");
                        })
                        .on("error", (err) => console.error("❌ Error writing to CSV file:", err));

                    // ✅ Attempt LocalLine API update
                    if (localLineProductID) {
                        try {
                            let payload = {
                                visible: visible, // Keeps `0` values
                                track_inventory: track_inventory // Keeps `0` values
                            };

                            if (description !== undefined) {
                                payload.description = description
                            }

                            if (productName !== undefined) {
                                payload.name = productName
                            }
                          
                            // Ensure `set_inventory` is included even if `stock_inventory` is 0
                            if (track_inventory === true || stock_inventory === 0) {
                                payload.set_inventory = Number(stock_inventory);
                            }

                            if (Object.keys(payload).length > 0) {
                                await axios.patch(`${LOCALLINE_API_URL}${localLineProductID}/`, payload, {
                                    headers: {
                                        "Authorization": `Bearer ${accessToken}`,
                                        "Content-Type": "application/json"
                                    }
                                });

                                console.log(`✅ LocalLine product ${localLineProductID} updated:`, payload);
                                updateStatus.localLineUpdate = true;
                            }
                        } catch (error) {
                            utilities.sendEmail({
                                from: "jdeck88@gmail.com",
                                to: "jdeck88@gmail.com",
                                subject: "LocalLine API update failed",
                                text: `API update failed for ${localLineProductID}`
                            });

                            console.error(`❌ LocalLine API update failed for ${localLineProductID}:`, error.response?.data || error.message);
                            updateStatus.localLineUpdate = false;
                        }
                    } else {
                        utilities.sendEmail({
                            from: "jdeck88@gmail.com",
                            to: "jdeck88@gmail.com",
                            subject: "LocalLine API update failed",
                            text: `We do not have a record of this product in LocalLine: ${localLineProductID}`
                        });

                        console.error(`❌ No record found in LocalLine for ${localLineProductID}`);
                        updateStatus.localLineUpdate = false;
                    }

                    res.json(updateStatus);
                }
            );
        });
    } catch (error) {
        console.error("❌ Error in update route:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});





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

