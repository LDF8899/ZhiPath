import client from './client';
import type { ApiResponse, PaginatedResponse } from '../types';

// ── Dashboard ──────────────────────────────────

/** 管理端 Dashboard 统计 */
export const getAdminDashboard = () =>
  client.get('/admin/dashboard') as Promise<ApiResponse<{
    userCount: number;
    jobCount: number;
    studentCount: number;
    applicationCount: number;
    examCount: number;
    newsCount: number;
  }>>;

// ── Users ──────────────────────────────────

/** 用户列表 */
export const getAdminUsers = (params?: { page?: number; pageSize?: number; keyword?: string }) =>
  client.get('/admin/users', { params }) as Promise<PaginatedResponse<any>>;

/** 创建用户 */
export const createAdminUser = (data: any) =>
  client.post('/admin/users', data) as Promise<ApiResponse<any>>;

/** 更新用户 */
export const updateAdminUser = (data: any) =>
  client.put('/admin/users', data) as Promise<ApiResponse<any>>;

/** 删除用户 */
export const deleteAdminUser = (id: number) =>
  client.delete(`/admin/users/${id}`) as Promise<ApiResponse<any>>;

/** 学生列表 */
export const getAdminStudents = (params?: { page?: number; pageSize?: number }) =>
  client.get('/admin/users/students', { params }) as Promise<PaginatedResponse<any>>;

// ── Jobs ──────────────────────────────────

/** 岗位列表 */
export const getAdminJobs = (params?: { page?: number; pageSize?: number; keyword?: string; status?: number }) =>
  client.get('/admin/jobs', { params }) as Promise<PaginatedResponse<any>>;

/** 创建岗位 */
export const createAdminJob = (data: any) =>
  client.post('/admin/jobs', data) as Promise<ApiResponse<any>>;

/** 更新岗位 */
export const updateAdminJob = (data: any) =>
  client.put('/admin/jobs', data) as Promise<ApiResponse<any>>;

/** 删除岗位 */
export const deleteAdminJob = (id: number) =>
  client.delete(`/admin/jobs/${id}`) as Promise<ApiResponse<any>>;

// ── Applications ──────────────────────────────────

/** 投递列表 */
export const getAdminApplications = (params?: { page?: number; pageSize?: number; job_id?: number; admin_decision?: number }) =>
  client.get('/admin/jobs/applications', { params }) as Promise<PaginatedResponse<any>>;

/** 审核投递 */
export const reviewApplication = (data: { id: number; admin_decision: number; admin_comment?: string }) =>
  client.post('/admin/jobs/applications/review', data) as Promise<ApiResponse<any>>;

// ── Enterprises ──────────────────────────────────

/** 企业列表 */
export const getAdminEnterprises = (params?: { page?: number; pageSize?: number; status?: number }) =>
  client.get('/admin/enterprises', { params }) as Promise<PaginatedResponse<any>>;

/** 创建企业 */
export const createAdminEnterprise = (data: any) =>
  client.post('/admin/enterprises', data) as Promise<ApiResponse<any>>;

/** 更新企业 */
export const updateAdminEnterprise = (data: any) =>
  client.put('/admin/enterprises', data) as Promise<ApiResponse<any>>;

/** 删除企业 */
export const deleteAdminEnterprise = (id: number) =>
  client.delete(`/admin/enterprises/${id}`) as Promise<ApiResponse<any>>;

// ── News ──────────────────────────────────

/** 资讯列表 */
export const getAdminNews = (params?: { page?: number; pageSize?: number; type?: string; status?: number }) =>
  client.get('/admin/news', { params }) as Promise<PaginatedResponse<any>>;

/** 创建资讯 */
export const createAdminNews = (data: any) =>
  client.post('/admin/news', data) as Promise<ApiResponse<any>>;

/** 更新资讯 */
export const updateAdminNews = (data: any) =>
  client.put('/admin/news', data) as Promise<ApiResponse<any>>;

/** 删除资讯 */
export const deleteAdminNews = (id: number) =>
  client.delete(`/admin/news/${id}`) as Promise<ApiResponse<any>>;

// ── Exams ──────────────────────────────────

/** 考试记录列表 */
export const getAdminExams = (params?: { page?: number; pageSize?: number; user_id?: number; exam_type?: number; passed?: number }) =>
  client.get('/admin/exams', { params }) as Promise<PaginatedResponse<any>>;

// ── Resumes ──────────────────────────────────

/** 简历列表 */
export const getAdminResumes = (params?: { page?: number; pageSize?: number; status?: number }) =>
  client.get('/admin/resumes', { params }) as Promise<PaginatedResponse<any>>;

/** 审核简历 */
export const reviewResume = (data: { id: number; status: number; review_comment?: string }) =>
  client.put('/admin/resumes/review', data) as Promise<ApiResponse<any>>;

// ── Settings ──────────────────────────────────

/** 获取系统配置 */
export const getAdminSettings = () =>
  client.get('/admin/settings') as Promise<ApiResponse<any>>;

/** 健康检查 */
export const getAdminHealth = () =>
  client.get('/admin/settings/health') as Promise<ApiResponse<any>>;

// ── 题库管理 ──────────────────────────────

/** 题目列表 */
export const getAdminQuestions = (params?: any) =>
  client.get('/admin/questions', { params }) as Promise<PaginatedResponse<any>>;

/** 更新题目 */
export const updateAdminQuestion = (id: number, data: any) =>
  client.put(`/admin/questions/${id}`, data) as Promise<ApiResponse<any>>;

/** 审核题目 */
export const reviewAdminQuestion = (id: number, status: number) =>
  client.post(`/admin/questions/${id}/review`, { status }) as Promise<ApiResponse<any>>;

/** 题目统计 */
export const getAdminQuestionStats = (skillName?: string) =>
  client.get('/admin/questions/stats', { params: { skillName } }) as Promise<ApiResponse<any>>;
