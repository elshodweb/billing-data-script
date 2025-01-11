const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");
const os = require("os");
const xlsx = require("xlsx");

const FTP_CONFIG = {
  host: "127.0.0.1",
  user: "ftpuser",
  password: "1111",
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
        const workbook = xlsx.readFile(localFilePath);
        const rows = xlsx.utils.sheet_to_json(
          workbook.Sheets[workbook.SheetNames[0]],
          { defval: null }
        );
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
  console.log(123213);

  const client = await connectToFtp();
  console.log(123213);

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

  console.log(
    "Processing complete.",
    "Files create: " + create.length,
    "; files deactive: " + deactive.length
  );
  return { create, deactive };
}

main().catch((error) => {
  console.error("Error in main:", error.message);
});
