import test from 'node:test'
import assert from 'node:assert/strict'
import { readInterview, validateReport, MAX_BYTES, CRITERIA } from './feedback.js'

test('completed answers accepted, corrupt/empty/plan/draft reports rejected',()=>{
 assert.equal(readInterview('{"answers":[{}]}').answers.length,1)
 for(const value of ['no','null','[]','{}','{"answers":[]}','{"answers":[{}],"draft_version":1}','{"answers":[{}],"plan_id":"p"}']) assert.throws(()=>readInterview(value))
})
test('UTF-8 upload bound protects multibyte files',()=>{
 assert.throws(()=>readInterview('x'.repeat(MAX_BYTES+1)),/2 MB/)
 assert.throws(()=>readInterview('界'.repeat(Math.ceil(MAX_BYTES/3)+1)),/2 MB/)
})
function report(){return {report_version:'2.0',session_id:'s',generation:{source:'gemini'},overall_score:0,criteria_averages:Object.fromEntries(CRITERIA.map(k=>[k,0])),storage:{saved:true,engine:'sqlite',message:'Saved'},created_at:'2026-01-01T00:00:00Z',notice:'Practice feedback',role:'Developer',communication_analysis:{word_count:1,filler_word_count:0,filler_breakdown:{},notice:'Text only',timing_notice:'No speech timing'},recommendations:['Practise'],evaluations:[{question_id:'q1',question:'Question?',answer:'Answer',score:0,criteria:Object.fromEntries(CRITERIA.map(k=>[k,0])),strengths:['Clear action'],weaknesses:['Add outcome'],answer_template:'[your action]'}]}}
test('real zero scores remain zero',()=>assert.equal(validateReport(report()).evaluations[0].score,0))
test('invented or malformed report shapes rejected',()=>{
 for(const mutate of [r=>r.generation.source='demo',r=>r.overall_score=101,r=>r.evaluations=[],r=>r.evaluations[0].criteria.clarity=-1,r=>delete r.storage.saved]){const r=report();mutate(r);assert.throws(()=>validateReport(r))}
})
