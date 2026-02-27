import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('users-ms');
setupRedisRpcTracingBridge('users-ms');
