const main = require("./mainFunc");

async function func() {
  await main().catch((err) => {
    if (err) {
      console.log(err);
    } else {
      console.log("Process completed successfully");
    }
  });
}
func();
