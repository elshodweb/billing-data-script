function excelDateToDateTime(excelDate) {
  // If the input value is already an ISO format string
  if (typeof excelDate === "string") {
    const parsedDate = new Date(excelDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    } else {
      console.error("Invalid string date value:", excelDate);
      throw new RangeError("Invalid string date value");
    }
  }

  // If the input value is an Excel number
  if (typeof excelDate === "number" && !isNaN(excelDate)) {
    // Base date for Excel in Windows: January 1, 1900
    const excelEpoch = new Date(Date.UTC(1900, 0, 1));

    // Excel adds an extra day (accounts for the 1900 leap year bug)
    const correctedDays = excelDate - 1;

    // Integer part is days, fractional part is time
    const milliseconds = correctedDays * 24 * 60 * 60 * 1000;

    // Create a Date object
    const jsDate = new Date(excelEpoch.getTime() + milliseconds);

    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString();
    }
  }

  console.error("Invalid Excel date value:", excelDate);
  throw new RangeError("Invalid Excel date value");
}

module.exports = { excelDateToDateTime };
