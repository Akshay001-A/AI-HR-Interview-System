import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("feedback_database")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DATABASE_NAME = os.getenv("DATABASE_NAME", "ai_hr_interview")
COLLECTION_NAME = "feedback"

# In-memory fallback cache when MongoDB is offline
_in_memory_feedback_db: Dict[str, Dict[str, Any]] = {}
_mongo_client = None
_db = None
_collection = None


_checked_connection = False
_has_mongo = False

def is_mongo_reachable(uri: str) -> bool:
    """Instantly checks if MongoDB host/port is reachable before calling PyMongo."""
    if "mongodb+srv://" in uri or "mongodb://" in uri and "localhost" not in uri and "127.0.0.1" not in uri:
        return True # Remote Atlas URI
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.05) # 50ms check
        res = sock.connect_ex(('127.0.0.1', 27017))
        sock.close()
        return res == 0
    except Exception:
        return False

def get_db_client():
    global _mongo_client, _db, _collection, _checked_connection, _has_mongo
    if _collection is not None:
        return _collection
    if _checked_connection:
        return _collection

    _checked_connection = True
    if not is_mongo_reachable(MONGODB_URI):
        logger.info("Local MongoDB not listening on port 27017. Using high-speed in-memory fallback storage.")
        _collection = None
        return None

    try:
        from pymongo import MongoClient
        _mongo_client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=400,
            connectTimeoutMS=400,
            socketTimeoutMS=400
        )
        _mongo_client.admin.command('ping')
        _db = _mongo_client[DATABASE_NAME]
        _collection = _db[COLLECTION_NAME]
        logger.info(f"Connected to MongoDB: database={DATABASE_NAME}, collection={COLLECTION_NAME}")
        return _collection
    except Exception:
        logger.info("MongoDB unavailable. Using resilient in-memory storage fallback.")
        _collection = None
        return None


def save_feedback(report_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves or updates feedback report in MongoDB (or fallback store).
    Uses session_id as the primary key.
    """
    session_id = report_data.get("session_id", "unknown_session")
    report_data_copy = dict(report_data)
    report_data_copy["updated_at"] = datetime.utcnow().isoformat() + "Z"

    col = get_db_client()
    if col is not None:
        try:
            # Upsert into MongoDB
            col.update_one(
                {"session_id": session_id},
                {"$set": report_data_copy},
                upsert=True
            )
            report_data_copy["storage_engine"] = "mongodb"
            return report_data_copy
        except Exception as e:
            logger.error(f"Error persisting to MongoDB: {e}. Falling back to in-memory.")

    # In-memory store
    _in_memory_feedback_db[session_id] = report_data_copy
    report_data_copy["storage_engine"] = "in-memory-fallback"
    return report_data_copy


def get_feedback(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves feedback report for a given session_id.
    """
    col = get_db_client()
    if col is not None:
        try:
            doc = col.find_one({"session_id": session_id})
            if doc:
                # Remove MongoDB _id from returned dictionary
                if "_id" in doc:
                    del doc["_id"]
                return doc
        except Exception as e:
            logger.error(f"Error querying MongoDB: {e}")

    # Check in-memory store
    return _in_memory_feedback_db.get(session_id)


def list_saved_sessions() -> List[str]:
    """
    Returns list of session_ids stored in the system.
    """
    col = get_db_client()
    sessions = set(_in_memory_feedback_db.keys())
    if col is not None:
        try:
            for doc in col.find({}, {"session_id": 1}):
                if "session_id" in doc:
                    sessions.add(doc["session_id"])
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
    return sorted(list(sessions))
