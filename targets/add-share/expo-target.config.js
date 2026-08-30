/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "action",
  name: "CouponAddShare",
  displayName: "הוספת קופון חדש",
  icon: "./assets/action-icon.png",
  deploymentTarget: "16.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.itaykarkason.couponmaster"],
  },
};
