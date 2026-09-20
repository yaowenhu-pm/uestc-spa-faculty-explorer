import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUBRIC_VERSION = 'spa-research-profile-v3';
export const REVIEWED_AT = '2026-09-21';
export const RECENT_WINDOW = { start:2021, end:2026 };
export const CATALOG_URL = 'https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm';
export const ROSTER_URL = 'https://spa.uestc.edu.cn/szdw/jsml/xsszm.htm';
export const COMPONENTS = {
  hardSignal:{label:'科研认可',max:30,levels:{national_personal:30,ministerial_research:22,provincial_talent_or_first:18,provincial_second:10,provincial_unspecified:8,provincial_third:6,academic_research_award:6}},
  projects:{label:'科研项目',max:30,levels:{national_major_lead:30,national_key_lead:24,national_special_lead:22,national_general_lead:18,national_subproject_lead:16,national_youth_lead:12,national_unspecified_lead:12,provincial_lead:8,postdoc_lead:6,national_participant:6,local_lead:4,provincial_participant:3,role_unknown:2}},
  publications:{label:'代表成果',max:25,levels:{research_article:0,research_book:0,policy_report:0}},
  recognition:{label:'学术服务',max:10,levels:{national_committee:10,national_society_lead:8,national_society_member:6,editor_or_provincial_lead:5,named_member:2,reviewer:1}},
  training:{label:'培养教学',max:5,levels:{national_teaching:5,provincial_teaching:3,institutional_teaching:2,named_course:1,mentor:1}},
};
export const CRITERIA = {
  national_personal:'本人国家级科研人才、院士、学术会士或国家科研奖',
  ministerial_research:'中央部委或中国社科院正式科研奖，或教育部新世纪优秀人才',
  provincial_talent_or_first:'省级正式科研人才或学术技术带头人，或省级科研一等奖/特等奖',
  provincial_second:'省级科研成果二等奖',provincial_unspecified:'省级科研奖未列等级，或省级学术技术带头人后备人才',provincial_third:'省级科研成果三等奖',academic_research_award:'具名学术组织、研究机构或期刊科研成果奖，不推定为其上级部委奖',
  national_major_lead:'明确主持国家重大总项目或担任其首席专家',national_key_lead:'明确主持国家重点项目',national_special_lead:'明确主持国家重大专项，普通专项不适用',national_general_lead:'明确主持国家一般/面上项目',national_subproject_lead:'明确主持国家重大/重点项目的子课题或子项目',national_youth_lead:'明确主持国家青年项目',national_unspecified_lead:'明确主持国家项目，未列出上述资助类别',provincial_lead:'明确主持省部级科研项目（含教育部一般科研项目）',postdoc_lead:'明确主持中国博士后科学基金项目',national_participant:'明确参与国家科研项目',local_lead:'明确主持市校级或其他具名科研项目',provincial_participant:'明确参与省部级科研项目',role_unknown:'项目可定位，但该条未确认本人主持或参与角色',
  research_article:'研究论文',research_book:'研究著作',policy_report:'具名资政报告',
  national_committee:'全国正式学科评议/教学指导委员会及学科工作组任职',national_society_lead:'全国或国际学术组织会长、副会长、秘书长',national_society_member:'全国或国际学术组织理事/委员',editor_or_provincial_lead:'期刊编委或省级学术组织领导职务',named_member:'具名学术组织普通会员',reviewer:'具名期刊审稿',
  national_teaching:'具名国家教学奖励、明确负责国家课程或指导全国获奖',provincial_teaching:'省级教学奖励或省级课程',institutional_teaching:'校级教学奖励或明确学生指导奖',named_course:'具名课程',mentor:'明确导师身份',
};
export const GRADES=['S','A','B','C','D','E','U'];
export const gradeLabels={S:'国家级标志经历',A:'较强研究履历',B:'多项研究经历',C:'已有研究积累',D:'已见部分研究经历',E:'当前计分信号较少',U:'资料不足'};
export const PUBLIC_KEYS=['profileId','name','title','departments','profileUrl','researchDirections','focusKeywords','evidenceGrade','evidenceScore','evidenceLabel','verdict','scoreComponents','hardSignals','highlights','limitations','evidenceSnippets','directoryOrder','collectedAt','reviewStatus','rubricVersion','assessmentStatus','coverage','gradeReason','scoringNotes'];
const SOURCE_KEYS=['profileId','name','title','departments','profileUrl','researchDirections','directoryOrder','collectedAt','reviewStatus','rubricVersion','limitations','evidence'];
const EVIDENCE_KEYS=['component','criterion','title','year','role','venue','excerpt','sourceUrl'];
const ROLES=['lead','participant','unknown','first-listed','corresponding','sole','coauthor','recipient'];
const NATIONAL_LEAD=new Set(['national_major_lead','national_key_lead','national_special_lead','national_general_lead','national_youth_lead','national_unspecified_lead']);
const LEAD_ROLES=new Set(['first-listed','corresponding','sole']);
export const safetyPatterns=[
  ['邮箱',/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['电话号码',/(?<![\dA-Za-z])(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]\d{7,8}|028\d{8})(?![\dA-Za-z])/],
  ['联系方式或办公地址',/(?:邮箱|手机|联系电话|办公电话|办公室|办公地点|通讯地址|联系地址)[：:]/],
  ['原始HTML',/<\/?(?:html|body|script)|\$_ts\./i],
  ['本地绝对路径',/[A-Z]:\\|\/Users\/|\/home\//i],
];
function ensure(condition,message){if(!condition)throw new Error(message);}
function exactKeys(value,allowed,label,required=allowed){
  ensure(value&&typeof value==='object'&&!Array.isArray(value),`${label} must be an object`);
  ensure(Object.keys(value).every(key=>allowed.includes(key)),`${label}: non-allowlisted field`);
  ensure(required.every(key=>Object.hasOwn(value,key)),`${label}: missing required field`);
}
const canonicalTitle=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function assertSafe(value){for(const[label,pattern]of safetyPatterns)ensure(!pattern.test(JSON.stringify(value)),`公开数据检测到${label}`);}
export function validateSource(records){
  ensure(Array.isArray(records)&&records.length===69,'官方目录必须保留69位教师');
  for(const key of ['profileId','name','profileUrl','directoryOrder'])ensure(new Set(records.map(r=>r[key])).size===69,`Duplicate ${key}`);
  ensure(records.map(r=>r.directoryOrder).sort((a,b)=>a-b).every((n,i)=>n===i+1),'目录顺序必须完整覆盖1至69');
  for(const record of records){
    exactKeys(record,SOURCE_KEYS,record.name);
    ensure(record.profileId===record.profileUrl.match(/^https:\/\/spa\.uestc\.edu\.cn\/info\/\d+\/(\d+)\.htm$/)?.[1],`${record.name}: profile URL or ID invalid`);
    ensure(record.rubricVersion===RUBRIC_VERSION,`${record.name}: rubric version mismatch`);
    ensure(record.departments.length===1,`${record.name}: expected one catalog category`);
    ensure(Array.isArray(record.limitations)&&record.limitations.every(x=>typeof x==='string'&&x.length<=240),`${record.name}: invalid scope notes`);
    ensure(Array.isArray(record.researchDirections)&&record.researchDirections.every(x=>typeof x==='string'&&x.length<=100&&!/学科方向|研究领域|本科生|硕士生|博士生/.test(x)),`${record.name}: malformed research field`);
    ensure(Array.isArray(record.evidence)&&record.evidence.length<=13,`${record.name}: too many evidence entries`);
    for(const key of Object.keys(COMPONENTS)){
      const entries=record.evidence.filter(e=>e.component===key);
      ensure(entries.length<=(['projects','publications'].includes(key)?5:1),`${record.name}: too many ${key} entries`);
      ensure(new Set(entries.map(e=>canonicalTitle(e.title))).size===entries.length,`${record.name}: duplicate ${key} evidence`);
    }
    for(const e of record.evidence){
      exactKeys(e,[...EVIDENCE_KEYS,'authorVerification'],`${record.name} evidence`,EVIDENCE_KEYS);
      ensure(COMPONENTS[e.component]&&Object.hasOwn(COMPONENTS[e.component].levels,e.criterion),`${record.name}: invalid evidence criterion ${e.criterion}`);
      ensure(typeof e.title==='string'&&e.title.trim().length>0&&e.title.length<=260,`${record.name}: invalid evidence title`);
      ensure(e.year===null||Number.isInteger(e.year)&&e.year>=1900&&e.year<=2026,`${record.name}: invalid evidence year`);
      ensure(ROLES.includes(e.role),`${record.name}: invalid evidence role ${e.role}`);
      ensure(e.venue===null||typeof e.venue==='string'&&e.venue.trim().length>0&&e.venue.length<=180,`${record.name}: invalid venue`);
      ensure(e.component==='publications'||e.venue===null,`${record.name}: only publications have venue`);
      ensure(typeof e.excerpt==='string'&&e.excerpt.trim().length>0&&e.excerpt.length<=320,`${record.name}: excerpt length invalid`);
      ensure([record.profileUrl,CATALOG_URL].includes(e.sourceUrl),`${record.name}: unverified evidence URL`);
      if(e.authorVerification){
        const v=e.authorVerification;
        exactKeys(v,['sourceUrl','doi','authorFullName','authorPosition'],`${record.name} author verification`);
        ensure(e.component==='publications',`${record.name}: author verification is only for publications`);
        ensure(typeof v.doi==='string'&&/^10\.\d{4,9}\/\S+$/i.test(v.doi)&&v.sourceUrl===`https://api.crossref.org/works/${v.doi}`,`${record.name}: author verification URL must identify the same DOI`);
        ensure(typeof v.authorFullName==='string'&&v.authorFullName.trim().length>0&&v.authorFullName.length<=100,`${record.name}: invalid verified author name`);
        ensure(Number.isInteger(v.authorPosition)&&v.authorPosition>=1&&v.authorPosition<=100,`${record.name}: invalid verified author position`);
        ensure((e.role==='first-listed'&&v.authorPosition===1)||(e.role==='coauthor'&&v.authorPosition>1),`${record.name}: author verification does not support the assigned role`);
      }
      if(e.sourceUrl===CATALOG_URL)ensure(e.component==='training'&&e.criterion==='mentor',`${record.name}: catalog cannot support achievements`);
      if(e.criterion==='national_personal')ensure(!/研究团队|团队成员|师从|导师(?:为|是|获|入选)/.test(e.excerpt),`${record.name}: another person's title cannot open S gate`);
      if(e.component==='projects'){
        const fundingText=e.excerpt.replaceAll(e.title,'');
        if(e.criterion.endsWith('_lead'))ensure(e.role==='lead'&&/主持|负责|首席专家/.test(fundingText),`${record.name}: project leadership must be explicit`);
        if(e.criterion.endsWith('_participant'))ensure(e.role==='participant'&&/参与|参研|主研|参加|成员|排名第[二三四五六七八九十2-9]/.test(fundingText),`${record.name}: project participation must be explicit`);
        if(e.criterion==='role_unknown')ensure(e.role==='unknown',`${record.name}: role_unknown cannot claim leadership`);
        if(e.criterion==='national_major_lead')ensure(/国家[^：:，,\n]{0,40}重大(?:招标)?项目/.test(fundingText)&&!/子课题|子项目|重大专项/.test(fundingText),`${record.name}: major-project ownership is not explicit`);
        if(e.criterion==='national_key_lead')ensure(/重点/.test(fundingText)&&!/子课题|子项目/.test(fundingText),`${record.name}: key-project evidence invalid`);
        if(e.criterion==='national_special_lead')ensure(/重大专项/.test(fundingText),`${record.name}: ordinary special funding is not a major special project`);
        if(e.criterion==='national_general_lead')ensure(/一般|面上/.test(fundingText),`${record.name}: general-project category missing`);
        if(e.criterion==='national_youth_lead')ensure(/青年/.test(fundingText),`${record.name}: youth-project category missing`);
      }
      if(e.component==='publications'){
        ensure(['first-listed','corresponding','sole','coauthor','unknown'].includes(e.role),`${record.name}: invalid publication role`);
        if(e.role==='corresponding')ensure(/通讯|通信|corresponding/i.test(e.excerpt),`${record.name}: unexplained asterisk cannot establish corresponding author`);
        if(e.role==='sole')ensure(/独著|独立完成|sole author/i.test(e.excerpt),`${record.name}: sole authorship must be explicit`);
      }
    }
  }
  assertSafe(records);return true;
}
export const isLocatableWork=e=>e.component==='publications'&&e.year!==null&&Boolean(e.venue);
const isRecent=e=>e.year>=RECENT_WINDOW.start&&e.year<=RECENT_WINDOW.end;
export const workPoints=e=>!isLocatableWork(e)?0:1+(LEAD_ROLES.has(e.role)?2:0)+(isRecent(e)?1:0);
export const hasTierGate=record=>record.evidence.some(e=>e.criterion==='national_personal'||e.criterion==='national_major_lead');
export function assessEvidence(evidence){
  const projects=evidence.filter(e=>e.component==='projects'),works=evidence.filter(e=>e.component==='publications');
  const located=works.filter(isLocatableWork),attributable=projects.filter(e=>e.role==='lead'||e.role==='participant');
  const componentMax=key=>Math.max(0,...evidence.filter(e=>e.component===key).map(e=>COMPONENTS[key].levels[e.criterion]));
  const nationalLeadCount=projects.filter(e=>NATIONAL_LEAD.has(e.criterion)).length;
  const projectBase=componentMax('projects'),projectBonus=Math.min(6,Math.max(0,nationalLeadCount-1)*3);
  const recentYears=new Set(located.filter(isRecent).map(e=>e.year));
  const continuity=recentYears.size>=5?5:recentYears.size>=3?3:0;
  const scoreComponents={hardSignal:componentMax('hardSignal'),projects:Math.min(30,projectBase+projectBonus),publications:Math.min(25,works.reduce((sum,e)=>sum+workPoints(e),0)+continuity),recognition:componentMax('recognition'),training:componentMax('training')};
  const canGrade=located.length>=3||located.length>=1&&attributable.length>=1||works.length>=1&&projects.some(e=>['national_major_lead','national_key_lead'].includes(e.criterion))||located.length>=1&&scoreComponents.hardSignal>=18;
  return {scoreComponents,total:Object.values(scoreComponents).reduce((sum,n)=>sum+n,0),canGrade,nationalLeadCount,projectBase,projectBonus,continuity,recentYears:[...recentYears].sort(),coverage:{projects:attributable.length,works:located.length,recentWorks:located.filter(isRecent).length,explicitRoleWorks:located.filter(e=>LEAD_ROLES.has(e.role)).length}};
}
export function gradeForScore(score,{eligible=true,hasGate=false,projects=0,publications=0}={}){
  if(!eligible)return 'U';
  if(score>=75&&hasGate)return 'S';
  if(score>=60&&(projects>=18||publications>=15))return 'A';
  return score>=45?'B':score>=30?'C':score>=15?'D':'E';
}
function gradeReasonFor(grade,a,gate){
  if(grade==='U')return `本次仅确认${a.coverage.works}件可定位成果、${a.coverage.projects}项角色明确的科研项目，尚不足以按本规则分级。`;
  if(grade==='S')return `总分${a.total}，且有明确的本人国家级科研认可或国家重大总项目主持证据，满足S级门槛。`;
  if(grade==='A')return `总分${a.total}；${a.scoreComponents.projects>=18?'项目达到18分研究门槛':'代表成果达到15分研究门槛'}，符合A级条件${!gate&&a.total>=75?'；未满足S级额外门槛':''}。`;
  if(grade==='B'&&a.total>=60)return `总分${a.total}，但项目未达到18分、代表成果未达到15分的A级研究门槛，按规则列为B级。`;
  return `总分${a.total}，位于${{B:'45–59',C:'30–44',D:'15–29',E:'0–14'}[grade]}分档；反映本次已确认的公开履历信号。`;
}
function snippetConclusion(e){
  if(e.component!=='publications')return `${COMPONENTS[e.component].levels[e.criterion]}分基础档 · ${CRITERIA[e.criterion]}${e.component==='projects'?'（项目只取最高档，再计算独立主持加分）':''}`;
  if(!isLocatableWork(e))return `${CRITERIA[e.criterion]} · 出处或年份未确认，保留资料，不计分`;
  const role=LEAD_ROLES.has(e.role)?{'first-listed':'署名列首',corresponding:'明示通讯作者',sole:'明示独著'}[e.role]:'未确认可加分的署名角色';
  return `${workPoints(e)}分 · 定位1 + 角色${LEAD_ROLES.has(e.role)?2:0} + 近年${isRecent(e)?1:0} · ${role}`;
}
export function buildFaculty(records){
  validateSource(records);
  return records.map(record=>{
    const a=assessEvidence(record.evidence),gate=hasTierGate(record);
    const evidenceGrade=gradeForScore(a.total,{eligible:a.canGrade,hasGate:gate,...a.scoreComponents});
    const coverage={...a.coverage,summary:`本次选取：${a.coverage.projects}项角色明确项目 · ${a.coverage.works}件可定位成果，其中2021年以来${a.coverage.recentWorks}件。`};
    const limitations=[...record.limitations];
    if(!a.coverage.recentWorks)limitations.push('本次选取的成果中没有可确认的2021年以来条目，不代表本人没有近期成果。');
    if(record.evidence.some(e=>e.component==='projects'&&e.role==='unknown')&&!limitations.some(s=>/项目/.test(s)&&/角色|主持/.test(s)))limitations.push('部分项目未逐项注明本人角色，未将简介中的主持总数套到具体项目。');
    if(record.evidence.some(e=>e.component==='publications'&&!LEAD_ROLES.has(e.role))&&!limitations.some(s=>/成果|英文/.test(s)&&/署名|作者|首作/.test(s)))limitations.push('未明确列首、通讯或独著的成果保留定位分，不把星号或作者角色缺失解释为低贡献。');
    if(record.title==='实验师')limitations.push('本分级聚焦科研履历，不适合据此评价实验教学岗位的完整工作表现。');
    limitations.push('履历依据官网快照，部分英文署名以逐篇Crossref元数据补核；历史任职不代表当前状态，未对全部成果进行同行评议。');
    const scoringNotes=[
      `科研项目：最高基础档${a.projectBase}分；确认${a.nationalLeadCount}项可计加分的独立国家主持项目，追加${a.projectBonus}分，合计上限30分。`,
      `代表成果：最多5件，逐件定位1分、明确署名角色2分、2021年以来1分；选中成果覆盖${a.recentYears.length}个近期年度，持续性加${a.continuity}分。`,
      '科研认可、学术服务、培养教学各取最高一档。重大项目只在项目分中计分，也可作为S门槛，不重复获得科研认可分。',
      'A除总分60外，须项目≥18或代表成果≥15；S除总分75外，须本人国家级科研认可或国家重大总项目主持。未达到资料覆盖条件先列为资料不足。',
      '分数是固定产品规则下的公开履历信号；未按人数配额划档，不把论文索引、期刊影响因子等同于个人成果质量。',
    ];
    const gradeReason=gradeReasonFor(evidenceGrade,a,gate);
    return {profileId:record.profileId,name:record.name,title:record.title,departments:record.departments,profileUrl:record.profileUrl,researchDirections:record.researchDirections,focusKeywords:[],evidenceGrade,evidenceScore:a.canGrade?a.total:null,evidenceLabel:gradeLabels[evidenceGrade],verdict:gradeReason,scoreComponents:a.scoreComponents,hardSignals:record.evidence.filter(e=>e.component==='hardSignal').map(e=>CRITERIA[e.criterion]),highlights:`官网研究领域：${record.researchDirections.join('、')}。`,limitations:[...new Set(limitations)],evidenceSnippets:Object.keys(COMPONENTS).flatMap(key=>record.evidence.filter(e=>e.component===key).map(e=>({type:COMPONENTS[key].label,conclusion:snippetConclusion(e),excerpt:e.excerpt,sourceUrl:e.sourceUrl,...(e.authorVerification?{authorVerification:e.authorVerification}:{})}))),directoryOrder:record.directoryOrder,collectedAt:record.collectedAt,reviewStatus:record.reviewStatus,rubricVersion:RUBRIC_VERSION,assessmentStatus:a.canGrade?'graded':'insufficient',coverage,gradeReason,scoringNotes};
  }).sort((a,b)=>a.directoryOrder-b.directoryOrder);
}
export async function build(){
  const bytes=await fs.readFile(path.join(root,'data/faculty.source.json'));
  const faculty=buildFaculty(JSON.parse(bytes));
  const sourceCollectedAt=[...new Set(faculty.map(item=>item.collectedAt))].sort().at(-1),generatedAt=`${REVIEWED_AT}T00:00:00+08:00`;
  const departmentDistribution=Object.fromEntries([...new Set(faculty.flatMap(r=>r.departments))].map(department=>[department,faculty.filter(r=>r.departments.includes(department)).length]));
  const statistics={generatedAt,sourceCollectedAt,ruleReviewedAt:REVIEWED_AT,teacherCount:faculty.length,departmentCount:Object.keys(departmentDistribution).filter(key=>key.endsWith('系')).length,gradeDistribution:Object.fromEntries(GRADES.map(grade=>[grade,faculty.filter(item=>item.evidenceGrade===grade).length])),departmentDistribution,reviewDistribution:Object.fromEntries([...new Set(faculty.map(r=>r.reviewStatus))].map(status=>[status,faculty.filter(r=>r.reviewStatus===status).length])),rubricVersion:RUBRIC_VERSION};
  const version={version:`${REVIEWED_AT}-${RUBRIC_VERSION}`,generatedAt,sourceCollectedAt,ruleReviewedAt:REVIEWED_AT,source:'电子科技大学公共管理学院公开教师目录及详情页',sourceUrl:ROSTER_URL,departmentSourceUrl:CATALOG_URL,sourceSha256:createHash('sha256').update(bytes).digest('hex'),publicDataPolicy:'allowlist-v2',rubricVersion:RUBRIC_VERSION};
  const rubric={version:RUBRIC_VERSION,reviewedAt:REVIEWED_AT,recentWindow:RECENT_WINDOW,scope:'固定规则下的公开科研履历信号；非官方评价，不等同于能力或学术质量排名，不宣称消除了学科和职业阶段差异',components:Object.fromEntries(Object.entries(COMPONENTS).map(([key,value])=>[key,{label:value.label,max:value.max,aggregation:key==='projects'?'最高基础档+第二、第三项独立国家主持项目各3分，总上限30':key==='publications'?'最多5件，每件定位1+明确署名角色2+近年1，跨3至4个近期年度加3、5个以上加5，总上限25':'最高一档',criteria:Object.entries(value.levels).map(([criterion,points])=>({criterion,points:key==='publications'?null:points,description:CRITERIA[criterion]}))}])),grading:{S:'资料足够、总分≥75，并有本人国家级科研认可或国家重大总项目主持证据',A:'资料足够、总分≥60、项目≥18或代表成果≥15，且未满足S条件',B:'资料足够、总分≥45，且未满足S/A条件',C:'资料足够、30–44',D:'资料足够、15–29',E:'资料足够、0–14',U:'未达到核心研究资料覆盖条件，暂不分级、不展示总分'},coverageEligibility:['至少3件题名、出处、年份齐全的成果','至少1件可定位成果和1项角色明确的具名科研项目','国家重大/重点主持项目和至少1件具名成果','至少1件可定位成果且本人省级以上科研认可达18分'],notes:['先判资料覆盖，再分级；U不等于E。近期条目或作者角色未公开本身不导致U。','最多选5项具名科研项目和5件代表成果；同一项目或作品重复列举不加分，概述总数不拆分。','署名列首是可观察的署名事实，不等同于实质贡献比例；无图例星号不推通讯。','代表成果包括研究论文、研究著作和具名资政报告；普通教材与教学项目不混入科研分。','重大项目子课题不打开总项目S门槛；重大项目不在科研认可中重复加分。','选取数量不是全部职业生涯成果总数；未选取或缺失信息不等于没有经历。','等级阈值在全量重评前固定，不按期望人数或比例调整。']};
  for(const[name,data]of [['faculty.public.json',faculty],['statistics.json',statistics],['data-version.json',version],['rubric.json',rubric]])await fs.writeFile(path.join(root,'data',name),JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({records:faculty.length,distribution:statistics.gradeDistribution},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await build();
