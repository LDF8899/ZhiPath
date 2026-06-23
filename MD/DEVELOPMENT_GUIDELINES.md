# 智途 ZhiPath — 前后端开发准则

> 本文件是交接核心文档。违反这些规则会导致线上白屏、API 500、数据错乱。
> 每一条规则都来自实际踩坑，标有 **[为什么]** 说明原因。

---

## 一、命名规范（最高优先级）

### 1.1 后端返回 JSON 必须用 snake_case

```json
// ✅ 正确
{ "target_job": { "match_score": 85 }, "today_tasks": [], "total_skills": 17 }

// ❌ 错误 — 前端会找不到字段导致白屏
{ "targetJob": { "matchScore": 85 }, "todayTasks": [], "totalSkills": 17 }
```

**[为什么]** 前端类型定义直接映射后端 JSON，不做转换层。字段名不匹配 = `undefined` = `.map()` 崩溃。

**[规则]** Controller 构造返回对象时，所有 key 必须是 snake_case。

### 1.2 数据库 Entity 属性用 camelCase，列名用 snake_case

```ts
// ✅ 正确 — base.entity.ts 已定义的模式
@Column({ name: 'target_job_id' })
targetJobId: number;

// ❌ 错误 — 直接用 snake_case 做属性名
@Column()
target_job_id: number;
```

**[为什么]** TypeORM 查询时用 TS 属性名（camelCase），数据库存 snake_case。`findOne({ where: { targetJobId: 1 } })` 会自动映射到 `target_job_id` 列。

**[规则]** 新增字段必须同时写 `name: 'xxx_xxx'`。

### 1.3 前端类型字段名必须与后端 JSON 完全一致

```ts
// ✅ 正确 — 后端返回 snake_case，前端就用 snake_case
interface DashboardData {
  target_job: Job | null;
  today_tasks: TodayTask[];
  total_skills: number;
}

// ❌ 错误 — 自作主张改成 camelCase
interface DashboardData {
  targetJob: Job | null;
  todayTasks: TodayTask[];
  totalSkills: number;
}
```

**[为什么]** 前端没有 JSON 转换层，axios 拦截器只解包 axios 外壳，不做字段重命名。类型定义和实际 JSON 不匹配，TypeScript 不会报错（因为 `as any` 断言），但运行时访问 `undefined`。

**[规则]** 新增 API 返回类型时，先用 curl 测一次实际响应，再写 interface。

---

## 二、JWT 与认证

### 2.1 JWT Payload 结构

```ts
// auth.service.ts 签发
const payload = { sub: user.id, username: user.username, role: user.role };
const token = this.jwtService.sign(payload);

// auth.guard.ts 解码后挂载
request.user = payload; // { sub, username, role, iat, exp }
```

### 2.2 Controller 获取用户 ID 必须用 `user.sub`

```ts
// ✅ 正确
@Get('profile')
async getProfile(@CurrentUser() user: any) {
  const userId = user.sub;  // ← JWT 里用户 ID 字段是 sub
  const profile = await this.studentService.getProfile(userId);
  return success(profile);
}

// ❌ 错误 — user.id 是 undefined
const userId = user.id;
```

**[为什么]** JWT payload 是 `{ sub, username, role }`，没有 `id` 字段。`user.id` 永远是 `undefined`，导致 TypeORM 查询 `findOne({ where: { userId: undefined } })` 抛异常 → 500。

**[规则]** 所有需要用户 ID 的 Controller 方法，统一用 `user.sub`。可以用 `@CurrentUser('sub') userId: number` 直接取。

### 2.3 前端登录响应解析

```ts
// ✅ 正确 — 后端返回扁平结构，token 和用户字段同级
const res = await login(username, password);
const { token, ...userData } = res.data as any;
setAuth(token, userData);

// ❌ 错误 — 后端没有嵌套的 user 对象
const { token, user } = res.data;
```

