"""Durable report storage. No silent in-memory fallback or fabricated saved state."""
import json
import sqlite3
from copy import deepcopy
from functools import lru_cache
from backend.config import get_settings


class StorageUnavailable(Exception):
    pass


@lru_cache
def mongo_collection():
    from pymongo import MongoClient
    settings = get_settings()
    client = MongoClient(settings.mongodb_uri.get_secret_value(), serverSelectionTimeoutMS=1500,
                         connectTimeoutMS=1500, socketTimeoutMS=1500)
    client.admin.command('ping')
    collection = client[settings.database_name]['feedback']
    collection.create_index('session_id', unique=True)
    return collection


def sqlite_connection():
    path = get_settings().sqlite_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(str(path), timeout=5)
    connection.execute('CREATE TABLE IF NOT EXISTS feedback (session_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, report TEXT NOT NULL)')
    return connection


def save_feedback(report):
    data = deepcopy(report)
    engine = get_settings().storage_backend
    data['storage'] = {'saved': True, 'engine': engine, 'message': 'Report saved.'}
    try:
        if engine == 'mongodb':
            mongo_collection().replace_one({'session_id': data['session_id']}, data, upsert=True)
            data.pop('_id', None)
        else:
            with sqlite_connection() as db:
                db.execute('INSERT INTO feedback VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET created_at=excluded.created_at, report=excluded.report',
                    (data['session_id'], data['created_at'], json.dumps(data)))
        return data
    except Exception:
        raise StorageUnavailable('Report storage is unavailable.') from None


def get_feedback(session_id):
    try:
        if get_settings().storage_backend == 'mongodb':
            return mongo_collection().find_one({'session_id': session_id}, {'_id': 0})
        with sqlite_connection() as db:
            row = db.execute('SELECT report FROM feedback WHERE session_id=?', (session_id,)).fetchone()
            return json.loads(row[0]) if row else None
    except Exception:
        raise StorageUnavailable('Report storage is unavailable.') from None


def list_saved_sessions(limit=50, offset=0):
    try:
        if get_settings().storage_backend == 'mongodb':
            return list(mongo_collection().find({}, {'_id': 0, 'session_id': 1, 'role': 1, 'overall_score': 1, 'created_at': 1}).sort('created_at', -1).skip(offset).limit(limit))
        with sqlite_connection() as db:
            rows = db.execute('SELECT report FROM feedback ORDER BY created_at DESC, session_id LIMIT ? OFFSET ?', (limit, offset)).fetchall()
            return [{key: doc[key] for key in ('session_id', 'role', 'overall_score', 'created_at')} for (raw,) in rows for doc in [json.loads(raw)]]
    except Exception:
        raise StorageUnavailable('Report storage is unavailable.') from None
