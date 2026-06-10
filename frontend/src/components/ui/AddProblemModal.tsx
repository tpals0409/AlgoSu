/**
 * @file Add Problem modal — back-compat re-export shim
 * @domain problem
 * @layer component
 * @related ./add-problem/AddProblemModal
 *
 * The implementation moved to `./add-problem/` during the Sprint 242 Q-1 FE
 * decomposition. This shim keeps existing consumers (`@/components/ui/
 * AddProblemModal`) working without any call-site changes — the original
 * named export and the public types are forwarded verbatim.
 */
export { AddProblemModal } from './add-problem/AddProblemModal';
export type {
  NewProblemData,
  SolvedProblem,
  Platform,
} from './add-problem/AddProblemModal';
