function scheduleMidnightJob(func) {
  const now = new Date();
  const next = new Date();
  next.setHours(13, 18, 0, 0); // next midnight
  const delay = next - now;
  console.log(next,"next::");
  console.log(now,"now::");
  console.log(delay,"delay::");
  
  setTimeout(async function run() {
    await func().catch((err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Process completed successfully");
      }
    });
    scheduleMidnightJob(); // reschedule for next day
  }, delay);
}
module.exports = scheduleMidnightJob;
