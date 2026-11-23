import { getRedisClient } from './redis.js';

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, 3600)
end

if current > limit then
    return {0, current}
else
    return {1, current}
end
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  rescheduleDelayMs: number;
  shouldNotifySlack: boolean;
}

export async function checkAndConsumeRateLimit(
  senderId: number,
  limit: number
): Promise<RateLimitCheckResult> {
  const redis = getRedisClient();
  const currentHourBucket = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:sender:${senderId}:${currentHourBucket}`;

  // Execute atomic Lua script
  const [allowedRaw, currentCountRaw] = (await redis.eval(
    RATE_LIMIT_LUA,
    1,
    key,
    limit
  )) as [number, number];

  const allowed = allowedRaw === 1;
  const currentCount = currentCountRaw;

  // Calculate delay until next hour window + 5s buffer
  const nextHourMs = (currentHourBucket + 1) * 3600000;
  const rescheduleDelayMs = Math.max(5000, nextHourMs - Date.now() + 5000);

  let shouldNotifySlack = false;
  if (!allowed) {
    // Check if we've already notified Slack for this sender during this hour
    const notifiedKey = `ratelimit:notified:${senderId}:${currentHourBucket}`;
    const alreadyNotified = await redis.set(notifiedKey, '1', 'EX', 3600, 'NX');
    if (alreadyNotified === 'OK') {
      shouldNotifySlack = true;
    }
  }

  return {
    allowed,
    currentCount,
    limit,
    rescheduleDelayMs,
    shouldNotifySlack,
  };
}

export async function getSenderCurrentHourCount(senderId: number): Promise<number> {
  const redis = getRedisClient();
  const currentHourBucket = Math.floor(Date.now() / 3600000);
  const key = `ratelimit:sender:${senderId}:${currentHourBucket}`;
  const val = await redis.get(key);
  return val ? parseInt(val, 10) : 0;
}
