require('dotenv').config();
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
        const columnNames = columns.map(col => col.Field); // Extract column names
        const booleanColumns = columns
            .filter(col => col.Type.includes("tinyint(1)")) // Identify boolean columns
            .map(col => col.Field);

        // ✅ Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Pricelist');

        // ✅ Add column headers dynamically
        worksheet.addRow(columnNames);

        // ✅ Query all data from `pricelist`
        const [rows] = await connection.execute('SELECT * FROM pricelist');

        // ✅ Insert data into the worksheet
        rows.forEach(row => {
            const rowData = columnNames.map(column => {
                if (booleanColumns.includes(column)) {
                    return row[column] === 1 ? "True" : "False"; // ✅ Convert TINYINT(1) to True/False
                }
                return row[column]; // ✅ Keep other values as is
            });
            worksheet.addRow(rowData);
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
