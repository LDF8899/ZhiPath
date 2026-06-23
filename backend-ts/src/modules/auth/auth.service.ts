import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Student } from '../../entities/student.entity';

/**
 * Auth 服务 v3.0
 * - 密码：bcrypt hash（替代 MD5）
 * - Token：JWT（替代 Session 表）
 * - 角色：user.role 直接字段（替代 groupId 查表）
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Student) private studentRepo: Repository<Student>,
    private jwtService: JwtService,
  ) {}

  /** 登录 */
  async login(username: string, password: string) {
    const user = await this.userRepo.findOne({
      where: { username, status: 1 },
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // bcrypt 比对
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 签发 JWT
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = this.jwtService.sign(payload);

    // 检查 onboarding 状态
    let onboardingCompleted = false;
    if (user.role === 'student') {
      const student = await this.studentRepo.findOne({
        where: { userId: user.id, status: 1 },
      });
      if (student && student.onboardingCompleted === 1) {
        onboardingCompleted = true;
      }
    }

    return {
      token,
      userId: user.id,
      username: user.username,
      realName: user.realName || '',
      role: user.role,
      onboardingCompleted,
    };
  }

  /** 注册 */
  async register(username: string, password: string, realName?: string) {
    const existing = await this.userRepo.findOne({
      where: { username, status: 1 },
    });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    // bcrypt 哈希
    const pwdHash = await bcrypt.hash(password, 10);
    const now = Date.now();
    const user = await this.userRepo.save({
      username,
      password: pwdHash,
      realName: realName || '',
      role: 'student',
      status: 1,
      createTime: now,
      updateTime: now,
    });

    return { id: user.id, username: user.username };
  }

  /** 获取当前用户信息 */
  async getMe(userId: number) {
    const user = await this.userRepo.findOne({
      where: { id: userId, status: 1 },
    });
    if (!user) return null;

    let onboardingCompleted = false;
    if (user.role === 'student') {
      const student = await this.studentRepo.findOne({
        where: { userId: user.id, status: 1 },
      });
      if (student && student.onboardingCompleted === 1) {
        onboardingCompleted = true;
      }
    }

    return {
      id: user.id,
      username: user.username,
      realName: user.realName || '',
      phone: user.phone || '',
      email: user.email || '',
      avatar: user.avatar || '',
      role: user.role,
      onboardingCompleted,
    };
  }
}
