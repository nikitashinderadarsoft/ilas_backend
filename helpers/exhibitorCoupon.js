const ExhibitorCoupon = require("../models/ExhibitorCoupon");

function generateCouponCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 10; i++) {
    code += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return code;
}

const generateCoupons = async (
  exhibitorId,
  count
) => {
  const coupons = [];

  for (let i = 0; i < count; i++) {
    coupons.push({
      exhibitor_id: exhibitorId,
      coupon_code: generateCouponCode(),
    });
  }

  await ExhibitorCoupon.insertMany(coupons);
};

module.exports = {
  generateCoupons,
};