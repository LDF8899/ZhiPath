import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LearningDomainRegistry } from './learning-domain.registry';

describe('LearningDomainRegistry', () => {
  const registry = new LearningDomainRegistry();

  it('registers multiple professional domains as first-class domains', () => {
    expect(registry.list().map((domain) => domain.id)).toEqual([
      'ai-native-software',
      'software-engineering',
      'english',
      'mathematics',
      'legal-studies',
    ]);
  });

  it('resolves the AI native software path with grounded delivery phases', () => {
    const { domain, starterPath } = registry.resolvePath('ai-native-software', 'project', 'ai-app-engineer');
    expect(domain.passScore).toBe(70);
    expect(domain.assessmentModes).toContain('引用覆盖率检查');
    expect(domain.evidenceTypes).toContain('可运行代码');
    expect(starterPath.phases.map((phase) => phase.name)).toEqual([
      '让模型稳定输出',
      '让答案有依据',
      '让模型能做事',
      '让它能上线',
    ]);
    expect(
      domain.radarDimensions.reduce((sum, dimension) => sum + dimension.weight, 0),
    ).toBeCloseTo(1);
  });

  it('resolves the CET-6 exam path with ordered phases', () => {
    const { starterPath } = registry.resolvePath('english', 'exam', 'cet-6');
    expect(starterPath.phases.map((phase) => phase.name)).toEqual([
      '诊断与词汇',
      '听力与阅读',
      '写作与翻译',
      '模拟与复盘',
    ]);
    expect(starterPath.phases.flatMap((phase) => phase.abilities)).toHaveLength(8);
  });

  it('rejects unsupported goal and path combinations', () => {
    expect(() => registry.resolvePath('english', 'career', 'cet-6')).toThrow(BadRequestException);
    expect(() => registry.resolvePath('missing', 'exam', 'cet-6')).toThrow(NotFoundException);
  });

  it('exposes domain-specific assessment and evidence models', () => {
    const mathematics = registry.resolvePath('mathematics', 'exam', 'postgraduate-math');
    const law = registry.resolvePath('legal-studies', 'certificate', 'legal-professional-qualification');
    expect(mathematics.domain.assessmentModes).toContain('分步解题');
    expect(mathematics.domain.evidenceTypes).toContain('解题步骤');
    expect(law.domain.assessmentModes).toContain('案例分析');
    expect(law.starterPath.phases).toHaveLength(4);
    expect(mathematics.domain.passScore).toBe(70);
    expect(law.domain.passScore).toBe(60);
    expect(mathematics.domain.radarDimensions.map((dimension) => dimension.name)).toContain('高等数学');
    expect(mathematics.domain.radarDimensions.reduce((sum, dimension) => sum + dimension.weight, 0)).toBeCloseTo(1);
  });
});
