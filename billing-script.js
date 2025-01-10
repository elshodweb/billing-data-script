const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");
const os = require("os");
const xlsx = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const { excelDateToDateTime } = require("./excelDateConverter"); // Импорт вашего конвертера

const prisma = new PrismaClient();

const FTP_CONFIG = {
  host: "192.0.0.1",
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

async function processCsvFiles(client, fileSuffix, processRowCallback) {
  const tempDir = path.join(os.tmpdir(), "ftp_temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const fileList = await client.list();
  const csvFiles = fileList.filter(
    (file) =>
      !file.isDirectory &&
      !file.name.endsWith("_edited.csv") &&
      file.name.endsWith(fileSuffix)
  );

  let processedFilesCount = 0;

  for (let i = 0; i < csvFiles.length; i += BATCH_SIZE) {
    const batch = csvFiles.slice(i, i + BATCH_SIZE);

    for (const file of batch) {
      if (processedFilesCount >= MAX_PROCESSED_FILES) break;
      processedFilesCount++;

      const remoteFilePath = `/${file.name}`;
      const localFilePath = path.join(tempDir, file.name);

      await client.downloadTo(localFilePath, remoteFilePath);

      const workbook = xlsx.read(fs.readFileSync(localFilePath, "utf8"), {
        type: "string",
        raw: false,
      });
      const rows = xlsx.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { defval: null }
      );

      for (const row of rows) {
        await processRowCallback(row);
      }

      fs.unlinkSync(localFilePath);
      const renamedFilePath = `/${path.basename(file.name, ".csv")}_edited.csv`;
      await client.rename(remoteFilePath, renamedFilePath);
    }
  }
}

async function createOrganization() {
  const client = await connectToFtp();
  try {
    await processCsvFiles(client, "_new.csv", async (row) => {
      const segment = await prisma.segment.upsert({
        where: { name: row["SEGMENT"] },
        update: {},
        create: { name: row["SEGMENT"] },
      });

      const existingOrg = await prisma.organization.findFirst({
        where: { clientId: row["CLNT_ID"] },
      });

      if (!existingOrg) {
        const organization = await prisma.organization.create({
          data: {
            clientId: row["CLNT_ID"],
            createdAt: row["START"]
              ? excelDateToDateTime(row["START"])
              : undefined,
            deletedAt: row["STOP"] ? excelDateToDateTime(row["STOP"]) : null,
            name: row["NAME"],
            segmentId: segment.id,
            account: row["ACCOUNT"],
            inn: row["INN"],
            bankNumber: row["BANK"],
            address: row["ADDRESS"],
            mail: row["MAIL"],
          },
        });

        await prisma.organizationVersion.create({
          data: {
            ...organization,
            organizationId: organization.id,
          },
        });
      }
    });
  } catch (error) {
    console.error("Error creating organizations:", error.message);
  } finally {
    client.close();
  }
}

async function deactiveOrganization() {
  const client = await connectToFtp();
  try {
    await processCsvFiles(client, "_deactive.csv", async (row) => {
      await prisma.organization.update({
        where: { clientId: row["CLNT_ID"] },
        data: {
          deletedAt: row["STOP"] ? excelDateToDateTime(row["STOP"]) : null,
          status: "Deleted",
        },
      });
    });
  } catch (error) {
    console.error("Error deactivating organizations:", error.message);
  } finally {
    client.close();
  }
}

async function main() {
  await createOrganization();
  await deactiveOrganization();
  console.log("Processing complete.");
}

main().catch((error) => {
  console.error("Error in main:", error.message);
});
