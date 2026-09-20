import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { root, COMPONENTS, PUBLIC_KEYS, GRADES, gradeForScore, hasTierGate, assessEvidence, assertSafe, buildFaculty } from './build-public-data.mjs';
const sourceBytes=await fs.readFile(path.join(root,'data/faculty.source.json'));
const source=JSON.parse(sourceBytes);
const read=async name=>JSON.parse(await fs.readFile(path.join(root,'data',name),'utf8'));
const [faculty,statistics,version]=await Promise.all(['faculty.public.json','statistics.json','data-version.json'].map(read));
assert.deepEqual(faculty,buildFaculty(source),'公开导出与安全输入不一致');
assert.equal(version.sourceSha256,createHash('sha256').update(sourceBytes).digest('hex'));
for(const record of faculty) {
  assert.deepEqual(Object.keys(record).sort(),PUBLIC_KEYS.slice().sort());
  const input=source.find(r=>r.profileId===record.profileId);
  const assessment=assessEvidence(input.evidence);
  assert.equal(record.evidenceScore,assessment.canGrade?assessment.total:null);
  assert.equal(record.assessmentStatus,assessment.canGrade?'graded':'insufficient');
  assert.equal(record.evidenceGrade,gradeForScore(assessment.total,{eligible:assessment.canGrade,hasGate:hasTierGate(input),...assessment.scoreComponents}));
  for(const [key,score] of Object.entries(record.scoreComponents)) {
    assert.ok(Number.isInteger(score) && score>=0 && score<=COMPONENTS[key].max);
    assert.equal(record.evidenceSnippets.filter(e=>e.type===COMPONENTS[key].label).length,input.evidence.filter(e=>e.component===key).length,`${record.name} ${key} 必须有对应摘录`);
  }
  assertSafe(record);
}
assert.deepEqual(statistics.gradeDistribution,Object.fromEntries(GRADES.map(grade=>[grade,faculty.filter(r=>r.evidenceGrade===grade).length])));
assert.equal(statistics.teacherCount,69);
assert.equal(statistics.departmentCount,6);
assert.deepEqual(statistics.departmentDistribution,{'信息管理系':12,'行政管理系':14,'城市管理系':11,'公共政策系':12,'特聘讲席教授':1,'新闻传播系':8,'法学系':11});
console.log(JSON.stringify({passed:true,teacherCount:69,departments:6,distribution:statistics.gradeDistribution},null,2));
