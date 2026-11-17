"""Contract, provider, HTTP and durable storage regressions. No live API calls."""
from copy import deepcopy
import json
from pathlib import Path
from types import SimpleNamespace
import httpx
import pytest
from fastapi.testclient import TestClient
from google import genai
from google.genai import errors, types
from pydantic import SecretStr, ValidationError
from backend.config import get_settings
from backend.contracts import CompletedInterview, ProposedReport
from backend.main import app
from modules.feedback_engine.backend import database, evaluation_service as ai, feedback_service

REAL_CLIENT = genai.Client
REAL_CALL = ai.call_provider


@pytest.fixture
def payload():
    return {'schema_version':'1.0','session_id':'review_test','role':'Software Developer','category':'HR','difficulty':'Beginner','question_count':1,
      'resume_profile':{'skills':['Teamwork'],'projects':['Organized a student team']},
      'job_description':{'text':'Collaborate across a team and take ownership of deadlines.','required_skills':['Communication']},
      'questions':[{'question_id':'q1','question':'Describe a team deadline you handled?'}],
      'answers':[{'question_id':'q1','answer':'I clarified responsibilities with my team and agreed on a shared deadline.','input_mode':'text','duration_seconds':90}]}


def proposal(session, zero=False):
    return ProposedReport.model_validate({'evaluations':[{'question_id':a.question_id,
      'criteria':{key:0 if zero else 72 for key in ['relevance','clarity','structure','completeness','examples']},
      'strengths':['Describes a shared deadline.'],'weaknesses':['Explain your own action and outcome.'],
      'answer_template':'When [actual situation], I [your action], resulting in [actual outcome].'} for a in session.answers],
      'recommendations':['Practise explaining your own actions and outcomes.']})


@pytest.fixture(autouse=True)
def isolate(monkeypatch, tmp_path):
    settings = get_settings()
    monkeypatch.setattr(settings,'gemini_api_key',SecretStr('test-key'))
    monkeypatch.setattr(settings,'sqlite_path',tmp_path/'reports.sqlite3')
    monkeypatch.setattr(settings,'storage_backend','sqlite')
    monkeypatch.setattr(settings,'gemini_model','primary')
    monkeypatch.setattr(settings,'gemini_fallback_models',['secondary'])
    ai.COOLDOWNS.clear()
    monkeypatch.setattr(ai,'call_provider',lambda *args: (_ for _ in ()).throw(AssertionError('Unexpected provider call')))
    yield
    ai.COOLDOWNS.clear()


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def configure(monkeypatch, zero=False):
    monkeypatch.setattr(ai,'call_provider',lambda session,*args:proposal(session,zero))


def test_current_question_list_normalized_without_mutation(client,payload):
    original=deepcopy(payload)
    response=client.post('/api/feedback/validate',json=payload)
    assert response.status_code==200,response.text
    assert response.json()['answers'][0]['question']==payload['questions'][0]['question']
    assert payload==original


def test_legacy_contract_accepted(client):
    payload=json.loads(Path('contracts/interview.json').read_text())
    assert client.post('/api/feedback/validate',json=payload).status_code==200


def test_direct_answer_question_text_is_accepted(client,payload):
    payload['answers'][0]['question']=payload['questions'][0]['question']
    assert client.post('/api/feedback/validate',json=payload).status_code==200


@pytest.mark.parametrize('case',['empty','blank','duplicate','mismatch','missing','invalid_duration','wrong_id','bad_category','bad_count','unknown_version','plan'])
def test_invalid_sessions_rejected_before_ai(client,payload,case):
    if case=='empty':payload['answers']=[]
    if case=='blank':payload['answers'][0]['answer']='   '
    if case=='duplicate':payload['answers']*=2
    if case=='mismatch':payload['answers'][0]['question']='Different question'
    if case=='missing':payload['answers'][0].pop('answer')
    if case=='invalid_duration':payload['answers'][0]['duration_seconds']=-1
    if case=='wrong_id':payload['answers'][0]['question_id']='other'
    if case=='bad_category':payload['category']='Coding'
    if case=='bad_count':payload['question_count']=2
    if case=='unknown_version':payload['schema_version']='9.0'
    if case=='plan':payload['plan_id']='plan_1'
    assert client.post('/api/feedback/evaluate',json=payload).status_code==422


def test_followup_and_answer_order_preserved(client,payload,monkeypatch):
    configure(monkeypatch)
    payload['questions'].append({'question_id':'q1_followup','question':'How did your team respond?','parent_question_id':'q1'})
    payload['answers'].append({'question_id':'q1_followup','answer':'We agreed on the deadline and checked progress together.','input_mode':'voice'})
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==200,response.text
    report=response.json()
    assert [e['question_id'] for e in report['evaluations']]==['q1','q1_followup']
    assert report['evaluations'][1]['parent_question_id']=='q1'
    assert 'speaking_metrics' not in report['communication_analysis']


