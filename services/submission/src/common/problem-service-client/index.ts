/**
 * @file index.ts -- problem-service-client 배럴 export
 * @domain common
 * @layer barrel
 * @related problem-service-client.module.ts, problem-service-client.ts
 */

export { ProblemServiceClientModule } from './problem-service-client.module';
export {
  ProblemServiceClient,
  type ProblemOp,
  type ProblemRequest,
  type DeadlineResult,
} from './problem-service-client';
