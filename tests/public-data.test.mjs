import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {buildFaculty,gradeForScore,subgradeForScore,validateSource,assertSafe,assessEvidence,workPoints,RUBRIC_VERSION} from '../scripts/build-public-data.mjs';
const source=JSON.parse(await fs.readFile(new URL('../data/faculty.source.json',import.meta.url),'utf8'));
const faculty=JSON.parse(await fs.readFile(new URL('../data/faculty.public.json',import.meta.url),'utf8'));
const work=(year=2025,role='first-listed',venue='研究期刊')=>({component:'publications',criterion:'research_article',title:`研究成果${year}`,year,role,venue,excerpt:`张三，研究成果，研究期刊，${year}`,sourceUrl:source[0].profileUrl});
const project=(criterion='national_youth_lead',role='lead')=>({component:'projects',criterion,title:'不同的具名研究项目',year:2023,role,venue:null,excerpt:'主持，国家社科基金青年项目，具名研究项目，2023',sourceUrl:source[0].profileUrl});

test('sanitized v3 input reproduces all 69 public records without private files',()=>{
  assert.deepEqual(buildFaculty(source),faculty);
  assert.equal(faculty.length,69);
  assert.ok(source.every(r=>r.rubricVersion===RUBRIC_VERSION));
  assert.deepEqual(faculty.map(r=>r.directoryOrder),Array.from({length:69},(_,i)=>i+1));
});
test('grade gates are applied before intervals and are not population quotas',()=>{
  assert.deepEqual([0,14,15,29,30,44,45,59,60,74,75,100].map(n=>gradeForScore(n,{projects:18})),['E','E','D','D','C','C','B','B','A','A','A','A']);
  assert.equal(gradeForScore(75,{hasGate:true}),'S');
  assert.equal(gradeForScore(74,{hasGate:true,projects:18}),'A');
  assert.equal(gradeForScore(74,{projects:17,publications:14}),'B');
  assert.equal(gradeForScore(60,{projects:0,publications:15}),'A');
  assert.equal(gradeForScore(99,{eligible:false,hasGate:true,projects:30}),'U');
});
test('plus and minus bands have fixed five-point boundaries within each base grade',()=>{
  for(const [grade,low]of [['S',75],['A',60],['B',45],['C',30],['D',15],['E',0]]){
    assert.deepEqual([low,low+4,low+5,low+9,low+10,low+14].map(score=>subgradeForScore(grade,score)),[`${grade}-`,`${grade}-`,grade,grade,`${grade}+`,`${grade}+`]);
  }
  assert.equal(subgradeForScore('S',100),'S+');
  assert.equal(subgradeForScore('E',0),'E-');
  assert.equal(subgradeForScore('U',null),'U');
});
test('high scores cannot use plus labels to bypass S or A research gates',()=>{
  const grade=(score,options)=>subgradeForScore(gradeForScore(score,options),score);
  assert.equal(grade(79,{projects:27}),'A+');
  assert.equal(grade(79,{hasGate:true,projects:27}),'S-');
  assert.equal(grade(79,{projects:17,publications:14}),'B+');
  assert.equal(grade(60,{projects:17,publications:15}),'A-');
  assert.equal(grade(99,{eligible:false,hasGate:true,projects:30}),'U');
});
test('S and E include both extremes while insufficient material stays ungraded',()=>{
  assert.deepEqual([75,79,80,84,85,100].map(score=>subgradeForScore('S',score)),['S-','S-','S','S','S+','S+']);
  assert.deepEqual([0,4,5,9,10,14].map(score=>subgradeForScore('E',score)),['E-','E-','E','E','E+','E+']);
  for(const [base,score]of [['S',74],['S',101],['E',-1],['E',15]])assert.throws(()=>subgradeForScore(base,score),/Invalid score/);
  assert.equal(subgradeForScore(gradeForScore(0,{eligible:false}),null),'U');
  assert.equal(subgradeForScore(gradeForScore(100,{eligible:false,hasGate:true}),null),'U');
});
test('one youth project does not max out projects; repeat independent leadership is bounded',()=>{
  assert.equal(assessEvidence([project()]).scoreComponents.projects,12);
  assert.equal(assessEvidence([project('national_general_lead'),project()]).scoreComponents.projects,21);
  assert.equal(assessEvidence([project('national_general_lead'),project(),project(),project()]).scoreComponents.projects,24);
  assert.equal(assessEvidence([project('national_major_lead'),project(),project()]).scoreComponents.projects,30);
  assert.equal(assessEvidence([project(),project('postdoc_lead')]).scoreComponents.projects,12);
});
test('one indexed paper is not full marks and unexplained authorship earns no role bonus',()=>{
  assert.equal(workPoints(work()),4);
  assert.equal(workPoints(work(2025,'unknown')),2);
  assert.equal(workPoints({...work(2025,'unknown'),excerpt:'张三*，论文，SSCI一区，IF=99'}),2);
  assert.equal(workPoints(work(2020)),3);
  assert.equal(workPoints(work(2026)),4);
});
test('a title and date without a venue cannot establish publication coverage or points',()=>{
  const item=work(2025,'first-listed',null);
  assert.equal(workPoints(item),0);
  assert.equal(assessEvidence([item,project()]).coverage.works,0);
  assert.equal(assessEvidence([item,project()]).canGrade,false);
});
test('continuity counts distinct observed publication years, not number of papers',()=>{
  assert.equal(assessEvidence(Array.from({length:5},()=>work(2025))).scoreComponents.publications,20);
  assert.equal(assessEvidence([2021,2022,2023,2024,2025].map(y=>work(y))).scoreComponents.publications,25);
  assert.equal(assessEvidence([2023,2023,2024,2025,2025].map(y=>work(y))).scoreComponents.publications,23);
});
test('U reflects insufficient core material, not missing recent dates or author role',()=>{
  assert.equal(assessEvidence([work(2018,'unknown'),work(2019,'unknown'),work(2020,'unknown')]).canGrade,true);
  assert.equal(assessEvidence([work(2025,'unknown'),project('national_participant','participant')]).canGrade,true);
  assert.equal(assessEvidence([work(2025),project('role_unknown','unknown')]).canGrade,false);
  assert.equal(assessEvidence([work(null),project('national_major_lead')]).canGrade,true);
  assert.equal(assessEvidence([work(null),project('national_special_lead')]).canGrade,false);
});
test('insufficient records retain known evidence but expose no numeric total',()=>{
  const input=structuredClone(source);input[0].evidence=[];
  const output=buildFaculty(input)[0];
  assert.equal(output.evidenceGrade,'U');assert.equal(output.evidenceScore,null);
  assert.equal(output.evidenceSubgrade,'U');
  assert.equal(output.assessmentStatus,'insufficient');
});
test('private fields and contacts are rejected before export',()=>{
  const raw=structuredClone(source);raw[0].biography='private';assert.throws(()=>validateSource(raw),/non-allowlisted/);
  const nested=structuredClone(source);nested[0].evidence[0].email='x@example.com';assert.throws(()=>validateSource(nested),/non-allowlisted/);
  const contact=structuredClone(source);contact[0].evidence[0].excerpt='联系 x@example.com';assert.throws(()=>validateSource(contact),/邮箱/);
  assert.throws(()=>assertSafe({excerpt:'02887654321'}),/电话号码/);
  assert.doesNotThrow(()=>assertSafe({excerpt:'2023JDR0281123'}));
});
test('catalog evidence cannot award research points',()=>{
  const input=structuredClone(source),record=input.find(r=>r.evidence.some(e=>e.component==='projects'));
  record.evidence.find(e=>e.component==='projects').sourceUrl='https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm';
  assert.throws(()=>validateSource(input),/catalog cannot support/);
});
test('duplicate titles cannot inflate independent projects or representative works',()=>{
  for(const component of ['projects','publications']){
    const input=structuredClone(source),record=input.find(r=>r.evidence.some(e=>e.component===component));
    const selected=record.evidence.find(e=>e.component===component);
    record.evidence=record.evidence.filter(e=>e.component!==component);
    record.evidence.push(selected,{...selected,title:` ${selected.title} `});
    assert.throws(()=>validateSource(input),/duplicate/);
  }
});
test('a team title, a major subproject and an ordinary special program do not become personal gates',()=>{
  const input=structuredClone(source),record=input[0];
  const set=e=>{record.evidence=[{...project(),...e}];};
  set({component:'hardSignal',criterion:'national_personal',role:'recipient',excerpt:'教育部“长江学者”研究团队成员'});
  assert.throws(()=>validateSource(input),/another person's title/);
  set({criterion:'national_major_lead',excerpt:'主持国家社会科学基金重大项目第一子课题'});
  assert.throws(()=>validateSource(input),/major-project ownership/);
  set({criterion:'national_major_lead',title:'重大突发事件下公众安全感研究',excerpt:'国家社会科学基金青年项目：重大突发事件下公众安全感研究，2014，负责人'});
  assert.throws(()=>validateSource(input),/major-project ownership/);
  set({criterion:'national_special_lead',excerpt:'主持科技部国际科技合作专项课题'});
  assert.throws(()=>validateSource(input),/ordinary special funding/);
  set({component:'hardSignal',criterion:'national_personal',role:'recipient',excerpt:'博士生导师，国家级重大人才计划青年学者'});
  assert.doesNotThrow(()=>validateSource(input));
});
test('unexplained asterisks cannot establish corresponding authorship',()=>{
  const input=structuredClone(source);input[0].evidence=[{...work(),role:'corresponding',excerpt:'张三*，研究成果，研究期刊，2025'}];
  assert.throws(()=>validateSource(input),/unexplained asterisk/);
});
test('external author checks retain separate provenance and cannot award unsupported roles',()=>{
  const input=structuredClone(source);
  const item={...work(),authorVerification:{sourceUrl:'https://api.crossref.org/works/10.1234/example',doi:'10.1234/example',authorFullName:'San Zhang',authorPosition:1}};
  input[0].evidence=[item];
  assert.doesNotThrow(()=>validateSource(input));
  assert.deepEqual(buildFaculty(input)[0].evidenceSnippets[0].authorVerification,item.authorVerification);
  item.authorVerification.authorPosition=2;
  assert.throws(()=>validateSource(input),/does not support/);
  item.authorVerification.authorPosition=1;
  item.authorVerification.sourceUrl='https://example.com/unrelated';
  assert.throws(()=>validateSource(input),/same DOI/);
});
test('all selected excerpts remain bounded and traceable to official sources',()=>{
  for(const record of source)for(const e of record.evidence){
    assert.ok(e.excerpt.length<=320);
    assert.ok([record.profileUrl,'https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm'].includes(e.sourceUrl));
  }
});
