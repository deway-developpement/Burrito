import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('forms-ms');
setupRedisRpcTracingBridge('forms-ms');
