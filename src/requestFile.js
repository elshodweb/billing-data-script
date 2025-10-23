const { default: axios } = require("axios");
const fs = require("fs/promises"); // Используем модуль fs/promises для работы с async/await
const path = require("path");
async function requestToGateWay() {
  try {
    // Асинхронное чтение файла
    const data = await fs.readFile(
      path.join(__dirname, "..", "data.json"),
      "utf8"
    );

    const headers = {
      accept: "*/*",
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVJZCI6MiwiaWF0IjoxNzYxMTMyNDQ0LCJleHAiOjE3NjE5OTY0NDR9.i2U_U78QrxnnHZJbMQ6zFgMLweZ42cJAsMKr9YDi8q4`,
      "Content-Type": "application/json",
    };

    // Выполняем POST-запрос
    console.log(data);

    let response = await axios.post(
      "http://localhost:4000/v1/ftp/create-organizations",
      JSON.parse(data), // Парсим JSON из файла
      { headers }
    );
    // Выводим только данные ответа
    console.log("response::", response); 
    return { status: "OK" };
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
requestToGateWay();
module.exports = requestToGateWay;
