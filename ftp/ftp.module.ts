import { Module } from '@nestjs/common';
import { FtpService } from './ftp.service';
import { FtpController } from './ftp.controller';
import { SegmentModule } from '../segment/segment.module';

@Module({
  providers: [FtpService],
  controllers: [FtpController],
  exports: [FtpService],
  imports: [SegmentModule],
})
export class FtpModule {}