**[为什么]** 登录接口返回 `{ token, userId, username, realName, role, onboardingCompleted }`，不是 `{ token, user: {...} }`。

---

## 三、API 响应规范

### 3.1 统一信封格式

```ts
// 单条数据 — success()
{ "code": 200, "message": "success", "data": { ... } }

// 分页数据 — pageSuccess()
{ "code": 200, "message": "success", "data": [...], "total": 50, "page": 1, "pageSize": 20 }
```

**[规则]** 所有 Controller 必须用 `success()` 或 `pageSuccess()` 包装返回值，不要手动构造对象。

### 3.2 错误响应

```ts
// 业务错误 — 用 error() 或 throw NestJS 异常
return error(400, '参数不合法');
throw new UnauthorizedException('未登录');

// ❌ 不要直接返回裸对象
return { message: '失败' };  // 缺少 code 和 data 字段
```

### 3.3 新增 API 端点流程

```
1. Entity 定义字段（camelCase 属性 + snake_case name）
2. Service 写业务逻辑
3. Controller 用 @CurrentUser('sub') 取用户 ID，用 success() 包装返回
4. Module 注册 Controller 和 Service
5. curl 测试确认返回格式
6. 前端写对应类型（字段名与 JSON 完全一致）
7. 前端写 API 函数（as Promise<ApiResponse<T>> 断言）
8. 前端页面调用并渲染
```

---

## 四、前端开发规范

### 4.1 页面数据获取标准模式

```tsx
const [data, setData] = useState<T | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const fetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await apiFunction();
    setData(res.data);  // res 已被 axios 拦截器解包，res.data 是信封里的 data 字段
  } catch (err: any) {
    setError(err?.message || '加载失败');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { fetchData(); }, []);
```

**[注意]** `res` 是 axios 拦截器解包后的响应体（即 `{ code, message, data }`），`res.data` 是业务数据。两层解包：
- 第一层：axios 拦截器 `return res.data` → 得到 `{ code, message, data }`
- 第二层：页面 `res.data` → 得到实际业务对象

### 4.2 分页 API 的类型断言

```ts
// api/user.ts
export const getJobs = (params?) =>
  client.get('/user/jobs', { params }) as Promise<PaginatedResponse<Job>>;

// 页面使用
const res = await getJobs({ page: 1, pageSize: 20 });
setJobs(res.data);   // res.data 是 Job[] 数组
setTotal(res.total);  // res.total 是总数
```

**[规则]** 分页接口返回类型用 `PaginatedResponse<T>`，单条用 `ApiResponse<T>`。

### 4.3 禁止事项

| 禁止 | 原因 |
|------|------|
| 前端自定义 JSON 转换层 | 增加复杂度，且容易与后端不同步 |
| 用 `localStorage` 存 token | 关闭浏览器不清除，安全隐患 |
| 类型定义用 `any` 绕过检查 | 运行时崩溃无法被 TypeScript 捕获 |
| 组件内直接调 axios | 统一走 `api/user.ts`，便于拦截器管理 |
| 忽略 `error` 状态 | 白屏比报错更难调试 |

---

## 五、后端开发规范

### 5.1 MongoDB 连接配置

```env
# .env 中必须加 ?authSource=admin
MONGODB_URL=mongodb://root:root@127.0.0.1:27017?authSource=admin
MONGODB_DATABASE=zhipath
```

**[为什么]** Docker 的 `MONGO_INITDB_ROOT_USERNAME/PASSWORD` 会在 `admin` 库创建 root 用户。不指定 `authSource=admin`，Mongoose 默认在 `zhipath` 库认证 → `UserNotFound` → 500。

### 5.2 改了 .ts 后必须重新编译

```bash
# 方式 1：手动编译
npm run build && node dist/main.js

# 方式 2：开发时用 watch 模式（推荐）
npm run start:dev  # nest start --watch，改 .ts 自动重编译
```

