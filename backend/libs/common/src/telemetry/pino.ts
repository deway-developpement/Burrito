import { getActiveTraceLogFields } from './telemetry';

export function createPinoHttpOptions(serviceName: string) {
  return {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    base: { service: serviceName },
    autoLogging: false,
    redact: ['req.headers.authorization'],
    customProps: () => getActiveTraceLogFields(),
  };
}
