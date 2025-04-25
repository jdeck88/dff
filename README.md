Deck Family Farm Database Files

This repo is the authority/point of record/ for all data regarding products, prices, and agreements and entities for DFF

The identifiers contained in the dff repo is called "id" and in Local Line "Internal ID".  This is how we track products between the two systems.

Local Line also contains the "Local Line Product ID" and "Package ID" to track all products and packages.


`dff.v1.inventory.js` -- Inventory management application
`export_master_pricelist.js`  -- Create spreadsheet
`update_prices.js`  -- Script to automatically update prices on the LL backend
`utilities.pricing.js`  -- Utilities script sets important variables and makes database connection
`template.env`  -- environment variables template