**[为什么]** 后端跑的是 `dist/main.js`（编译产物），不是 `src/main.ts`（源码）。改了源码不 build = 跑旧代码。

### 5.3 Controller 注入 User ID 的标准写法

```ts
// ✅ 推荐 — 用装饰器直接取
async getProfile(@CurrentUser('sub') userId: number) {
  const profile = await this.studentService.getProfile(userId);
  return success(profile);
}

// ✅ 也可以 — 取整个 payload 再取 sub
async getProfile(@CurrentUser() user: any) {
  const userId = user.sub;
  // ...
}
```

### 5.4 新增 Entity 字段检查清单

```
□ 属性名用 camelCase
□ @Column 加 name: 'snake_case'
□ 类型与数据库一致（bigint / varchar / tinyint）
□ nullable 是否正确
□ default 值是否正确
□ comment 是否写了
```

---

## 六、环境与部署

### 6.1 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 Vite | 5173 | `npm run dev` |
| 后端 NestJS | 3000 | `node dist/main.js` |
| MySQL | 3307 | Docker |
| MongoDB | 27017 | Docker |
| Redis | 6379 | Docker |
| Neo4j | 7687 | Docker |

### 6.2 启动顺序

```bash
# 1. 中间件
cd D:\middleware && docker compose up -d

# 2. 后端
cd backend-ts && npm run build && node dist/main.js

# 3. 前端
cd frontend && npm run dev
```

### 6.3 测试账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `123456` | 管理员 |
| `student1` | `123456` | 学生 |

### 6.4 Vite 代理配置

```ts
// frontend/vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

前端所有 `/api/*` 请求会被代理到后端 3000 端口。

---

## 七、调试指南

### 7.1 白屏排查步骤

```
1. F12 → Console 看红色报错
2. 如果是 "Cannot read properties of undefined"：
   → 检查后端返回的 JSON 字段名是否与前端类型一致
   → curl 测一次实际响应
3. 如果是 "xxx is not a function"：
   → 检查 import 是否正确，组件是否导出
4. 如果 ErrorBoundary 显示错误栈：
   → 看是哪个组件第几行
5. 如果控制台无报错但页面空白：
   → 检查 CSS，h-full 需要父元素有明确高度
```

### 7.2 API 500 排查步骤

```
1. 看后端终端日志（不是浏览器 Console）
2. TypeORM "Undefined value in where" → 检查 Controller 是否用了 user.sub
3. MongoDB "UserNotFound" → 检查 .env 的 MONGODB_URL 是否有 ?authSource=admin
4. JWT "invalid token" → 检查 token 是否过期，SECRET_KEY 是否一致
```

### 7.3 浏览器扩展干扰

控制台出现以下内容是浏览器扩展注入的，与项目无关，可忽略：
- `aegisInject` — 腾讯 Aegis 监控
- `SideBar` — 侧边栏扩展
- `rumt-zh.com` — 腾讯 RUM 分析
- `main.xxxxx.js`（带 hash 的打包文件）— 旧缓存

**排查时建议用无痕模式**，避免扩展干扰。

---

## 八、代码审查检查清单

提 PR 前自查：

### 后端
- [ ] Controller 用 `user.sub` 取用户 ID，不是 `user.id`
- [ ] 返回值用 `success()` / `pageSuccess()` 包装
- [ ] Entity 字段有 `name: 'snake_case'` 映射
- [ ] `.env` 改了后确认重启生效
- [ ] 改了 `.ts` 后 `npm run build` 已执行

### 前端
- [ ] 类型定义字段名与后端 JSON 完全一致（curl 验证）
- [ ] 不使用 `localStorage` 存敏感信息
- [ ] 组件有 loading / error 状态处理
- [ ] `.map()` 前有 `?? []` 或 `?.` 防护
- [ ] 用无痕模式测试，排除浏览器扩展干扰
