const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
require("dotenv").config();

// Create the entry for updating a product on a single pricelist
function generateSinglePriceListEntry(basePrice, priceListEntry, markupDecimal) {
  if (!priceListEntry) return null;

  const calculated = parseFloat((basePrice * (1 + markupDecimal)).toFixed(2));
  return {
    adjustment: true,
    adjustment_type: 2,
    adjustment_value: Number((markupDecimal * 100).toFixed(2)),
    price_list: priceListEntry.price_list,
    checked: true,
    notSubmitted: false,
    edited: false,
    dirty: true,
    product_price_list_entry: priceListEntry.id,
    calculated_value: calculated,
    on_sale: false,
    on_sale_toggle: false,
    max_units_per_order: null,
    strikethrough_display_value: null
  };
}

// Get access token
async function getAccessToken() {
  const { data: auth } = await axios.post("https://localline.ca/api/backoffice/v2/token", {
    username: process.env.TEST_USERNAME,
    password: process.env.TEST_PASSWORD
  });
  return auth.access;
}

// Run the udpater script
async function updateSinglePriceList(productId, newBasePrice, priceListID, markupDecimal, accessToken) {
  try {
    const { data: product } = await axios.get(
      `https://localline.ca/api/backoffice/v2/products/${productId}/`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const firstPackage = product.packages?.[0];
    if (!firstPackage) {
      console.error("❌ No package found for product", productId);
      return;
    }

    const packageId = firstPackage.id;

    const entry = (product.product_price_list_entries || []).find(
      e => e.price_list === priceListID
    );

    if (!entry) {
      const priceListName = Object.keys(PRICE_LISTS).find(k => PRICE_LISTS[k] === priceListID) || `ID ${priceListID}`;
      console.warn(`⚠️ Product ${product.name} is not on price list "${priceListName}"`);

      const now = new Date();
      const timestamp = now.toLocaleString("en-US", {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).replace(",", "");

      const message = `product does not appear in pricelist ${priceListName} (${priceListID})`;

      MISSING_LINKS_LOG.push({
        timestamp: timestamp,
        product_id: product.id,
        product_name: product.name,
        missing_price_list: message
      });

      return;
    }

    const priceListEntry = generateSinglePriceListEntry(newBasePrice, entry, markupDecimal);
    if (!priceListEntry) return;

    const payload = {
      packages: [
        {
          id: packageId,
          name: firstPackage.name,
          unit_price: newBasePrice.toFixed(2),
          package_price: newBasePrice.toFixed(2),
          package_unit_price: newBasePrice.toFixed(2),
          inventory_per_unit: 1,
          price_list_entries: [priceListEntry]
        }
      ]
    };

    await axios.patch(
      `https://localline.ca/api/backoffice/v2/products/${productId}/?expand=vendor`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Referer: BASE_URL,
          Origin: BASE_URL
        }
      }
    );

    console.log(`✅ Updated ${product.name} (${productId}) on price list ${priceListID} to $${newBasePrice} with ${(markupDecimal * 100).toFixed(2)}% markup`);

  } catch (err) {
    console.error(`❌ Update failed for product ${productId}, price list ${priceListID}:`, err.response?.data || err.message);
  }
}

function writeMissingLinksLog() {
  if (!Array.isArray(MISSING_LINKS_LOG) || MISSING_LINKS_LOG.length === 0) {
    console.log("✅ No missing links to log.");
    return;
  }

  const csvPath = path.join(__dirname, 'missing_price_list_links.csv');

  const fields = ["timestamp", "product_id", "product_name", "missing_price_list"];
  const parser = new Parser({ fields, header: !fs.existsSync(csvPath) });
  const csv = parser.parse(MISSING_LINKS_LOG);

  fs.appendFileSync(csvPath, csv);
  console.log(`📄 Missing links written to: ${csvPath}`);
}

async function updateLLPrices(productID, price, accessToken) {
  for (const listName in PRICE_LISTS) {
    const { id, markup } = PRICE_LISTS[listName];
    await updateSinglePriceList(productID, price, id, markup, accessToken);
  }
}

// PRICE_LISTS AND ASSOCIATED MARKUPS
const PRICE_LISTS = {
  test1: { id: 5332, markup: 0.42 },
  test2: { id: 5333, markup: 0.42 },
  guest: { id: 4757, markup: 0.60 }
};

// BASE_URL
const BASE_URL = "https://deck-test.localline.ca";
// ARRAY TO STORE MISSING LINKS
const MISSING_LINKS_LOG = [];

// MAIN EXECUTION
(async () => {
  // fetch access token at beginning of execution
  const accessToken = await getAccessToken();

  // this part we want to loop
  await updateLLPrices(935696, 5.00, accessToken);

  // clean up by writing out all missing links
  writeMissingLinksLog();
})();
