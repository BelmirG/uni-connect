import redis.asyncio as aioredis
from app.config import settings

# Single shared client — asyncio-safe, connection-pooled
redis = aioredis.from_url(settings.redis_url, decode_responses=True)
