/**
 * @file Problem API
 * @domain problem
 * @layer api
 * @related ProblemService
 */

import { fetchApi } from './client';
import type { Problem, CreateProblemData, UpdateProblemData } from './types';

export const problemApi = {
  findAll: (): Promise<Problem[]> =>
    fetchApi('/api/problems/all'),

  findById: (id: string): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`),

  create: (data: CreateProblemData): Promise<Problem> =>
    fetchApi('/api/problems', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateProblemData): Promise<Problem> =>
    fetchApi(`/api/problems/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  delete: (id: string): Promise<void> =>
    fetchApi(`/api/problems/${id}`, { method: 'DELETE' }),
};
