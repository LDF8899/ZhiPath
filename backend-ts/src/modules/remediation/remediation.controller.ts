import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { success, error } from '../../common/api-response';
import { RemediationService } from './remediation.service';

@Controller('user/remediation')
@UseGuards(AuthGuard)
export class RemediationController {
  constructor(private readonly service: RemediationService) {}

  @Get('weak-points')
  async weakPoints(@CurrentUser('sub') userId: number) {
    try { return success(await this.service.weakPoints(userId)); }
    catch (e: any) { return error(400, e.message); }
  }

  @Post('prepare')
  async prepare(@CurrentUser('sub') userId: number, @Body() body: any) {
    try { return success(await this.service.prepare(userId, body || {})); }
    catch (e: any) { return error(400, e.message); }
  }

  @Post('generate')
  async generate(@CurrentUser('sub') userId: number, @Body() body: any) {
    try { return success(await this.service.generate(userId, body || {}), '补弱出题已生成'); }
    catch (e: any) { return error(400, e.message); }
  }

  @Get('history')
  async history(@CurrentUser('sub') userId: number, @Query('limit') limit?: string) {
    try { return success(await this.service.history(userId, limit ? Number(limit) : 10)); }
    catch (e: any) { return error(400, e.message); }
  }
}
