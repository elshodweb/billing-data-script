let billingScriptFunc = require("./billing-script.js");
let requestToGateWay = require("./requestFile.js");
async function main() {
  const res = await billingScriptFunc();
  if (res.status === "OK") {
    console.log("LOG: billingScriptFunc is completed successfully");

    let resBack = await requestToGateWay();
    if (resBack.status === "OK") {
      console.log("LOG: requestToGateWay is completed successfully");
    }
  }
}

module.exports = main;
