import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('api-gateway');
setupRedisRpcTracingBridge('api-gateway');
