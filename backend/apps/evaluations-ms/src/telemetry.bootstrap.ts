import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('evaluations-ms');
setupRedisRpcTracingBridge('evaluations-ms');
