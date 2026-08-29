/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: "widget",
  name: "CouponWidget",
  displayName: "קופון מאסטר",
  icon: "../../assets/icon.png",
  deploymentTarget: "16.0",
  entitlements: {
    "com.apple.security.application-groups": ["group.com.itaykarkason.couponmaster"],
  },
};
