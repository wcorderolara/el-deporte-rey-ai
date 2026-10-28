import { createContext, useContext, type ReactNode } from 'react';

import { defaultReviewApi, type ReviewApi } from './api';

export interface ReviewDependencies {
  api: ReviewApi;
}

const ReviewContext = createContext<ReviewDependencies>({ api: defaultReviewApi });

/** Overrides the API of the feature (component tests inject a client with a fake fetch). */
export function ReviewProvider({ value, children }: { value: ReviewDependencies; children: ReactNode }) {
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviewDependencies(): ReviewDependencies {
  return useContext(ReviewContext);
}
