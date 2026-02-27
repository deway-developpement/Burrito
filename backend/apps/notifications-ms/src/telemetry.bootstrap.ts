import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('notifications-ms');
setupRedisRpcTracingBridge('notifications-ms');
