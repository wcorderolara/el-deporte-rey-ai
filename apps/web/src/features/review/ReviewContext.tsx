import { createContext, useContext, type ReactNode } from 'react';

import { defaultReviewApi, type ReviewApi } from './api';
import { defaultEditorialApi, type EditorialApi } from './editorial/api';

export interface ReviewDependencies {
  api: ReviewApi;
  /** Editorial copy of the project (PD-ARCH-01H); the running application's API when absent. */
  editorial?: EditorialApi;
}

const ReviewContext = createContext<ReviewDependencies>({ api: defaultReviewApi, editorial: defaultEditorialApi });

/** Overrides the API of the feature (component tests inject a client with a fake fetch). */
export function ReviewProvider({ value, children }: { value: ReviewDependencies; children: ReactNode }) {
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviewDependencies(): ReviewDependencies {
  return useContext(ReviewContext);
}
