// utilities.pricing.js

// Validate and parse environment variables
const MEMBER_MARKUP = parseFloat(process.env.MEMBER_MARKUP);
const GUEST_MARKUP = parseFloat(process.env.GUEST_MARKUP);
const DISCOUNT = parseFloat(process.env.DISCOUNT);

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
    // NOTE: for now we're returning the ConnectedVendorProductID for TESTING Only. We will switch this when we go into production
    return {
        purchasePrice: Number(ffcsaPurchasePrice.toFixed(2)),
        memberSalesPrice: Number((ffcsaPurchasePrice * (1 + MEMBER_MARKUP)).toFixed(2)),
        guestSalesPrice: Number((ffcsaPurchasePrice * (1 + GUEST_MARKUP)).toFixed(2)),
        productID: Number(row.localLineConnectedVendorProductID)
    };
}

module.exports = {
    calculateFfcsaPrices,
    GUEST_MARKUP,   
    MEMBER_MARKUP,
    DISCOUNT
};