def test_zero_scores_saved_and_retrievable(client,payload,monkeypatch):
    configure(monkeypatch,zero=True)
    report=client.post('/api/feedback/evaluate',json=payload).json()
    assert report['overall_score']==0
    assert report['criteria_averages']['relevance']==0
    assert report['storage']=={'saved':True,'engine':'sqlite','message':'Report saved.'}
    assert client.get('/api/feedback/report/review_test').json()==report
    history=client.get('/api/feedback/history').json()
    assert history['sessions'][0]['overall_score']==0
    assert client.get('/api/feedback/history?limit=0').status_code==422
    assert client.get('/api/feedback/report/missing').status_code==404


def test_save_failure_returns_real_report_unsaved(client,payload,monkeypatch):
    configure(monkeypatch)
    def fail(report):raise database.StorageUnavailable()
    monkeypatch.setattr(feedback_service,'save_feedback',fail)
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==200
    assert response.json()['storage']['saved'] is False
    assert client.get('/api/feedback/history').json()['sessions']==[]


def test_mongodb_failure_is_not_memory_success(client,payload,monkeypatch):
    configure(monkeypatch)
    monkeypatch.setattr(get_settings(),'storage_backend','mongodb')
    def fail():raise RuntimeError('private-uri')
    monkeypatch.setattr(database,'mongo_collection',fail)
    report=client.post('/api/feedback/evaluate',json=payload).json()
    assert report['storage']['saved'] is False
    response=client.get('/api/feedback/history')
    assert response.status_code==503 and 'private-uri' not in response.text


def test_missing_key_no_scores(client,payload,monkeypatch):
    monkeypatch.setattr(get_settings(),'gemini_api_key',SecretStr(''))
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==503 and 'overall_score' not in response.json()


@pytest.mark.parametrize('code',[400,401,403,429])
def test_auth_and_quota_stop_without_fallback(client,payload,monkeypatch,code):
    calls=[]
    def fail(*args):
        calls.append(1)
        raise errors.APIError(code,{'error':{'message':'private-secret','code':code}})
    monkeypatch.setattr(ai,'call_provider',fail)
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==(429 if code==429 else 502)
    assert len(calls)==1 and 'private-secret' not in response.text
    assert 'overall_score' not in response.json()


@pytest.mark.parametrize('code',[404,500,502,503,504])
def test_transient_failover(client,payload,monkeypatch,code):
    calls=[]
    def call(session,model,timeout):
        calls.append(model)
        if model=='primary':raise errors.APIError(code,{'error':{'message':'private','code':code}})
        return proposal(session)
    monkeypatch.setattr(ai,'call_provider',call)
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==200,response.text
    assert calls==['primary','secondary']
    assert response.json()['generation']['attempt_count']==2


def test_invalid_generated_ids_never_saved(client,payload,monkeypatch):
    def invalid(session,*args):
        report=proposal(session);report.evaluations[0].question_id='made_up';return report
    monkeypatch.setattr(ai,'call_provider',invalid)
    assert client.post('/api/feedback/evaluate',json=payload).status_code==502
    assert client.get('/api/feedback/history').json()['sessions']==[]


def test_invalid_generated_score_rejected():
    with pytest.raises(ValidationError):
        from backend.contracts import Rubric
        Rubric(relevance=101,clarity=1,structure=1,completeness=1,examples=1)


def test_sdk_schema_full_context_and_instructions(client,payload,monkeypatch):
    captured=[]
    payload['resume_context']='Student teamwork project with weekly planning sessions.'
    def respond(request):
        body=json.loads(request.content);captured.append(body)
        context=json.loads(body['contents'][0]['parts'][0]['text'])
        assert context['resume_context']==payload['resume_context']
        assert context['job_description']['text']==payload['job_description']['text']
        assert context['answers'][0]['question']==payload['questions'][0]['question']
        assert 'untrusted reference data' in body['systemInstruction']['parts'][0]['text']
        assert 'responseJsonSchema' in body['generationConfig']
        result=proposal(CompletedInterview.model_validate(payload))
        return httpx.Response(200,json={'candidates':[{'content':{'role':'model','parts':[{'text':result.model_dump_json()}]},'finishReason':'STOP'}]})
    def client_factory(**kwargs):
        return REAL_CLIENT(api_key=kwargs['api_key'],http_options=types.HttpOptions(httpx_client=httpx.Client(transport=httpx.MockTransport(respond)),retry_options=types.HttpRetryOptions(attempts=1)))
    monkeypatch.setattr(ai.genai,'Client',client_factory)
    monkeypatch.setattr(ai,'call_provider',REAL_CALL)
    assert client.post('/api/feedback/evaluate',json=payload).status_code==200
    assert len(captured)==1


