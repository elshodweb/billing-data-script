import { SegmentService } from './../segment/segment.service';
import { Injectable } from '@nestjs/common';
import * as ftp from 'basic-ftp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as xlsx from 'xlsx';
import excelDateToDateTime from '@/common/helper/excelDateConverter';
import { PrismaService } from '../prisma/prisma.service';
import { CreatedByEnum, OrganizationStatusEnum } from 'types/global';

@Injectable()
export class FtpService {
  private client: ftp.Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly segment: SegmentService
  ) {
    this.client = new ftp.Client();
    this.client.ftp.verbose = true;
  }

  async connect(): Promise<void> {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        port: 21,
        // secure: true,
        secureOptions: {
          rejectUnauthorized: true,
        },
      });
    } catch (error) {
      console.error('Failed to connect to FTP server:', error.message);
      throw error;
    }
  }
  async createOrganization() {
    let objects = [];
    let res = await this.processCsvFilesToJSON();
    objects = res;

    while (res.length > 0) {
      res = await this.processCsvFilesToJSON();
      objects.concat(res);
    }
    return 'ok';
  }
  async processCsvFilesToJSON(): Promise<any[]> {
    const combinedData: any[] = [];

    const tempDir = path.join(os.tmpdir(), 'ftp_temp');
    let processedFilesCount = 0;

    try {
      await this.connect();

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const fileList = await this.client.list();

      const csvFiles = fileList.filter(
        (file) =>
          !file.isDirectory &&
          !file.name.endsWith('_edited.csv') &&
          file.name.endsWith('_new.csv')
      );

      const batchSize = 50;

      for (
        let batchIndex = 0;
        batchIndex < csvFiles.length;
        batchIndex += batchSize
      ) {
        const batch = csvFiles.slice(batchIndex, batchIndex + batchSize);

        for (const file of batch) {
          if (processedFilesCount >= 110) {
            break;
          }
          processedFilesCount++;

          const remoteFilePath = `/${file.name}`;
          const localTempFilePath = path.join(tempDir, file.name);

          await this.client.downloadTo(localTempFilePath, remoteFilePath);

          const workbook = xlsx.read(
            fs.readFileSync(localTempFilePath, 'utf8'),
            {
              type: 'string',
              raw: false,
            }
          );

          const sheetName = workbook.SheetNames[0];
          const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: null,
          });

          let orgs = await Promise.all(
            rows.map(async (row: any) => {
              const foundSegment = await this.prisma.segment.findFirst({
                where: {
                  name: row['SEGMENT'] + '',
                },
              });
              let segment: any;
              if (!foundSegment) {
                segment = await this.segment.create({
                  name: row['SEGMENT'] + '',
                });
              } else {
                segment = foundSegment;
              }
              const foundOrg = await this.prisma.organization.findFirst({
                where: {
                  clientId: row['CLNT_ID'] + '',
                },
              });
              if (foundOrg) {
                return;
              }

              let res = await this.prisma.organization.create({
                data: {
                  clientId: row['CLNT_ID'] + '' || '',
                  createdAt: row['START']
                    ? excelDateToDateTime(row['START'])
                    : '',
                  deletedAt: row['STOP']
                    ? excelDateToDateTime(row['STOP'])
                    : null,
                  name: row['NAME'] + '' || '',
                  Phone: {
                    create: [
                      {
                        phone: row['PHONE'] + '' || '',
                        isSecret: true,
                      },
                    ],
                  },
                  segmentId: segment.id || 0,
                  account: row['ACCOUNT'] + '' || '',
                  inn: row['INN'] + '' || '',
                  bankNumber: row['BANK'] + '' || '',
                  address: row['ADDRESS'] + '' || '',
                  mail: row['MAIL'] || '',
                  createdBy: CreatedByEnum.Billing,
                  status: OrganizationStatusEnum.Check,
                },
                select: {
                  id: true,
                  clientId: true,
                  createdAt: true,
                  deletedAt: true,
                  name: true,
                  segmentId: true,
                  account: true,
                  inn: true,
                  bankNumber: true,
                  address: true,
                  mail: true,
                  createdBy: true,
                  status: true,
                },
              });

              await this.prisma.organizationVersion.create({
                data: {
                  ...res,
                  organizationId: res.id,
                  PhoneVersion: {
                    create: [
                      {
                        phone: row['PHONE'] + '' || '',
                        isSecret: true,
                      },
                    ],
                  },
                },
              });
            })
          );

          combinedData.push(...orgs);
          fs.unlinkSync(localTempFilePath);

          const renamedFilePath = `/${path.basename(file.name, '.csv')}_edited.csv`;
          await this.client.rename(remoteFilePath, renamedFilePath);
        }

        if (processedFilesCount >= 110) {
          break;
        }
      }
    } catch (error) {
      console.error('Error processing CSV files:', error.message);

      throw error;
    } finally {
      this.client.close();
    }

    return combinedData;
  }
  async deactiveOrganization() {
    let objects = [];
    let res = await this.deactiveOrganizationIterator();
    objects = res;

    while (res.length > 0) {
      res = await this.deactiveOrganizationIterator();
      objects.concat(res);
    }
    return 'ok';
  }
  async deactiveOrganizationIterator(): Promise<any[]> {
    const combinedData: any[] = [];
    const tempDir = path.join(os.tmpdir(), 'ftp_temp');
    let processedFilesCount = 0;

    try {
      await this.connect();

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }

      const fileList = await this.client.list();

      const csvFiles = fileList.filter(
        (file) =>
          !file.isDirectory &&
          !file.name.endsWith('_edited.csv') &&
          file.name.endsWith('_deactive.csv')
      );

      const batchSize = 50;

      for (
        let batchIndex = 0;
        batchIndex < csvFiles.length;
        batchIndex += batchSize
      ) {
        const batch = csvFiles.slice(batchIndex, batchIndex + batchSize);

        for (const file of batch) {
          if (processedFilesCount >= 110) {
            break;
          }
          processedFilesCount++;

          const remoteFilePath = `/${file.name}`;
          const localTempFilePath = path.join(tempDir, file.name);

          await this.client.downloadTo(localTempFilePath, remoteFilePath);

          const workbook = xlsx.read(
            fs.readFileSync(localTempFilePath, 'utf8'),
            {
              type: 'string',
              raw: false,
            }
          );

          const sheetName = workbook.SheetNames[0];
          const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
            defval: null,
          });

          let orgs = await Promise.all(
            rows.map(async (row: any) => {
              const organization = await this.prisma.organization.findUnique({
                where: { clientId: row['CLNT_ID'] + '' },
              });

              if (!organization) {
                console.error(
                  `Organization with clientId ${row['CLNT_ID']} not found.`
                );
                return;
              }

              let res = await this.prisma.organization.update({
                where: {
                  clientId: row['CLNT_ID'] + '',
                },
                data: {
                  deletedAt: row['STOP']
                    ? excelDateToDateTime(row['STOP'])
                    : null,
                  createdBy: CreatedByEnum.Billing,
                  status: OrganizationStatusEnum.Deleted,
                },
              });

              let orgVer = await this.prisma.organizationVersion.update({
                where: {
                  clientId: row['CLNT_ID'] + '',
                },
                data: {
                  deletedAt: row['STOP']
                    ? excelDateToDateTime(row['STOP'])
                    : null,
                  createdBy: CreatedByEnum.Billing,
                  status: OrganizationStatusEnum.Deleted,
                },
              });
            })
          );
          combinedData.push(...orgs);
          fs.unlinkSync(localTempFilePath);

          const renamedFilePath = `/${path.basename(file.name, '.csv')}_edited.csv`;
          await this.client.rename(remoteFilePath, renamedFilePath);
        }

        if (processedFilesCount >= 110) {
          break;
        }
      }
    } catch (error) {
      console.error('Error processing CSV files:', error.message);

      throw error;
    } finally {
      this.client.close();
    }

    return combinedData;
  }

  async saveAsJSON(data: any[], outputFilePath: string): Promise<void> {
    try {
      fs.writeFileSync(outputFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving JSON file:', error.message);
      throw error;
    }
  }
}
