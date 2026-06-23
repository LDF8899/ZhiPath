import { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'zhipath_agent_onboarding_done';

/**
 * Agent 办公室新手引导 Hook
 * 首次访问时延迟 2 秒展示引导，用户关闭后写入 localStorage 不再展示
 */
export function useAgentOnboarding() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      const timer = setTimeout(() => setShowGuide(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShowGuide(false);
  };

  return { showGuide, dismiss };
}
