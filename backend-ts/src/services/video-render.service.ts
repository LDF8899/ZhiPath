import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * 视频渲染服务
 *
 * 调用 Remotion 渲染管线：
 *   1. 写出脚本 JSON + 音频 JSON 到临时文件
 *   2. 调用 video-renderer 项目的 render.ts
 *   3. 读取渲染结果
 *
 * 前置条件：
 *   - video-renderer 项目已 npm install
 *   - FFmpeg 已安装（Remotion 渲染需要）
 */

export interface RenderResult {
  output_path: string;
  duration_sec: number;
  frames: number;
  fps: number;
  segments: number;
  render_time_sec: number;
}

@Injectable()
export class VideoRenderService {
  private rendererDir: string;
  readonly outputDir: string;

  constructor(private config: ConfigService) {
    this.rendererDir = this.config.get(
      'VIDEO_RENDERER_DIR',
      path.resolve(process.cwd(), '../video-renderer'),
    );
    this.outputDir = this.config.get(
      'VIDEO_OUTPUT_DIR',
      '/tmp/zhipath/video',
    );

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * 渲染视频
   *
   * @param script 视频脚本 JSON
   * @param audioSegments 音频段落数据
   * @param taskId 任务 ID（用于输出文件名）
   * @returns 渲染结果
   */
  async render(
    script: Record<string, any>,
    audioSegments: Array<{ id: string; file_path: string; duration_sec: number }>,
    taskId: string,
  ): Promise<RenderResult> {
    const startTime = Date.now();

    // 写出临时 JSON 文件
    const scriptPath = path.join(this.outputDir, `${taskId}_script.json`);
    const audioPath = path.join(this.outputDir, `${taskId}_audio.json`);
    const outputPath = path.join(this.outputDir, `${taskId}.mp4`);

    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
    fs.writeFileSync(audioPath, JSON.stringify(audioSegments, null, 2));

    try {
      // 检查 video-renderer 是否存在
      if (!fs.existsSync(this.rendererDir)) {
        throw new Error(
          `video-renderer 目录不存在: ${this.rendererDir}\n` +
          `请先安装: cd video-renderer && npm install`,
        );
      }

      // 检查 FFmpeg
      try {
        execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 });
      } catch {
        throw new Error('FFmpeg 未安装，请先安装 FFmpeg');
      }

      // 调用 Remotion 渲染
      console.log(`[VideoRender] 开始渲染: ${taskId}`);

      const renderScript = path.join(this.rendererDir, 'src', 'render.ts');
      const cmd = [
        'npx tsx',
        `"${renderScript}"`,
        `--script "${scriptPath}"`,
        `--audio "${audioPath}"`,
        `--output "${outputPath}"`,
      ].join(' ');

      execSync(cmd, {
        cwd: this.rendererDir,
        encoding: 'utf-8',
        timeout: 300000, // 5 分钟超时
        stdio: 'inherit', // 显示子进程输出
      });

      // 读取结果
      const resultPath = outputPath.replace(/\.mp4$/, '.result.json');
      let result: any;
      if (fs.existsSync(resultPath)) {
        result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
      } else {
        // fallback：用文件大小估算
        const stats = fs.statSync(outputPath);
        result = {
          output_path: outputPath,
          duration_sec: 0,
          fps: 30,
          segments: script.segments?.length || 0,
        };
      }

      const renderTime = (Date.now() - startTime) / 1000;

      console.log(`[VideoRender] 渲染完成: ${taskId} (${renderTime.toFixed(1)}s)`);

      return {
        ...result,
        render_time_sec: renderTime,
      };
    } finally {
      // 清理临时文件
      try { fs.unlinkSync(scriptPath); } catch {}
      try { fs.unlinkSync(audioPath); } catch {}
    }
  }

  /**
   * 检查渲染环境是否就绪
   */
  checkEnvironment(): { ready: boolean; issues: string[] } {
    const issues: string[] = [];

    // 检查 video-renderer 目录
    if (!fs.existsSync(this.rendererDir)) {
      issues.push(`video-renderer 目录不存在: ${this.rendererDir}`);
    } else {
      const nodeModules = path.join(this.rendererDir, 'node_modules');
      if (!fs.existsSync(nodeModules)) {
        issues.push(`video-renderer 未安装依赖: cd video-renderer && npm install`);
      }
    }

    // 检查 FFmpeg
    try {
      execSync('ffmpeg -version', { stdio: 'ignore', timeout: 5000 });
    } catch {
      issues.push('FFmpeg 未安装');
    }

    // 检查输出目录可写
    try {
      fs.mkdirSync(this.outputDir, { recursive: true });
      const testFile = path.join(this.outputDir, '.write_test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch {
      issues.push(`输出目录不可写: ${this.outputDir}`);
    }

    return {
      ready: issues.length === 0,
      issues,
    };
  }
}
