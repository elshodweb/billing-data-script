function excelDateToDateTime(excelDate) {
  if (typeof excelDate === "string") {
    const parsedDate = new Date(excelDate);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    } else {
      console.error("Invalid string date value:", excelDate);
      throw new RangeError("Invalid string date value");
    }
  }

  if (typeof excelDate === "number" && !isNaN(excelDate)) {
    const excelEpoch = new Date(Date.UTC(1900, 0, 1));

    const correctedDays = excelDate - 1;

    const milliseconds = correctedDays * 24 * 60 * 60 * 1000;

    const jsDate = new Date(excelEpoch.getTime() + milliseconds);

    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString();
    }
  }

  console.error("Invalid Excel date value:", excelDate);
  throw new RangeError("Invalid Excel date value");
}

module.exports = { excelDateToDateTime };
