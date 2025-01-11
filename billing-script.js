const iconv = require('iconv-lite');
const fs = require("fs");
const path = require("path");
const os = require("os");
const xlsx = require("xlsx");
const ftp = require("basic-ftp");
const axios = require("axios");

const FTP_CONFIG = {
  port: 21,
  secure: true,
  secureOptions: {
    rejectUnauthorized: false,
  },
};

const BATCH_SIZE = 50;
const MAX_PROCESSED_FILES = 110;

async function connectToFtp() {
  const client = new ftp.Client();
  client.ftp.verbose = true;
  await client.access(FTP_CONFIG);
  return client;
}

async function processCsvFiles(client, fileSuffix, maxFiles) {
  const tempDir = path.join(os.tmpdir(), "ftp_temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const fileList = await client.list();
  const csvFiles = fileList.filter(
    (file) =>
      !file.isDirectory &&
      file.name.endsWith(fileSuffix) &&
      !file.name.endsWith("_edited.csv")
  );

  let processedFilesCount = 0;
  const results = [];

  for (
    let i = 0;
    i < csvFiles.length && processedFilesCount < maxFiles;
    i += BATCH_SIZE
  ) {
    const batch = csvFiles.slice(i, i + BATCH_SIZE);

    for (const file of batch) {
      if (processedFilesCount >= maxFiles) break;
      processedFilesCount++;

      const remoteFilePath = `/${file.name}`;
      const localFilePath = path.join(tempDir, file.name);

      await client.downloadTo(localFilePath, remoteFilePath);

      try {
        // Чтение файла в оригинальной кодировке (например, windows-1251)
        const fileBuffer = fs.readFileSync(localFilePath);
        
        // Конвертация в utf-8
        const utf8Content = iconv.decode(fileBuffer, 'win1251');
        
        // Сохранение временного файла в кодировке utf-8
        const tempFilePath = path.join(os.tmpdir(), 'temp_utf8.xlsx');
        fs.writeFileSync(tempFilePath, utf8Content);

        // Чтение файла с помощью xlsx
        const workbook = xlsx.readFile(tempFilePath);
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null });
        results.push(...rows);

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error.message);
      } finally {
        fs.unlinkSync(localFilePath);
      }

      const renamedFilePath = `/${path.basename(file.name, ".csv")}_edited.csv`;
      await client.rename(remoteFilePath, renamedFilePath);
    }
  }

  return results;
}

async function processOrganizations(fileSuffix) {
  const client = await connectToFtp();

  try {
    return await processCsvFiles(client, fileSuffix, MAX_PROCESSED_FILES);
  } catch (error) {
    console.error(
      `Error processing organizations with suffix ${fileSuffix}:`,
      error.message
    );
    return [];
  } finally {
    client.close();
  }
}

async function main() {
  const create = [];
  let createdOrg = await processOrganizations("_new.csv");
  create.push(...createdOrg);
  while (createdOrg.length > 0) {
    createdOrg = await processOrganizations("_new.csv");
    create.push(...createdOrg);
  }

  const deactive = [];
  let deactiveOrg = await processOrganizations("_deactive.csv");
  while (deactiveOrg.length > 0) {
    deactiveOrg = await processOrganizations("_deactive.csv");
    deactive.push(...deactiveOrg);
  }

  const headers = {
    accept: "*/*",
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsInJvbGVJZCI6NCwiaWF0IjoxNzM2NTg1Mzk5LCJleHAiOjE3Mzc0NDkzOTl9.4fQ-8Scra695J-5d2w_CnxmaR3esG3pVP3vXaXdpLBY`,
    "Content-Type": "application/json",
  };
  let response = await axios.post(
    "http://localhost:3000/v1/ftp/create-organizations",
    {
      new: create,
      deactive,
    },
    { headers }
  );
  console.log(response);

  return { response };
}

main().catch((error) => {
  console.error("Error in main:", error.message);
});
