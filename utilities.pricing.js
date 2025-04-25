// utilities.pricing.js
const axios = require('axios');
var request = require('request');
const nodemailer = require("nodemailer");
const mysql = require("mysql2/promise");

// Validate and parse environment variables
const MEMBER_MARKUP = parseFloat(process.env.MEMBER_MARKUP);
const GUEST_MARKUP = parseFloat(process.env.GUEST_MARKUP);
const DISCOUNT = parseFloat(process.env.DISCOUNT);
const LL_BASEURL = "https://localline.ca/api/backoffice/v2/"
const LL_TEST_COMPANY_BASEURL = "https://deck-test.localline.ca";

const LL_TEST_PRICE_LISTS = {
  test1: { id: 5332, markup: MEMBER_MARKUP },
  test2: { id: 5333, markup: MEMBER_MARKUP },
  guest: { id: 4757, markup: GUEST_MARKUP }
};

// Validation
if (isNaN(MEMBER_MARKUP) || isNaN(GUEST_MARKUP) || isNaN(DISCOUNT)) {
    throw new Error('One or more FFCSA pricing environment variables are missing or invalid. Please check your .env file.');
}

function calculateFfcsaPrices(row) {
    let ffcsaPurchasePrice = 0;

    if (row.dff_unit_of_measure === 'lbs') {
        const avgWeight = (Number(row.highest_weight) + Number(row.lowest_weight)) / 2;
        ffcsaPurchasePrice = avgWeight * row.retailSalesPrice * DISCOUNT;
    } else if (row.dff_unit_of_measure === 'each') {
        ffcsaPurchasePrice = row.retailSalesPrice * DISCOUNT;
    } else {
        throw new Error(`Unknown unit of measure: ${row.dff_unit_of_measure}`);
    }

    // Round to 2 decimal places and convert back to Number
    // TODO: for now we're returning the ConnectedVendorProductID for TESTING Only. We will switch this when we go into production
    return {
        purchasePrice: Number(ffcsaPurchasePrice.toFixed(2)),
        memberSalesPrice: Number((ffcsaPurchasePrice * (1 + MEMBER_MARKUP)).toFixed(2)),
        guestSalesPrice: Number((ffcsaPurchasePrice * (1 + GUEST_MARKUP)).toFixed(2)),
        productID: Number(row.localLineConnectedVendorProductID)
    };
}

// get access token
async function getAccessToken(p_username, p_password) {
  const { data: auth } = await axios.post(LL_BASEURL + "token", {
    username: p_username,
    password: p_password
  });
  return auth.access;
}

// sendEmail passes in emailOptions as argument
async function sendEmail(emailOptions) {
    console.log('sendEmail function')
    // Create a Nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: "Gmail", // e.g., "Gmail" or use your SMTP settings
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_ACCESS,
        },
    });

    // Send the email with the attachment
    transporter.sendMail(emailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
        } else {
            console.log("Email sent:", info.response);
        }
    });
}

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

module.exports = {
    db,
    calculateFfcsaPrices,
    getAccessToken,
    sendEmail,
    GUEST_MARKUP,   
    MEMBER_MARKUP,
    DISCOUNT,
    LL_BASEURL,
    LL_TEST_PRICE_LISTS
};
