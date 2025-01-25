const xlsx = require('xlsx');
const fs = require('fs');
const { google } = require('googleapis');

async function uploadToGoogleDrive(auth, fileName, filePath, folderId) {
  const drive = google.drive({ version: 'v3', auth });
  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId], // Add the folder ID here
    };

    const media = {
      mimeType: 'application/json',
      body: fs.createReadStream(filePath),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });

    console.log('File uploaded to Google Drive. File ID:', response.data.id);
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
  }
}

async function main() {
  try {
    // Step 1: Define the file path
    const filePath = '/Users/tristandixon/code/dff/inventory_report.xlsx';

    // Step 2: Load the workbook
    const workbook = xlsx.readFile(filePath);

    // Step 3: Check if the workbook has sheets
    if (workbook.SheetNames && workbook.SheetNames.length > 0) {
      // Get the first sheet's name
      const sheetName = workbook.SheetNames[0];
      console.log('Sheet Name:', sheetName);

      // Convert the sheet to JSON
      const sheetData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // Save the JSON data to a file
      const jsonFileName = 'inventory_report.json';
      fs.writeFileSync(jsonFileName, JSON.stringify(sheetData, null, 2));
      console.log('JSON data saved to', jsonFileName);

      // Step 4: Authenticate and upload to Google Drive
      const auth = new google.auth.GoogleAuth({
        keyFile: '/Users/tristandixon/code/dff/googleapiskey.json', // Replace with the path to your service account JSON file
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      // Replace <FOLDER_ID> with the actual ID of your shared folder
      const folderId = '1gBFXc_pgDxonlR28CFRA8aFStWtSXppK'; // e.g., "1aBcD2EfGh3IjK4LmNoP5QrStUvWxYz"
      await uploadToGoogleDrive(await auth.getClient(), jsonFileName, jsonFileName, folderId);
    } else {
      console.error('No sheets found in the workbook.');
    }
  } catch (error) {
    console.error('Error in workflow:', error);
  }
}

// Execute the main function
main();
