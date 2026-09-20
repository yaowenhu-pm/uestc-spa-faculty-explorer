import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RUBRIC_VERSION = 'spa-official-evidence-v2';
export const CATALOG_URL = 'https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm';
export const ROSTER_URL = 'https://spa.uestc.edu.cn/szdw/jsml/xsszm.htm';
export const COMPONENTS = {
  hardSignal: { label: '外部认可', max: 30, levels: { national_personal:30, national_major_lead:24, ministerial_recognition:18, provincial_first_or_talent:12, provincial_award:8 } },
  projects: { label: '项目证据', max: 20, levels: { national_lead:20, provincial_lead_or_national_participation:16, concrete_supported:12, named_project:8, project_overview:4 } },
  publications: { label: '成果证据', max: 20, levels: { indexed_or_adopted:20, complete_citation:16, partial_citation:12, named_work:8, publication_overview:4 } },
  recognition: { label: '学术任职', max: 20, levels: { national_committee:20, national_society:16, editor_or_provincial_lead:12, named_appointment:8, named_reviewing:4 } },
  training: { label: '培养教学', max: 10, levels: { national_teaching:10, provincial_teaching:8, teaching_or_guidance_award:6, named_course:4, mentor:2 } },
};
export const CRITERIA = {
  national_personal:'本人院士、国家高层次人才、学术会士或国家级科研奖励',
  national_major_lead:'明确主持具名国家社科基金重大项目或任该项目首席专家',
  ministerial_recognition:'中央部委或中国社科院正式科研成果奖，或教育部新世纪优秀人才',
  provincial_first_or_talent:'省级高层次人才、学术技术带头人或省级科研社科一等奖、特等奖',
  provincial_award:'省级科研、科技或社科成果二等奖、三等奖',
  national_lead:'具名或有唯一编号的国家项目，明确本人主持或负责',
  provincial_lead_or_national_participation:'省部项目明确主持，或国家项目明确参与、参研、主研',
  concrete_supported:'国家项目角色未明确、省部具体项目，或市校项目明确主持',
  named_project:'其他具名项目，有具体条目但缺少上述支持信息',
  project_overview:'只有项目经历概述或资助类别，未摘录具名项目',
  indexed_or_adopted:'该项成果有出处和年份，且明确SCI/SSCI/CSSCI/CSCD/EI收录；或具名资政成果有采纳机构和年份',
  complete_citation:'具名成果有发表出处或出版机构，并有发表年份',
  partial_citation:'具名成果仅能确认发表出处或发表年份之一',
  named_work:'具名成果，未摘录发表出处和年份',
  publication_overview:'只有发表或出版概述，未摘录具体成果',
  national_committee:'全国性学科评议、教学指导等正式委员会及其学科工作组任职',
  national_society:'全国或国际学术组织理事、委员、秘书长或会长等任职',
  editor_or_provincial_lead:'具名期刊编委、主编，或省级学术组织领导职务',
  named_appointment:'其他具名学术或公共组织任职、会员身份',
  named_reviewing:'具名期刊审稿经历',
  national_teaching:'国家教学成果奖、全国教学奖励、明确主持具名国家一流课程或明确指导全国获奖',
  provincial_teaching:'省级教学奖励或省级一流课程',
  teaching_or_guidance_award:'校级教学荣誉或明确学生指导奖励',
  named_course:'官网列出具名教学课程',
  mentor:'仅有明确导师身份',
};
export const PUBLIC_KEYS = ['profileId', 'name', 'title', 'departments', 'profileUrl', 'researchDirections', 'focusKeywords', 'evidenceGrade', 'evidenceScore', 'evidenceLabel', 'verdict', 'scoreComponents', 'hardSignals', 'highlights', 'limitations', 'evidenceSnippets', 'directoryOrder', 'collectedAt', 'reviewStatus', 'rubricVersion'];
const SOURCE_KEYS = ['profileId', 'name', 'title', 'departments', 'profileUrl', 'researchDirections', 'directoryOrder', 'collectedAt', 'reviewStatus', 'rubricVersion', 'limitations', 'evidence'];
const EVIDENCE_KEYS = ['component', 'criterion', 'excerpt', 'sourceUrl'];
const grades = ['S','A','B','C','D','E'];
export const gradeForScore = (score, hasGate=false) => score >= 72 && hasGate ? 'S' : score >= 62 ? 'A' : score >= 48 ? 'B' : score >= 32 ? 'C' : score >= 16 ? 'D' : 'E';
export const gradeLabels = { S:'门槛信号明确', A:'多项证据明确', B:'已有成型证据', C:'部分证据可核对', D:'可核对证据有限', E:'公开依据不足' };
export const safetyPatterns = [
  ['邮箱', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ['电话号码', /(?<![\dA-Za-z])(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]\d{7,8}|028\d{8})(?![\dA-Za-z])/],
  ['联系方式或办公地址', /(?:邮箱|手机|联系电话|办公电话|办公室|办公地点|通讯地址|联系地址)[：:]/],
  ['原始HTML', /<\/?(?:html|body|script)|\$_ts\./i],
  ['本地绝对路径', /[A-Z]:\\|\/Users\/|\/home\//i],
];
function ensure(condition, message) { if (!condition) throw new Error(message); }
function exactKeys(value, allowed, label) {
  ensure(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  ensure(Object.keys(value).every(key=>allowed.includes(key)), `${label}: non-allowlisted field`);
  ensure(allowed.every(key=>Object.hasOwn(value,key)), `${label}: missing required field`);
}
export function assertSafe(value) {
  const text=JSON.stringify(value);
  for(const [label, pattern] of safetyPatterns) ensure(!pattern.test(text), `公开数据检测到${label}`);
}
export function validateSource(records) {
  ensure(Array.isArray(records) && records.length===69, '官方目录必须保留69位教师');
  for(const key of ['profileId','name','profileUrl','directoryOrder']) ensure(new Set(records.map(r=>r[key])).size===69, `Duplicate ${key}`);
  ensure(records.map(r=>r.directoryOrder).sort((a,b)=>a-b).every((n,i)=>n===i+1), '目录顺序必须完整覆盖1至69');
  for(const record of records) {
    exactKeys(record,SOURCE_KEYS,record.name);
    ensure(record.profileId===record.profileUrl.match(/^https:\/\/spa\.uestc\.edu\.cn\/info\/\d+\/(\d+)\.htm$/)?.[1], `${record.name}: profile URL or ID invalid`);
    ensure(record.rubricVersion===RUBRIC_VERSION, `${record.name}: rubric version mismatch`);
    ensure(record.departments.length===1, `${record.name}: expected one catalog category`);
    ensure(Array.isArray(record.limitations)&&record.limitations.every(x=>typeof x==='string'&&x.length<=180),`${record.name}: invalid scope notes`);
    ensure(Array.isArray(record.researchDirections) && record.researchDirections.every(x=>typeof x==='string' && x.length<=100 && !/学科方向|研究领域|本科生|硕士生|博士生/.test(x)), `${record.name}: malformed research field`);
    ensure(Array.isArray(record.evidence) && record.evidence.length<=5, `${record.name}: too many evidence entries`);
    ensure(new Set(record.evidence.map(e=>e.component)).size===record.evidence.length, `${record.name}: duplicate component`);
    for(const evidence of record.evidence) {
      exactKeys(evidence,EVIDENCE_KEYS,`${record.name} evidence`);
      ensure(COMPONENTS[evidence.component]?.levels[evidence.criterion], `${record.name}: invalid evidence criterion`);
      ensure(typeof evidence.excerpt==='string' && evidence.excerpt.trim().length>0 && evidence.excerpt.length<=160, `${record.name}: excerpt length invalid`);
      ensure([record.profileUrl,CATALOG_URL].includes(evidence.sourceUrl), `${record.name}: unverified evidence URL`);
      if(evidence.sourceUrl===CATALOG_URL) ensure(evidence.component==='training' && evidence.criterion==='mentor', `${record.name}: catalog cannot support achievements`);
      if(evidence.criterion==='national_personal') ensure(!/研究团队|团队成员|师从|导师/.test(evidence.excerpt),`${record.name}: another person's title cannot open S gate`);
      if(evidence.criterion==='national_major_lead') ensure(/国家(?:社科|社会科学)基金.*重大项目/.test(evidence.excerpt) && /主持|首席专家/.test(evidence.excerpt) && !/子课题|子项目|参与|参研|主研/.test(evidence.excerpt),`${record.name}: major-project ownership is not explicit`);
    }
  }
  assertSafe(records);
  return true;
}
function conclusion(evidence) { return `${COMPONENTS[evidence.component].levels[evidence.criterion]}分 · ${CRITERIA[evidence.criterion]}`; }
export const hasTierGate = record => record.evidence.some(e=>e.component==='hardSignal'&&['national_personal','national_major_lead'].includes(e.criterion));
export function buildFaculty(records) {
  validateSource(records);
  return records.map(record=>{
    const scoreComponents=Object.fromEntries(Object.keys(COMPONENTS).map(key=>[key,0]));
    for(const e of record.evidence) scoreComponents[e.component]=COMPONENTS[e.component].levels[e.criterion];
    const evidenceScore=Object.values(scoreComponents).reduce((sum,n)=>sum+n,0);
    const evidenceGrade=gradeForScore(evidenceScore,hasTierGate(record));
    const missing=Object.keys(COMPONENTS).filter(key=>!scoreComponents[key]);
    const covered=Object.keys(COMPONENTS).filter(key=>scoreComponents[key]).map(key=>COMPONENTS[key].label);
    const limitations=[...record.limitations,...missing.map(key=>`${COMPONENTS[key].label}未摘录到符合本规则的依据，0分不表示没有相关经历。`)];
    if(!hasTierGate(record))limitations.push('本次摘录未确认S级所需的个人国家级门槛或具名国家社科重大项目主持证据。');
    if(record.evidence.some(e=>e.component==='projects'&&e.criterion==='concrete_supported'))limitations.push('项目按该条公开的资助与角色信息计分，未将未注明的个人角色视为主持。');
    limitations.push('本分数不是能力排名；官网记录未逐项向资助方、出版社或颁奖单位交叉核验，历史经历可能已变化。');
    return {
      profileId:record.profileId,name:record.name,title:record.title,departments:record.departments,
      profileUrl:record.profileUrl,researchDirections:record.researchDirections,focusKeywords:[],
      evidenceGrade,evidenceScore,evidenceLabel:gradeLabels[evidenceGrade],
      verdict:`${hasTierGate(record)?'个人门槛有明确官网依据。':''}已摘录${covered.join('、')}；按各项最高可支持档位计分。`,
      scoreComponents,hardSignals:record.evidence.filter(e=>e.component==='hardSignal').map(e=>CRITERIA[e.criterion]),highlights:`官网研究领域：${record.researchDirections.join('、')}。`,limitations,
      evidenceSnippets:Object.keys(COMPONENTS).flatMap(key=>record.evidence.filter(e=>e.component===key).map(e=>({type:COMPONENTS[key].label,conclusion:conclusion(e),excerpt:e.excerpt,sourceUrl:e.sourceUrl}))),
      directoryOrder:record.directoryOrder,collectedAt:record.collectedAt,reviewStatus:record.reviewStatus,rubricVersion:RUBRIC_VERSION,
    };
  }).sort((a,b)=>a.directoryOrder-b.directoryOrder);
}
export async function build() {
  const bytes=await fs.readFile(path.join(root,'data/faculty.source.json'));
  const faculty=buildFaculty(JSON.parse(bytes.toString('utf8')));
  const sourceCollectedAt=[...new Set(faculty.map(item=>item.collectedAt))].sort().at(-1);
  // Snapshot dates make generated artifacts byte-for-byte reproducible in clean clones.
  const generatedAt=`${sourceCollectedAt}T00:00:00+08:00`;
  const departmentDistribution=Object.fromEntries([...new Set(faculty.flatMap(r=>r.departments))].map(department=>[department,faculty.filter(r=>r.departments.includes(department)).length]));
  const statistics={generatedAt,sourceCollectedAt,teacherCount:faculty.length,departmentCount:Object.keys(departmentDistribution).filter(key=>key.endsWith('系')).length,gradeDistribution:Object.fromEntries(grades.map(grade=>[grade,faculty.filter(item=>item.evidenceGrade===grade).length])),departmentDistribution,reviewDistribution:Object.fromEntries([...new Set(faculty.map(r=>r.reviewStatus))].map(status=>[status,faculty.filter(r=>r.reviewStatus===status).length])),rubricVersion:RUBRIC_VERSION};
  const version={version:`${sourceCollectedAt}-${RUBRIC_VERSION}`,generatedAt,source:'电子科技大学公共管理学院公开教师目录及详情页',sourceUrl:ROSTER_URL,departmentSourceUrl:CATALOG_URL,sourceSha256:createHash('sha256').update(bytes).digest('hex'),publicDataPolicy:'allowlist-v1',rubricVersion:RUBRIC_VERSION};
  const rubric={version:RUBRIC_VERSION,scope:'官网公开证据强度；不是教师能力或学术质量排名；不跨学院比较',components:Object.fromEntries(Object.entries(COMPONENTS).map(([key,value])=>[key,{label:value.label,max:value.max,criteria:Object.entries(value.levels).map(([criterion,points])=>({criterion,points,description:CRITERIA[criterion]}))}])),grading:{S:'分数≥72，且有明确个人国家级门槛或具名国家社科重大项目主持证据',A:'分数≥62，且未满足S条件',B:'48–61',C:'32–47',D:'16–31',E:'0–15'},notes:['每分项只取最高一档，不按项目、论文、称号数量累计。','姓名、职称、研究领域和导师身份本身不产生外部认可分。','SCI/SSCI/CSSCI/CSCD/EI收录只认该条成果的明示标注，不将概述迁移到单篇。','国家项目指国家自然科学/社会科学基金、全国教育规划、科技部项目、中国博士后科学基金等官网明示资助。','教育部一般科研项目按省部档；国家重大项目子课题负责人或参与者不打开S门槛。','同一重大项目可分别支持资助角色分和重大项目门槛分；两者明确披露，不是独立来源重复验证。','含省略号的摘录保留原文顺序，完整表述请查看官网。']};
  for(const [name,data] of [['faculty.public.json',faculty],['statistics.json',statistics],['data-version.json',version],['rubric.json',rubric]]) await fs.writeFile(path.join(root,'data',name),JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({records:faculty.length,distribution:statistics.gradeDistribution},null,2));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await build();
