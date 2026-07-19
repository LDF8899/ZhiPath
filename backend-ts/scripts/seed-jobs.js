const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({ host:'127.0.0.1', port:3307, user:'root', password:'root123', database:'zhipath' });
  
  const jobs = [
    ['前端开发工程师','字节跳动','北京','20-40K·15薪','junior',['JavaScript','React','TypeScript','CSS','Webpack','Vue3','Node.js','前端监控','性能优化'],['前端架构设计','跨端开发经验'],'负责抖音电商前端架构设计，参与微前端体系建设，优化首屏加载性能，建设前端监控体系。'],
    ['前端开发工程师','腾讯','深圳','18-35K·14薪','junior',['React','Vue','TypeScript','Next.js','小程序开发','WebSocket','前端工程化'],['Taro','uni-app','Node.js','WebGL'],'负责微信支付前端业务开发，参与小程序和H5页面性能优化，推动组件库建设。'],
    ['Web前端开发','阿里巴巴','杭州','20-38K·16薪','junior',['React','JavaScript','CSS','Webpack','前端安全','跨浏览器兼容'],['TypeScript','Node.js','数据可视化'],'负责淘宝前端业务迭代，参与双十一大促技术保障，优化页面性能和用户体验。'],
    ['前端开发工程师','美团','北京','22-40K·15薪','mid',['React','Vue','TypeScript','Node.js','小程序','前端性能优化','自动化测试'],['微前端','SSR','WebAssembly'],'负责美团外卖商家端前端开发，参与低代码平台建设，提升研发效率。'],
    ['高级前端工程师','百度','北京','30-50K·15薪','senior',['JavaScript','TypeScript','React','Vue','Node.js','工程化','性能优化','团队管理'],['WebGL','AI前端','跨端方案'],'负责百度搜索前端架构演进，主导技术选型和性能优化，带领5人前端团队。'],
    ['前端开发工程师','小红书','上海','25-45K·16薪','mid',['React','TypeScript','Next.js','移动端适配','前端监控','CI/CD'],['SSR','GraphQL','微前端'],'负责小红书社区前端开发，参与内容推荐页的性能优化和用户体验提升。'],
    ['全栈开发工程师','字节跳动','北京','25-45K·15薪','mid',['React','Node.js','TypeScript','Go','MySQL','Redis','Docker','K8s'],['微服务','消息队列','系统设计'],'负责飞书文档全栈开发，参与实时协作引擎设计，优化服务端性能。'],
    ['全栈开发工程师','腾讯','深圳','22-40K·14薪','mid',['Vue','Node.js','Python','MySQL','MongoDB','Docker','Linux'],['K8s','DevOps','系统架构'],'负责腾讯云控制台全栈开发，参与微服务化改造和容器化部署。'],
    ['后端开发工程师','阿里巴巴','杭州','25-45K·16薪','mid',['Java','SpringBoot','MySQL','Redis','RocketMQ','Docker','微服务'],['Go','K8s','系统设计','高并发'],'负责淘宝核心交易链路后端开发，参与双十一高并发系统保障。'],
    ['后端开发工程师','美团','北京','22-40K·15薪','junior',['Java','Spring','MySQL','Redis','Kafka','Docker','分布式系统'],['Go','微服务','高并发'],'负责美团配送调度系统后端开发，参与实时计算和路径规划优化。'],
    ['AI应用开发工程师','百度','北京','30-55K·15薪','mid',['Python','PyTorch','LLM','RAG','LangChain','向量数据库','NLP'],['Transformer','模型部署','多模态'],'负责文心一言应用层开发，参与RAG系统优化和Prompt工程。'],
    ['大模型应用开发','阿里巴巴','杭州','30-55K·16薪','mid',['Python','LLM','RAG','LangChain','PyTorch','向量数据库','API设计'],['Agent开发','多模态','模型微调'],'负责通义千问企业级应用开发，参与Agent框架设计和模型部署优化。'],
    ['AI算法工程师','腾讯','深圳','28-50K·14薪','mid',['Python','PyTorch','TensorFlow','NLP','LLM','推荐系统','数据处理'],['CV','强化学习','模型压缩'],'负责腾讯广告推荐算法开发，参与大规模模型训练和在线推理优化。'],
    ['Golang开发工程师','字节跳动','北京','25-45K·15薪','mid',['Go','MySQL','Redis','Kafka','Docker','K8s','微服务','分布式'],['Rust','系统编程','高性能网络'],'负责字节跳动基础架构开发，参与RPC框架和Service Mesh建设。'],
    ['Java开发工程师','美团','北京','22-40K·15薪','junior',['Java','Spring','MySQL','Redis','RabbitMQ','Docker','设计模式'],['微服务','JVM调优','分布式事务'],'参与美团到店业务系统开发，负责订单和支付模块的设计与实现。'],
    ['测试开发工程师','京东','北京','18-35K·14薪','junior',['Python','Java','自动化测试','Selenium','Appium','CI/CD','性能测试'],['安全测试','测试平台开发','质量管理'],'负责京东零售质量保障，参与自动化测试框架开发和测试平台建设。'],
    ['DevOps工程师','腾讯','深圳','25-45K·14薪','mid',['Linux','Docker','K8s','CI/CD','Jenkins','Shell','Python','监控'],['Terraform','Ansible','Service Mesh'],'负责腾讯云DevOps平台建设，参与容器化改造和持续交付流水线优化。'],
    ['数据分析师','字节跳动','北京','20-40K·15薪','junior',['SQL','Python','Excel','Tableau','数据可视化','A/B测试','统计学'],['Spark','Hive','机器学习'],'负责抖音用户增长数据分析，参与AB实验设计和业务决策支持。'],
    ['Python开发工程师','字节跳动','北京','25-45K·15薪','mid',['Python','Django','FastAPI','MySQL','Redis','Celery','Docker','Linux'],['Go','AI/ML','K8s','微服务'],'负责内部工具平台后端开发，参与自动化测试平台和数据平台建设。'],
    ['移动端开发工程师','拼多多','上海','22-40K·14薪','junior',['React Native','Flutter','iOS','Android','TypeScript','性能优化'],['小程序开发','Kotlin','Swift'],'负责拼多多移动端电商业务开发，参与跨端方案选型和性能优化。'],
  ];

  let inserted = 0;
  for (const [title, company, location, salaryRange, level, required, preferred, desc] of jobs) {
    try {
      await c.query(
        'INSERT INTO job_positions_v3 (title, company, location, salary_range, level, required_skills, preferred_skills, jd_text, source, status, create_time, update_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE required_skills=VALUES(required_skills), preferred_skills=VALUES(preferred_skills), jd_text=VALUES(jd_text), salary_range=VALUES(salary_range)',
        [title, company, location, salaryRange, level,
         JSON.stringify(required.map(n=>({name:n}))),
         JSON.stringify(preferred.map(n=>({name:n}))),
         desc, 'manual', 1, Date.now(), Date.now()]
      );
      inserted++;
    } catch(e) { console.error('Failed:', title, e.message); }
  }
  console.log('Inserted', inserted, 'jobs');
  const [count] = await c.query('SELECT COUNT(*) as c FROM job_positions_v3 WHERE status=1');
  console.log('Total:', count[0].c);
  await c.end();
})();
