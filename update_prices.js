// *************************************
// DEVELOPMENT VERSION
// NOTE: we are coding this for now to
// call the deck-test
// *************************************
require("dotenv").config();
const utilities = require('./utilities.pricing');
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");

// ARRAY TO STORE MISSING LINKS
const MISSING_LINKS_LOG = [];

// Entry for updating a product on a single pricelist
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

// Run the udpater script
async function updateSinglePriceList(productId, newBasePrice, priceListID, markupDecimal, accessToken) {
  try {
    const { data: product } = await axios.get(utilities.LL_BASEURL + "products/"+ productId +"/",
      { headers: { Authorization: `Bearer ${accessToken}` } }
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
      const priceListName = Object.keys(utilities.LL_TEST_PRICE_LISTS).find(k => utilities.LL_TEST_PRICE_LISTS[k] === priceListID) || `ID ${priceListID}`;
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
          unit_price: parseFloat(newBasePrice).toFixed(2),
          package_price: parseFloat(newBasePrice).toFixed(2),
          package_unit_price: parseFloat(newBasePrice).toFixed(2),
          inventory_per_unit: 1,
          price_list_entries: [priceListEntry]
        }
      ]
    };

    await axios.patch( utilities.LL_BASEURL + "products/"+ productId +"/?expand=vendor",
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Referer: utilities.LL_TEST_COMPANY_BASEURL, 
          Origin: utilities.LL_TEST_COMPANY_BASEURL
        }
      }
    );

    console.log(`✅ Updated ${product.name} (${productId}) on price list ${priceListID} to $${newBasePrice} with ${(markupDecimal * 100).toFixed(2)}% markup`);

  } catch (err) {
    //console.error(`❌ Update failed for product ${productId}, price list ${priceListID}:`, err.response?.data || err.message);
    console.error(`❌ Update failed for product ${product.name} (${productId}) on price list ${priceListID}`);
  }
}

// Log missing links
function writeMissingLinksLog() {
  if (!Array.isArray(MISSING_LINKS_LOG) || MISSING_LINKS_LOG.length === 0) {
    console.log("✅ No missing links to log.");
    return;
  }

  const csvPath = path.join(__dirname, 'data/missing_price_list_links.csv');

  const fields = ["timestamp", "product_id", "product_name", "missing_price_list"];
  const parser = new Parser({ fields, header: !fs.existsSync(csvPath) });
  const csv = parser.parse(MISSING_LINKS_LOG);

  fs.appendFileSync(csvPath, csv);
  console.log(`📄 Missing links written to: ${csvPath}`);
}


async function updateLLPrices(productID, price, accessToken) {
  for (const listName in utilities.LL_TEST_PRICE_LISTS) {
    const { id, markup } = utilities.LL_TEST_PRICE_LISTS[listName];
    await updateSinglePriceList(productID, price, id, markup, accessToken);
  }
}

// Query and update prices using async/await
async function queryAndUpdatePrices(accessToken) {
    try {
        const [rows] = await utilities.db.query(` SELECT * FROM pricelist WHERE localLineConnectedVendorProductID IS NOT NULL and category = 'Roasters & Turkeys' LIMIT 5`);

        console.log(`🔎 Found ${rows.length} products to update.`);

        for (const row of rows) {

            const prices = utilities.calculateFfcsaPrices(row);

            try {
                await updateLLPrices(prices.productID, prices.purchasePrice, accessToken);
            } catch (e) {
                console.error(`❌ Failed to update product ${prices.productID}:`);
            }
        }
    } catch (err) {
        console.error("❌ Database query failed:", err);
        throw err;
    }
}

// MAIN EXECUTION
(async () => {
    try {
        // Fetch access token at beginning of execution
        const accessToken = await utilities.getAccessToken(process.env.TEST_LL_USERNAME, process.env.TEST_LL_PASSWORD);

        // Run query + loop updates
        await queryAndUpdatePrices(accessToken);

        // Final cleanup
        writeMissingLinksLog();

        console.log("✅ All tasks completed.");
    } catch (err) {
        console.error("🚨 Error during execution:", err);
    } finally {
        // Gracefully end pool connections
        await utilities.db.end();
        process.exit(0);
    }
})();
