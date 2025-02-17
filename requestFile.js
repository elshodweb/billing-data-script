const { default: axios } = require("axios");
const fs = require("fs/promises"); // Используем модуль fs/promises для работы с async/await

async function requestToGateWay() {
  try {
    // Асинхронное чтение файла
    const data = await fs.readFile("data.json", "utf8");

    const headers = {
      accept: "*/*",
      Authorization: `Bearer `,
      "Content-Type": "application/json",
    };

    // Выполняем POST-запрос
    let response = await axios.post(
      "http://localhost:3000/v1/ftp/create-organizations",
      JSON.parse(data), // Парсим JSON из файла
      { headers }
    );

    console.log(response.data); // Выводим только данные ответа
  } catch (error) {
    console.error("Error occurred:", error.message);
  }
}

requestToGateWay();
