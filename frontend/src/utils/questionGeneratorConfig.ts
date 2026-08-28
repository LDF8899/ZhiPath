// 在聊天页把智能体解析出的出题配置暂存，供「出题器」页面挂载时预填。
let pendingConfig: any = null;

export function setPendingQuestionConfig(config: any) {
  pendingConfig = config || null;
}

export function takePendingQuestionConfig(): any {
  const config = pendingConfig;
  pendingConfig = null;
  return config;
}
