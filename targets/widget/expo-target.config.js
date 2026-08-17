/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "CouponWidget",
  icon: "../../assets/icon.png",
  deploymentTarget: "16.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.itaykarkason.couponmaster"],
  },
};
