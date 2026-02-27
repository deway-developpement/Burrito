import { initOpenTelemetry, setupRedisRpcTracingBridge } from '@app/common';

initOpenTelemetry('groups-ms');
setupRedisRpcTracingBridge('groups-ms');
