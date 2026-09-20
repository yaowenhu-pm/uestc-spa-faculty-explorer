import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { root, COMPONENTS, PUBLIC_KEYS, gradeForScore, hasTierGate, assertSafe, buildFaculty } from './build-public-data.mjs';
const sourceBytes=await fs.readFile(path.join(root,'data/faculty.source.json'));
const source=JSON.parse(sourceBytes);
const read=async name=>JSON.parse(await fs.readFile(path.join(root,'data',name),'utf8'));
const [faculty,statistics,version]=await Promise.all(['faculty.public.json','statistics.json','data-version.json'].map(read));
assert.deepEqual(faculty,buildFaculty(source),'公开导出与安全输入不一致');
assert.equal(version.sourceSha256,createHash('sha256').update(sourceBytes).digest('hex'));
for(const record of faculty) {
  assert.deepEqual(Object.keys(record).sort(),PUBLIC_KEYS.slice().sort());
  assert.equal(record.evidenceScore,Object.values(record.scoreComponents).reduce((sum,n)=>sum+n,0));
  assert.equal(record.evidenceGrade,gradeForScore(record.evidenceScore,hasTierGate(source.find(r=>r.profileId===record.profileId))));
  for(const [key,score] of Object.entries(record.scoreComponents)) {
    assert.ok(score===0 || Object.values(COMPONENTS[key].levels).includes(score));
    assert.equal(record.evidenceSnippets.filter(e=>e.type===COMPONENTS[key].label).length,score>0 ? 1 : 0,`${record.name} ${key} 必须有对应摘录`);
  }
  assertSafe(record);
}
const grades=['S','A','B','C','D','E'];
assert.deepEqual(statistics.gradeDistribution,Object.fromEntries(grades.map(grade=>[grade,faculty.filter(r=>r.evidenceGrade===grade).length])));
assert.equal(statistics.teacherCount,69);
assert.equal(statistics.departmentCount,6);
assert.deepEqual(statistics.departmentDistribution,{'信息管理系':12,'行政管理系':14,'城市管理系':11,'公共政策系':12,'特聘讲席教授':1,'新闻传播系':8,'法学系':11});
console.log(JSON.stringify({passed:true,teacherCount:69,departments:6,distribution:statistics.gradeDistribution},null,2));
