# UESTC SPA Faculty Explorer

电子科技大学公共管理学院教师研究方向与官网证据导航，收录69位教师。

[访问网站](https://yaowenhu-pm.github.io/uestc-spa-faculty-explorer/) · [实现方案](./IMPLEMENTATION.md) · [Figma设计](https://www.figma.com/design/byIMpOiumrSh1zPMdhvCfz?node-id=2-2)

本项目参考 [uestc-scse-faculty-explorer](https://github.com/yaowenhu-pm/uestc-scse-faculty-explorer)，将学院官网的研究方向、项目、成果和荣誉整理为可检索、可筛选的静态网站。S/A/B/C/D/E标注官网证据强度，不是教师能力或教学质量排名。

支持姓名与研究方向搜索、学系/职称/评级联合筛选、目录/姓名/分数排序、教师详情、原文证据及可分享的筛选和教师链接。页面适配桌面与手机，支持键盘操作。

## 本地运行

需要 Node.js 22+：

```powershell
npm run check
npm run serve
```

打开 `http://127.0.0.1:4173`。

## 数据更新

公开数据由白名单导出器生成：

```powershell
npm run data
npm run validate
```

构建仅读取仓库内已脱敏的 `data/faculty.source.json`，无需私人数据、账号、API密钥或在线采集。分级代码、说明和数据带有统一规则版本；同一输入可复现同一输出。

当前规则版本为 `spa-official-evidence-v2`，完整档位见 [data/rubric.json](./data/rubric.json) 和[评级说明](./methodology.html)。分项最高30/20/20/20/10分，S级需要总分和明确门槛同时满足。

官网来源为[教师目录](https://spa.uestc.edu.cn/szdw/jsml/xsszm.htm)、[学系目录](https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm)及教师详情页。初始快照日期为2026年9月20日。更新时先核对原文和证据归属，再修改公开输入并运行检查；如教师人数发生变化，应同步更新完整性约束和测试。

公开数据不包含邮箱、电话、办公地点、照片、完整履历、原始HTML、抓取日志或浏览器状态。CI再次检查字段白名单和敏感文本。`data-version.json` 中的SHA-256仅校验仓库内公开输入的一致性。

## 发布

PR运行校验，`main`通过校验后由GitHub Actions部署到GitHub Pages。仓库的Pages来源需设为GitHub Actions。发布脚本只复制以下文件：

本地可运行 `npm run build` 完成校验并生成 `_site/` 发布包。

- `index.html`
- `methodology.html`
- `404.html`
- `styles.css`
- `app.js`
- `data/faculty.public.json`
- `data/statistics.json`
- `data/data-version.json`
- `DATA_NOTICE.md`

GitHub Actions 不直接访问学院官网；官网刷新在本地可见浏览器环境中完成，复核后再生成公开数据。

部署失败可在Actions查看校验和发布日志；回滚可恢复已验证的提交后重新发布。

## 许可与数据说明

原创代码采用 MIT License。学院官网数据、教师资料和证据摘录不属于 MIT 授权范围，详见 [DATA_NOTICE.md](./DATA_NOTICE.md)。
