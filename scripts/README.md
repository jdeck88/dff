Scripts directory contains node scripts for working with the DFF database and LL and Square.

This directory requires installation of .env file defining variable values

`server.js` -- server script that we run on biscicol.org server using pm2 to control job. This is the API service for modifying the database for updating inventory items

`exportPricelistForLL.js` -- create a spreadsheet that i can use to import to LL.  This script reads the database and then creates a spreadsheet that we can bulk import to LL.  Doing this will update all inventory.  If there are any new products they will be inserted into LL.  Run the `populateIdentifiersFromLL.js` script after this script.

`exportPricelistForViewing.js` -- create a spreadsheet that we is written to the docs directory.  This spreadsheet is the viewable pricelist for all to see retail prices. Purpose is to run this once per week and we can make this available for people to download.

`populateIdentifiersFromLL.js` -- connects to Local Line and downloads the "Local Line Product ID", "Package ID" and "internal ID". Populates a table called localline in back-end database. This then uses the "internal ID" to update the localline product identifiers in the pricelist table. 

`utilities.js` -- utilities for connecting to database, etc.. copied from ffcsa_scripts/localline

`createUser.js` -- run to create a user and hash in database that has access
