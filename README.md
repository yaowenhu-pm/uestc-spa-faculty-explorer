# UESTC SPA Faculty Explorer

电子科技大学公共管理学院教师研究方向与公开履历导航，收录69位教师。

[访问网站](https://yaowenhu-pm.github.io/uestc-spa-faculty-explorer/) · [分级方案](./RATING_PLAN.md) · [69人重评对照](./RATING_REVIEW.md) · [实现方案](./IMPLEMENTATION.md) · [Figma设计](https://www.figma.com/design/byIMpOiumrSh1zPMdhvCfz?node-id=2-2)

参考 [uestc-scse-faculty-explorer](https://github.com/yaowenhu-pm/uestc-scse-faculty-explorer)，将学院官网的研究方向、项目、成果和任职整理为静态目录。支持搜索、学系／职称／分级联合筛选、教师详情、原文依据和可分享的筛选及教师链接，适配桌面、手机与键盘操作。

S/A/B/C/D/E表示本项目对可核对公开履历信号的基础分级，不是教师能力或学术质量排名。A至D再按固定分数区间显示“-／标准／+”，S和E不细分；资料不足为U，页面显示“—”，不显示低总分。默认按基础档S至E再U排列，同档按分数降序；可切换官网目录或姓名排序。细分不按人数三等分，也不按期望分布设置名额。

## 规则与数据

当前规则版本：`spa-research-profile-v3.1`。官网快照：2026-09-20；规则审阅：2026-09-21。近期窗口为2021–2026年，仅包含快照中已列成果。

五项上限为科研认可30、科研项目30、代表成果25、学术服务10、培养教学5。先判断资料是否足够，再应用分数与S/A额外门槛；项目角色、代表作出处与年份均保留依据。具体条件见[完整方案](./RATING_PLAN.md)及[网站说明](./methodology.html)。规则参考分类和多类型代表作的思路，不按期刊指标评价个人。

v3.1仅增加同档细分，原总分、基础档及S/A门槛不变。例如，已归A的60–64分为A-、65–69分为A、70分及以上为A+；75分及以上未过S门槛仍可留在A+，未过A门槛的60分及以上记录仍为B+。“+”不代表晋级。公开数据用 `evidenceGrade` 保留基础档，用 `evidenceSubgrade` 提供显示档位；统计同时保留基础档与细分分布。

基础资料来自[教师目录](https://spa.uestc.edu.cn/szdw/jsml/xsszm.htm)、[学系目录](https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm)及教师详情页。部分英文缩写署名以同一作品的Crossref DOI元数据补核全名与顺序，详情保留独立出处；补核日期为2026-09-21。只用于消除署名歧义，不据此计算影响力，未获补证仍为未知。资料数量是本次选取证据的数量，不是教师职业生涯总量；更新规则不表示重新采集官网。

## 本地运行

需要 Node.js 22+：

```powershell
npm run check
npm run serve
```

打开 `http://127.0.0.1:4173`。构建仅读取仓库内已脱敏的 `data/faculty.source.json`，不需要私人采集材料、账号、API密钥或在线抓取。

```powershell
npm run data
npm run validate
npm run build
```

分别用于生成公开数据、校验，以及完成检查并打包 `_site/`。同一公开输入与规则版本可复现同一输出。

## 更新与发布

逐人核对官网原文，更新公开输入中的项目、代表作和本人角色，运行检查并进行桌面／手机验证。名录变化时同步修改人数完整性约束。权重或门槛变化须更新规则版本与说明，不根据计算后的分布反推规则。

PR运行校验，`main`通过后由GitHub Actions部署GitHub Pages。Pages来源设为GitHub Actions。发布包由白名单脚本生成，仅包含页面、样式、脚本、数据说明和生成后的公开JSON；原始采集材料与构建输入不进入网站包。具体白名单见 [scripts/stage-site.mjs](./scripts/stage-site.mjs)。

CI不直接访问学院官网。`data-version.json`中的SHA-256只用于验证公开输入的一致性；独立署名补核以逐条`authorVerification`出处为准，不表示所有事实都已向资助方、出版社或颁奖单位核验。部署失败可查看Actions日志，回滚通过恢复已验证的提交并重新部署。

## 许可与数据说明

原创代码采用MIT License；学院官网内容、教师资料和摘录不属于MIT授权范围。公开数据不含邮箱、电话、办公地点、照片、完整履历、原始HTML、运行日志或浏览器状态。详见 [DATA_NOTICE.md](./DATA_NOTICE.md)。
