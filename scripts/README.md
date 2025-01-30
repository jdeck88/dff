Scripts:

server.js -- server script that gives us the ability to modify inventory items

exportPricelist.js -- create a spreadsheet 

product_download.js -- connects to Local Line and downloads "Local Line Product ID", "Package ID" and "internal ID". Populates a table called localline which we can map to these identifiers into the pricelist table

utilities.js -- utilities for connecting to database, etc.. copied from ffcsa_scripts/localline

createUser.js -- run one time to create a user and hash in database that has access
