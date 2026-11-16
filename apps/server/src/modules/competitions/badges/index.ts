/**
 * Team badges (PD-ARCH-01G-D; PD-28): routes uploadTeamBadge, getTeamBadgeFile and deleteTeamBadge, and the badge
 * service other modules use to resolve a team's badge by its internal identity (visual template previews, project
 * rendering).
 */
import { ManagedTeamParamsSchema, ManagedTeamSchema, TeamBadgeUploadQuerySchema } from '@edr/contracts';
import type { FastifyInstance } from 'fastify';

import type { AppContainer } from '../../../container.js';
import {
  BRAND_UPLOAD_BODY_LIMIT,
  SANDBOXED_FILE_CONTENT_SECURITY_POLICY,
  binaryBodyRoute,
  routeBodyLimit,
} from '../../../platform/http/index.js';
import { BrandFileStore, resvgDecodeCheck } from '../../brand/index.js';
import { declaredMediaType } from '../../brand/routes.js';
import { contractResponse } from '../../projects/respond.js';

import { TeamBadgeRepository } from './repository.js';
import { TEAM_BADGE_DIRECTORY, TeamBadgeService } from './service.js';

export { badgeJson, badgeOf } from './sql.js';
export { type TeamBadgeRecord } from './repository.js';
export { TEAM_BADGE_DIRECTORY, TeamBadgeService } from './service.js';

/** The badge service of a container. */
export function teamBadgeServiceOf(container: AppContainer, newId?: () => string): TeamBadgeService {
  return new TeamBadgeService({
    repository: new TeamBadgeRepository(container.db),
    files: new BrandFileStore(container.paths.dataDir, {
      directory: TEAM_BADGE_DIRECTORY,
      maxFileBytes: BRAND_UPLOAD_BODY_LIMIT,
    }),
    clock: container.clock,
    decodeCheck: resvgDecodeCheck,
    ...(newId === undefined ? {} : { newId }),
  });
}

/**
 * Registers the badge routes. `team` reads the contract view of a team after a change (the competition module's
 * administration service), so the answer is the team with its new badge.
 */
export function registerTeamBadgeRoutes(
  app: FastifyInstance,
  badges: TeamBadgeService,
  team: (teamId: string) => unknown,
): void {
  app.put(
    '/teams/:teamId/badge',
    { bodyLimit: routeBodyLimit(BRAND_UPLOAD_BODY_LIMIT), config: binaryBodyRoute(['image/png', 'image/jpeg']) },
    async (request) => {
      const { teamId } = ManagedTeamParamsSchema.parse(request.params);
      const query = TeamBadgeUploadQuerySchema.parse(request.query);
      await badges.upload({
        teamId,
        source: query.source,
        declaredMediaType: declaredMediaType(request.headers['content-type']),
        content: request.body,
      });
      return contractResponse(ManagedTeamSchema, team(teamId));
    },
  );

  app.get('/teams/:teamId/badge', async (request, reply) => {
    const { teamId } = ManagedTeamParamsSchema.parse(request.params);
    const { record, content } = await badges.activeFile(teamId);
    return reply
      .header('content-type', record.mime)
      .header('content-security-policy', SANDBOXED_FILE_CONTENT_SECURITY_POLICY)
      .header('cache-control', 'no-store')
      .header(
        'content-disposition',
        `inline; filename="team-badge-${record.id}.${record.mime === 'image/png' ? 'png' : 'jpg'}"`,
      )
      .send(content);
  });

  app.delete('/teams/:teamId/badge', async (request) => {
    const { teamId } = ManagedTeamParamsSchema.parse(request.params);
    badges.retire(teamId);
    return contractResponse(ManagedTeamSchema, team(teamId));
  });
}