def test_body_limit_and_cors(client):
    assert client.post('/api/feedback/validate',content='x'*(2*1024*1024+1)).status_code==413
    response=client.options('/api/feedback/evaluate',headers={'Origin':'https://unknown.example','Access-Control-Request-Method':'POST'})
    assert response.status_code==400


def test_storage_persists_on_new_connection(payload):
    report={'session_id':'durable','role':'Developer','overall_score':0,'created_at':'2026-01-01T00:00:00Z'}
    database.save_feedback(report)
    assert database.get_feedback('durable')['overall_score']==0
    assert database.list_saved_sessions()[0]['session_id']=='durable'


@pytest.mark.parametrize('case',['orphan','followup_of_followup','repeated_parent','excess'])
def test_invalid_followup_structure(client,payload,case):
    payload['questions'].append({'question_id':'f1','question':'What happened next?','parent_question_id':'q1'})
    payload['answers'].append({'question_id':'f1','answer':'We reviewed the result together.','input_mode':'text'})
    if case=='orphan':payload['questions'][1]['parent_question_id']='missing'
    elif case=='followup_of_followup':
        payload['questions'].append({'question_id':'f2','question':'How did that feel?','parent_question_id':'f1'})
        payload['answers'].append({'question_id':'f2','answer':'I felt ready to continue.','input_mode':'text'})
    elif case=='repeated_parent':
        payload['questions'].append({'question_id':'f2','question':'What did you learn?','parent_question_id':'q1'})
        payload['answers'].append({'question_id':'f2','answer':'I learned to clarify roles.','input_mode':'text'})
    else:payload['question_count']=True
    assert client.post('/api/feedback/evaluate',json=payload).status_code==422


def test_model_cooldown_skips_recent_failure(client,payload,monkeypatch):
    calls=[]
    def call(session,model,timeout):
        calls.append(model)
        if model=='primary':raise errors.APIError(503,{'error':{'code':503,'message':'busy'}})
        return proposal(session)
    monkeypatch.setattr(ai,'call_provider',call)
    assert client.post('/api/feedback/evaluate',json=payload).status_code==200
    assert client.post('/api/feedback/evaluate',json=payload).status_code==200
    assert calls==['primary','secondary','secondary']


def test_maximum_twenty_provider_attempts(client,payload,monkeypatch):
    monkeypatch.setattr(get_settings(),'gemini_fallback_models',[f'model_{i}' for i in range(30)])
    calls=[]
    def fail(*args):calls.append(1);raise ValueError('invalid output')
    monkeypatch.setattr(ai,'call_provider',fail)
    assert client.post('/api/feedback/evaluate',json=payload).status_code==502
    assert len(calls)==20


def test_request_deadline_stops_calls(client,payload,monkeypatch):
    monkeypatch.setattr(get_settings(),'gemini_request_budget_seconds',5)
    ticks=iter([0,0,6,6,6,6])
    monkeypatch.setattr(ai,'monotonic',lambda:next(ticks,6))
    assert client.post('/api/feedback/evaluate',json=payload).status_code==504


def test_busy_rejects_without_provider(client,payload,monkeypatch):
    from threading import BoundedSemaphore
    monkeypatch.setattr(ai,'SLOTS',BoundedSemaphore(0))
    response=client.post('/api/feedback/evaluate',json=payload)
    assert response.status_code==429 and response.headers['retry-after']=='5'


def test_mongo_success_stores_saved_metadata(payload,monkeypatch):
    stored={}
    class Collection:
        def replace_one(self,query,document,upsert):
            assert upsert and document['storage']['saved'] is True
            stored.update(deepcopy(document))
        def find_one(self,query,projection):return deepcopy(stored)
    monkeypatch.setattr(get_settings(),'storage_backend','mongodb')
    monkeypatch.setattr(database,'mongo_collection',lambda:Collection())
    result=database.save_feedback({'session_id':'mongo-test','created_at':'2026-01-01','role':'Developer','overall_score':0})
    assert result['storage']['engine']=='mongodb'
    assert database.get_feedback('mongo-test')['storage']['saved'] is True


def test_word_counts_have_no_inferred_voice_scores():
    from modules.feedback_engine.backend.communication_service import analyze_communication
    result=analyze_communication([{'question_id':'q1','answer':'I actually like working with my team.','input_mode':'voice','duration_seconds':1}])
    assert result['word_count']==7 and result['filler_word_count']==2
    assert 'speaking_metrics' not in result and 'grammar_score' not in result and 'overall_clarity' not in result
