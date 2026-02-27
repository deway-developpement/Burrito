import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('analytics-ms');
setupRedisRpcTracingBridge('analytics-ms');
