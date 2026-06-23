import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../../common/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { success, pageSuccess } from '../../common/api-response';

/**
 * Admin 控制器 — 对齐 Python api/admin/* 所有管理端接口
 */
@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Dashboard ──
  @Get('dashboard')
  async getDashboard() {
    return success(await this.adminService.getDashboard());
  }

  // ── Users ──
  @Get('users')
  async getUsers(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('keyword') kw?: string) {
    const result = await this.adminService.getUsers(p ? +p : 1, ps ? +ps : 20, kw);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('users')
  async createUser(@Body() body: any) {
    return success(await this.adminService.createUser(body));
  }

  @Put('users')
  async updateUser(@Body() body: any) {
    return success(await this.adminService.updateUser(body.id, body));
  }

  @Delete('users/:userId')
  async deleteUser(@Param('userId') id: string) {
    return success(await this.adminService.deleteUser(+id));
  }

  @Get('users/students')
  async getStudents(@Query('page') p?: string, @Query('pageSize') ps?: string) {
    const result = await this.adminService.getStudents(p ? +p : 1, ps ? +ps : 20);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  // REMOVED in v3: Group table no longer exists. Use user.role === 'admin' for role checks.
  // @Get('users/groups')

  // ── Jobs ──
  @Get('jobs')
  async getJobs(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('keyword') kw?: string, @Query('status') st?: string) {
    const result = await this.adminService.getJobs(p ? +p : 1, ps ? +ps : 20, kw, st !== undefined ? +st : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('jobs')
  async createJob(@Body() body: any) {
    return success(await this.adminService.createJob(body));
  }

  @Put('jobs')
  async updateJob(@Body() body: any) {
    return success(await this.adminService.updateJob(body.id, body));
  }

  @Delete('jobs/:jobId')
  async deleteJob(@Param('jobId') id: string) {
    return success(await this.adminService.deleteJob(+id));
  }

  // ── Applications ──
  @Get('jobs/applications')
  async getApplications(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('job_id') jid?: string, @Query('admin_decision') dec?: string) {
    const result = await this.adminService.getApplications(p ? +p : 1, ps ? +ps : 20, jid ? +jid : undefined, dec !== undefined ? +dec : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('jobs/applications/review')
  async reviewApplication(@Body() body: { id: number; admin_decision: number; admin_comment?: string }) {
    return success(await this.adminService.reviewApplication(body.id, body.admin_decision, body.admin_comment));
  }

  // ── Enterprises ──
  @Get('enterprises')
  async getEnterprises(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('status') st?: string) {
    const result = await this.adminService.getEnterprises(p ? +p : 1, ps ? +ps : 20, st !== undefined ? +st : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('enterprises')
  async createEnterprise(@Body() body: any) {
    return success(await this.adminService.createEnterprise(body));
  }

  @Put('enterprises')
  async updateEnterprise(@Body() body: any) {
    return success(await this.adminService.updateEnterprise(body.id, body));
  }

  @Delete('enterprises/:entId')
  async deleteEnterprise(@Param('entId') id: string) {
    return success(await this.adminService.deleteEnterprise(+id));
  }

  // ── News ──
  @Get('news')
  async getNews(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('type') t?: string, @Query('status') st?: string) {
    const result = await this.adminService.getNews(p ? +p : 1, ps ? +ps : 20, t, st !== undefined ? +st : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Post('news')
  async createNews(@Body() body: any) {
    return success(await this.adminService.createNews(body));
  }

  @Put('news')
  async updateNews(@Body() body: any) {
    return success(await this.adminService.updateNews(body.id, body));
  }

  @Delete('news/:newsId')
  async deleteNews(@Param('newsId') id: string) {
    return success(await this.adminService.deleteNews(+id));
  }

  // ── Exams ──
  @Get('exams')
  async getExams(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('user_id') uid?: string, @Query('exam_type') et?: string, @Query('passed') pa?: string) {
    const result = await this.adminService.getExams(p ? +p : 1, ps ? +ps : 20, uid ? +uid : undefined, et ? +et : undefined, pa !== undefined ? +pa : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  // ── Resumes ──
  @Get('resumes')
  async getResumes(@Query('page') p?: string, @Query('pageSize') ps?: string, @Query('status') st?: string) {
    const result = await this.adminService.getResumes(p ? +p : 1, ps ? +ps : 20, st !== undefined ? +st : undefined);
    return pageSuccess(result.list, result.total, result.page, result.pageSize);
  }

  @Put('resumes/review')
  async reviewResume(@Body() body: { id: number; status: number; review_comment?: string }) {
    return success(await this.adminService.reviewResume(body.id, body.status, body.review_comment));
  }

  // ── Settings ──
  @Get('settings')
  async getSettings() {
    return success(await this.adminService.getSettings());
  }

  @Put('settings')
  async updateSetting(@Body() body: { key: string; value: string }) {
    return success(await this.adminService.updateSetting(body.key, body.value));
  }

  @Get('settings/health')
  async getHealth() {
    return success({ status: 'ok', service: 'ZhiPath API', version: '3.0.0' });
  }
}
