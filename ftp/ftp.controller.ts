import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { FtpService } from './ftp.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagePattern } from '@nestjs/microservices';
import { FtpServiceCommands } from 'types/organization/ftp';

@ApiBearerAuth()
@ApiTags('ftp')
@Controller('ftp')
export class FtpController {
  constructor(private readonly ftpService: FtpService) {}

  @Get('process-files')
  @HttpCode(HttpStatus.OK)
  @MessagePattern({ cmd: FtpServiceCommands.READ_FILES })
  async processFiles(): Promise<any> {
    
    const createRes = await this.ftpService.createOrganization();
    const deleteRes = await this.ftpService.deactiveOrganization();

    return { createRes, deleteRes };
  }
}
