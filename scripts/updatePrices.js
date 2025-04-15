const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
require("dotenv").config();

const PRICE_LIST_IDS = {
    test1: 5332, // replace with actual ID
    test2: 5333,
    guest: 4757
};

const MISSING_LINKS_LOG = [];

function generatePriceListEntries(basePrice, priceListEntryMap) {
    function withMarkup(markupPercent, priceListName) {
        const entry = priceListEntryMap[priceListName];
        if (!entry) return null;

        const calculated = parseFloat((basePrice * (1 + markupPercent / 100)).toFixed(2));

        return {
            adjustment: true,
            adjustment_type: 2,
            adjustment_value: markupPercent,
            price_list: PRICE_LIST_IDS[priceListName],
            checked: true,
            notSubmitted: false,
            edited: false,
            dirty: true,
            product_price_list_entry: entry.id,
            calculated_value: calculated,
            on_sale: false,
            on_sale_toggle: false,
            max_units_per_order: null,
            strikethrough_display_value: null
        };
    }

    return [
        withMarkup(38, "test1"),
        withMarkup(38, "test2"),
        withMarkup(55, "guest")
    ].filter(Boolean);
}

async function updateProductWithPriceLists(productId, newBasePrice) {
    try {
        const { data: auth } = await axios.post("https://localline.ca/api/backoffice/v2/token", {
            username: process.env.TEST_USERNAME,
            password: process.env.TEST_PASSWORD
        });

        const accessToken = auth.access;

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

        const entryMap = {};
        for (const entry of product.product_price_list_entries || []) {
            const name = entry.price_list_name?.toLowerCase();
            if (name === "test1") entryMap.test1 = entry;
            if (name === "test2") entryMap.test2 = entry;
            if (name === "guest") entryMap.guest = entry;
        }

        ["test1", "test2", "guest"].forEach(listName => {
            if (!entryMap[listName]) {
                console.warn(`⚠️ Product ${product.name} is not in price list \"${listName}\".`);
                MISSING_LINKS_LOG.push({
                    product_id: product.id,
                    product_name: product.name,
                    missing_price_list: listName
                });
            }
        });

        const priceListEntries = generatePriceListEntries(newBasePrice, entryMap);

        if (priceListEntries.length === 0) {
            console.warn(`⏭️ Skipping product ${product.name} - no valid price list entries.`);
            return;
        }

        const payload = {
            packages: [
                {
                    id: packageId,
                    name: firstPackage.name,
                    unit_price: newBasePrice.toFixed(2),
                    package_price: newBasePrice.toFixed(2),
                    package_unit_price: newBasePrice.toFixed(2),
                    inventory_per_unit: 1,
                    price_list_entries: priceListEntries
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
                    Referer: "https://deck-test.localline.ca",
                    Origin: "https://deck-test.localline.ca"
                }
            }
        );

        console.log(`✅ Updated ${product.name} (${productId}) to $${newBasePrice}`);

    } catch (err) {
        console.error("❌ Update failed:", err.response?.data || err.message);
    }
}

async function run() {
    await updateProductWithPriceLists(935696, 10); // Add more calls if needed

    if (MISSING_LINKS_LOG.length > 0) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const csvPath = path.join(__dirname, `missing_price_list_links_${timestamp}.csv`);
        const csv = new Parser({ fields: ["product_id", "product_name", "missing_price_list"] }).parse(MISSING_LINKS_LOG);
        fs.writeFileSync(csvPath, csv);
        console.log(`📄 Missing links written to: ${csvPath}`);
    }
}

run();

