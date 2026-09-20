import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { buildFaculty, gradeForScore, validateSource, assertSafe } from '../scripts/build-public-data.mjs';
const source=JSON.parse(await fs.readFile(new URL('../data/faculty.source.json',import.meta.url),'utf8'));
const faculty=JSON.parse(await fs.readFile(new URL('../data/faculty.public.json',import.meta.url),'utf8'));
test('safe input regenerates all 69 directory records without a private file',()=>{
  assert.deepEqual(buildFaculty(source),faculty);
  assert.equal(faculty.length,69);
  assert.deepEqual(faculty.map(r=>r.directoryOrder),Array.from({length:69},(_,i)=>i+1));
});
test('evidence grades use disclosed boundaries and S requires a personal gate',()=>{
  assert.deepEqual([0,15,16,31,32,47,48,61,62,71,72,100].map(n=>gradeForScore(n)),['E','E','D','D','C','C','B','B','A','A','A','A']);
  assert.equal(gradeForScore(72,true),'S');
  assert.equal(gradeForScore(71,true),'A');
});
test('private fields and contacts are rejected before export',()=>{
  const raw=structuredClone(source);raw[0].biography='private';
  assert.throws(()=>validateSource(raw),/non-allowlisted/);
  const nested=structuredClone(source);nested[0].evidence[0].email='x@example.com';
  assert.throws(()=>validateSource(nested),/non-allowlisted/);
  const contact=structuredClone(source);contact[0].evidence[0].excerpt='联系 x@example.com';
  assert.throws(()=>validateSource(contact),/邮箱/);
});
test('catalog evidence cannot award project or publication points',()=>{
  const altered=structuredClone(source);
  altered[0].evidence.find(e=>e.component==='projects').sourceUrl='https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm';
  assert.throws(()=>validateSource(altered),/catalog cannot support/);
});
test('positive components have short attributable excerpts and missing fields remain zero',()=>{
  for(const record of source) for(const e of record.evidence) {
    assert.ok(e.excerpt.length<=160);
    assert.ok([record.profileUrl,'https://spa.uestc.edu.cn/szdw/jsml/xsyq.htm'].includes(e.sourceUrl));
  }
  assert.equal(faculty.find(r=>r.name==='蔡运娟').scoreComponents.publications,4);
  assert.equal(faculty.find(r=>r.name==='刘哲依').scoreComponents.training,0);
  assert.equal(faculty.find(r=>r.name==='刘永波').scoreComponents.projects,0);
});
test('collaborator titles, provincial contest rounds, and unnamed project roles do not inflate scores',()=>{
  const jiang=faculty.find(r=>r.name==='姜海');
  assert.equal(jiang.scoreComponents.hardSignal,12);
  assert.notEqual(jiang.evidenceGrade,'S');
  assert.equal(faculty.find(r=>r.name==='沈华').scoreComponents.training,6);
  assert.equal(faculty.find(r=>r.name==='肖仕卫').scoreComponents.training,4);
  assert.equal(faculty.find(r=>r.name==='汤志伟').scoreComponents.projects,12);
  assert.notEqual(faculty.find(r=>r.name==='汤志伟').evidenceGrade,'S');
  assert.equal(faculty.find(r=>r.name==='蒋国银').evidenceGrade,'S');
  assert.equal(faculty.find(r=>r.name==='杨菁').evidenceGrade,'S');
  assert.ok(faculty.find(r=>r.name==='汤志伟').limitations.some(x=>x.includes('未将概述自动归入')));
});
test('a research-team mention cannot be promoted to a personal national title',()=>{
  const copy=structuredClone(source), record=copy.find(r=>r.name==='姜海');
  const e=record.evidence.find(e=>e.component==='hardSignal');
  e.criterion='national_personal';e.excerpt='教育部“长江学者”研究团队成员';
  assert.throws(()=>validateSource(copy),/another person's title/);
});
test('phone screening catches compact Chengdu landlines without blocking grant identifiers',()=>{
  assert.throws(()=>assertSafe({excerpt:'02887654321'}),/电话号码/);
  assert.doesNotThrow(()=>assertSafe({excerpt:'2023JDR0281123'}));
});
test('duplicate evidence cannot inflate a component score',()=>{
  const duplicate=structuredClone(source);
  const record=duplicate.find(r=>r.evidence.length<5);
  record.evidence.push({...record.evidence[0]});
  assert.throws(()=>buildFaculty(duplicate),/duplicate component/);
});
