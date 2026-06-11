

const Coupon = require("../models/Coupon");

const validateCoupon = async (couponCode, amount) => {

     console.log("=== validateCoupon called ===");
  console.log("couponCode:", couponCode);
  console.log("amount:", amount);
    
  if (!couponCode) {
    return {
      valid: false,
      message: "Coupon code required"
    };
  }

  const coupon = await Coupon.findOne({
    code: couponCode.toUpperCase()
  });

   console.log("coupon found:", coupon);

  if (!coupon)
    return { valid: false, message: "Invalid coupon" };

  if (!coupon.is_active)
    return { valid: false, message: "Coupon inactive" };

  const now = new Date();

  if (
    coupon.valid_from &&
    now < coupon.valid_from
  ) {
    return {
      valid: false,
      message: "Coupon not started"
    };
  }

  if (
    coupon.valid_till &&
    now > coupon.valid_till
  ) {
    return {
      valid: false,
      message: "Coupon expired"
    };
  }

  if (
    coupon.max_usage &&
    coupon.used_count >= coupon.max_usage
  ) {
    return {
      valid: false,
      message: "Coupon exhausted"
    };
  }

  let discount = 0;

  if (coupon.discount_type === "PERCENTAGE") {
    discount = amount * coupon.discount_value / 100;
  } else {
    discount = coupon.discount_value;
  }

  discount = Math.min(discount, amount);

  return {
    valid: true,
    coupon,
    discount,
    finalAmount: amount - discount,
  };
};

module.exports = {
  validateCoupon,
};