require('dotenv').config();
const pricingUtils = require('./utilities.pricing');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

async function exportPricelistToExcel() {
  const connection = await mysql.createConnection({
    host: process.env.DFF_DB_HOST,
    user: process.env.DFF_DB_USER,
    password: process.env.DFF_DB_PASSWORD,
    database: process.env.DFF_DB_DATABASE,
    port: process.env.DFF_DB_PORT
  });

  try {
    console.log('✅ Connected to database');

    // ✅ Get column names dynamically from `pricelist`
    const [columns] = await connection.execute("SHOW COLUMNS FROM pricelist");
    const originalColumnNames = columns.map(col => col.Field);
    const booleanColumns = columns
      .filter(col => col.Type.includes("tinyint(1)")) // Identify boolean columns
      .map(col => col.Field);

    // ✅ Define the custom order of columns
    const orderedColumnNames = [
      "id", "localLineProductID", "category", "productName", "packageName",
      "retailSalesPrice", 
      "lowest_weight", "highest_weight",
      "dff_unit_of_measure", 
      "ffcsaPurchasePrice", 
      "ffcsaMemberSalesPrice",
      "ffcsaGuestSalesPrice", 
      "ffcsaMemberMarkup", 
      "ffcsaGuestMarkup", 
      "num_of_items", "available_on_ll", "description",
      "track_inventory", "stock_inventory", "visible"
    ];
    //"localLineConnectedVendorProductID", "localLineConnectedVendorPackageID"

    // ✅ Add computed column names to the list
    const computedColumns = [
      'ffcsaPurchasePrice', 'ffcsaMemberMarkup', 'ffcsaMemberSalesPrice',
      'ffcsaGuestMarkup', 'ffcsaGuestSalesPrice'
    ];

    // Ensure all columns exist in the ordered list
    orderedColumnNames.push(...computedColumns.filter(col => !orderedColumnNames.includes(col)));

    // ✅ Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Pricelist');

    // ✅ Add column headers in the specified order
    worksheet.addRow(orderedColumnNames);

    // ✅ Query all data from `pricelist`
    const [rows] = await connection.execute('SELECT * FROM pricelist ORDER BY category, productName');

    // ✅ Insert data into the worksheet
    rows.forEach(row => {
      const prices = pricingUtils.calculateFfcsaPrices(row);

      // ✅ Prepare row data in the correct order
      const rowData = orderedColumnNames.map(column => {
        if (column === 'ffcsaPurchasePrice') return prices.purchasePrice;
        if (column === 'ffcsaMemberMarkup') return pricingUtils.MEMBER_MARKUP;
        if (column === 'ffcsaMemberSalesPrice') return prices.memberSalesPrice;
        if (column === 'ffcsaGuestMarkup') return pricingUtils.GUEST_MARKUP;
        if (column === 'ffcsaGuestSalesPrice') return prices.guestSalesPrice;
        if (column === 'retailSalesPrice') return Number(row[column]); // ✅ Ensure it's a number
        if (column === 'lowest_weight') return Number(row[column]); // ✅ Ensure it's a number
        if (column === 'highest_weight') return Number(row[column]); // ✅ Ensure it's a number
        if (booleanColumns.includes(column)) {
          return row[column] === 1 ? "True" : "False"; // ✅ Convert TINYINT(1) to True/False
        }
        return row[column] ?? ""; // ✅ Ensure missing values don’t break order
      });

      worksheet.addRow(rowData);
    });

    // ✅ Formatting columns correctly
    const formatColumns = {
      "retailSalesPrice": "$#,##0.00", // Currency format
      "lowest_weight": "0.00", // Number format
      "highest_weight": "0.00", // Number format
      "ffcsaPurchasePrice": "$#,##0.00", // Currency format
      "ffcsaMemberMarkup": "0%", // Percentage format
      "ffcsaMemberSalesPrice": "$#,##0.00", // Currency format
      "ffcsaGuestMarkup": "0%", // Percentage format
      "ffcsaGuestSalesPrice": "$#,##0.00", // Currency format
    };

    // ✅ Apply formatting after writing data
    orderedColumnNames.forEach((column, index) => {
      if (formatColumns[column]) {
        worksheet.getColumn(index + 1).numFmt = formatColumns[column];
      }
    });

    // ✅ Save the file
    const outputFile = '../docs/masterPriceList.xlsx';
    await workbook.xlsx.writeFile(outputFile);
    console.log(`✅ Excel file created: ${outputFile}`);
  } catch (error) {
    console.error('❌ Error exporting data:', error);
  } finally {
    await connection.end();
  }
}

exportPricelistToExcel();

