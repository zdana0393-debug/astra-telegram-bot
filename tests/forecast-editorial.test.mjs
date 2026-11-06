import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import c from '../data/forecast/catalog.v1.json' with {type:'json'};
import {createForecastGenerator,validateSelection,SECTIONS,ENGINE_VERSION,NUMBER_VERSION} from '../src/forecast/engine.mjs';
const generate=createForecastGenerator(c);
const all=[...c.units,...c.sign_lenses,...c.modality_lenses];
test('every theme/section has four substantive elemental readings, without universal fallbacks',()=>{
  assert.equal(c.units.length,192);assert.equal(c.sign_lenses.length,216);assert.equal(c.modality_lenses.length,54);
  for(const theme of c.themes)for(const section of SECTIONS){
    const rows=c.units.filter(u=>u.theme===theme.id&&u.section===section);
    assert.deepEqual(rows.map(u=>u.element).sort(),['air','earth','fire','water']);
    assert.equal(new Set(rows.map(u=>u.body)).size,4);
    // Removing element names does not turn the readings into a prefixed common text.
    assert.equal(new Set(rows.map(u=>u.body.replace(/ог[а-я]+|зем[а-я]+|возд[а-я]+|вод[а-я]+/giu,''))).size,4);
  }
  assert.equal(new Set(all.map(u=>u.body)).size,all.length);
});
test('sign readings carry the actual element and modality in all six sections',()=>{
  for(const sign of c.signs)for(const section of SECTIONS){
    const rows=c.sign_lenses.filter(u=>u.sign_id===sign.sign_id&&u.section===section);
    assert.equal(rows.length,3);assert.ok(rows.every(u=>u.element===sign.element_id&&u.modality===sign.modality_id));
  }
  assert.equal(ENGINE_VERSION,'forecast-1.0.0');assert.equal(NUMBER_VERSION,'legacy-hash-v1');assert.equal(c.content_version,'2026.11-v1');
});
for(const [axis,positive,negative,group,section] of [
  ['timing','commit','observe',c.sign_lenses,'action'],
  ['contact','open','quiet',c.modality_lenses,'relations']
])test(`independent ${axis} conflict rejects actual opposed readings under the same theme`,()=>{
  const sign=c.signs[0],theme=c.themes[0],base=c.units.filter(u=>u.theme===theme.id&&u.element===sign.element_id);
  const readings=group.filter(u=>u.modality===sign.modality_id&&u.section===section&&(!u.sign_id||u.sign_id===sign.sign_id));
  const yes=readings.find(u=>u.directives[axis]===positive),no=readings.find(u=>u.directives[axis]===negative);
  assert.ok(yes&&no);validateSelection([...base,yes],sign,theme,{[axis]:positive});
  assert.throws(()=>validateSelection([...base,yes,no],sign,theme),new RegExp('directive: '+axis));
  assert.throws(()=>validateSelection([...base,no],sign,theme,{[axis]:positive}),/Conflicting/);
});
test('one date differentiates all twelve signs in every section below the heading',()=>{
  for(const section of SECTIONS){const paragraphs=new Set();for(const sign of c.signs){
    const f=generate(sign.sign_id,'2026-11-07');const chosen=all.filter(u=>[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses].includes(u.id)&&u.section===section);
    paragraphs.add(chosen.map(u=>u.body).join(' '));
    assert.equal(chosen.filter(u=>u.sign_id===sign.sign_id).length,1);
  }assert.equal(paragraphs.size,12);}
});
test('90-day interpretation traces exercise both independent axes and all reading banks',()=>{
  const seen=new Set(),axes={timing:new Set(),contact:new Set()};
  for(let i=0;i<90;i++)for(const sign of c.signs){const day=new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10),f=generate(sign.sign_id,day),tags=JSON.parse(f.source_tags);
    const ids=[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses];ids.forEach(id=>seen.add(id));
    const rows=ids.map(id=>all.find(u=>u.id===id));validateSelection(rows,sign,c.themes.find(t=>t.id===f.trace.theme),tags.directives);
    for(const axis of Object.keys(axes))axes[axis].add(tags.directives[axis]);
    assert.equal(f.trace.sign_lenses.length,6);assert.equal(f.trace.modality_lenses.length,2);
  }
  for(const axis of Object.values(axes))assert.equal(axis.size,2);
  assert.equal(seen.size,all.length);
});

test('traditional rulers and sign qualities agree across all twelve profiles',()=>{
  const expected=[['aries','fire','cardinal','Марс'],['taurus','earth','fixed','Венера'],['gemini','air','mutable','Меркурий'],['cancer','water','cardinal','Луна'],['leo','fire','fixed','Солнце'],['virgo','earth','mutable','Меркурий'],['libra','air','cardinal','Венера'],['scorpio','water','fixed','Марс'],['sagittarius','fire','mutable','Юпитер'],['capricorn','earth','cardinal','Сатурн'],['aquarius','air','fixed','Сатурн'],['pisces','water','mutable','Юпитер']];
  for(const [id,element,modality,ruler] of expected){const sign=c.signs.find(s=>s.sign_id===id);assert.deepEqual([sign.element_id,sign.modality_id,sign.ruler],[element,modality,ruler]);}
});
test('single-file Worker renders exactly the source generator for free and paid editorial samples',()=>{
  const source=fs.readFileSync(new URL('../release/ASTRA_2_3B_WORKER.js',import.meta.url),'utf8');
  const bundled=vm.runInNewContext(source.replace('export default {','globalThis.worker = {')+'\n;createForecastGenerator(catalog);',{structuredClone});
  for(const sign of c.signs)for(const date of ['2026-11-07','2026-11-08','2026-11-09','2026-11-10']){
    const a=generate(sign.sign_id,date),b=bundled(sign.sign_id,date);
    for(const key of ['free_text','extended_text','number','source_tags','engine_version','content_version','number_algorithm_version'])assert.equal(b[key],a[key]);
  }
});

test('curated editorial echo pairs are rejected and never selected together',()=>{
  assert.equal(c.editorial_exclusions.length,10);
  for(const {a,b,reason} of c.editorial_exclusions){
    const ua=all.find(u=>u.id===a),ub=all.find(u=>u.id===b);assert.ok(ua&&ub&&reason);
    const sign=c.signs.find(s=>s.sign_id===(ua.sign_id||ub.sign_id))||c.signs.find(s=>s.element_id===ua.element&&s.modality_id===ub.modality);
    const theme=c.themes.find(t=>t.id===ua.theme)||c.themes[0];
    const base=c.units.filter(u=>u.theme===theme.id&&u.element===sign.element_id);
    assert.throws(()=>validateSelection([...base,ua,ub],sign,theme),/Conflicting/);
    for(let i=0;i<90;i++){
      const f=generate(sign.sign_id,new Date(Date.UTC(2026,10,i+1)).toISOString().slice(0,10));
      const ids=[...f.trace.units,...f.trace.sign_lenses,...f.trace.modality_lenses];assert.ok(!(ids.includes(a)&&ids.includes(b)));
    }
  }
});
