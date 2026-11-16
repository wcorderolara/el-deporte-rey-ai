import type { ManagedTeam } from '@edr/contracts';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../api/client';
import { createCompetitionsApi } from './api';
import { TeamBadge, teamBadgeUrl } from './TeamBadge';
import { MAX_BADGE_BYTES, TeamBadgeManager, badgeCopy } from './TeamBadgeManager';

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no object URLs; the upload preview only needs a stable value.
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() });
});

const team: ManagedTeam = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Club Uno',
  displayName: null,
  region: null,
  badge: null,
  createdAt: '2026-10-30T12:00:00Z',
  updatedAt: '2026-10-30T12:00:00Z',
};
const badge = {
  id: '99999999-9999-4999-8999-999999999999',
  origin: 'manual' as const,
  source: 'Sitio oficial del club',
  mime: 'image/png' as const,
  width: 512,
  height: 480,
  sha256: 'a'.repeat(64),
  uploadedAt: '2026-11-01T10:00:00Z',
};
const withBadge: ManagedTeam = { ...team, badge };

const FILE_LABEL = new RegExp(`^${badgeCopy.file}`);

function imageFile(name: string, type: string, size = 2048): File {
  return new File([new Uint8Array(size)], name, { type });
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('TeamBadge (PD-ARCH-01G-D)', () => {
  it('draws the uploaded badge scaled to fit and never invents one', () => {
    const { rerender } = render(<TeamBadge team={team} />);
    expect(screen.getByTestId('team-badge').dataset['badge']).toBe('none');
    expect(screen.getByTestId('team-badge').querySelector('img')).toBeNull();

    rerender(<TeamBadge team={withBadge} decorative={false} size="lg" />);
    const image = screen.getByRole('img', { name: 'Escudo de Club Uno' });
    expect(image.getAttribute('src')).toBe(`/api/v1/teams/${team.id}/badge?v=${badge.id}`);
    expect(image.className).toContain('object-contain');
    expect(screen.getByTestId('team-badge').dataset['badge']).toBe('image');

    // A replaced badge gets another address, so the browser never reuses the previous image.
    const replaced = { ...badge, id: '88888888-8888-4888-8888-888888888888' };
    rerender(<TeamBadge team={{ ...withBadge, badge: replaced }} decorative={false} size="lg" />);
    expect(screen.getByRole('img', { name: 'Escudo de Club Uno' }).getAttribute('src')).toBe(
      `/api/v1/teams/${team.id}/badge?v=${replaced.id}`,
    );
  });

  it('falls back to the neutral outline when the image cannot be loaded', () => {
    render(<TeamBadge team={withBadge} />);
    const holder = screen.getByTestId('team-badge');
    fireEvent.error(holder.querySelector('img') as HTMLImageElement);
    expect(holder.dataset['badge']).toBe('none');
    expect(holder.querySelector('img')).toBeNull();
  });

  it('builds the badge address of a team, distinct for every badge', () => {
    expect(teamBadgeUrl(team.id, badge.id)).toBe(`/api/v1/teams/${team.id}/badge?v=${badge.id}`);
  });
});

describe('competitions API badge operations (PD-ARCH-01G-D)', () => {
  it('uploads the file as is with its source and the confirmed authorization', async () => {
    const fetch = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => json(withBadge));
    const api = createCompetitionsApi(createApiClient({ fetch }));
    const file = imageFile('escudo.png', 'image/png');
    await expect(api.uploadTeamBadge(team.id, { file, source: 'Sitio oficial del club' })).resolves.toEqual(withBadge);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe('PUT');
    expect(url).toBe(`/api/v1/teams/${team.id}/badge?source=Sitio+oficial+del+club&authorized=true`);
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('image/png');
    expect(init?.body).toBe(file);
  });

  it('rejects a file that is not PNG or JPEG without calling the server', async () => {
    const fetch = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
    const api = createCompetitionsApi(createApiClient({ fetch }));
    await expect(
      api.uploadTeamBadge(team.id, { file: imageFile('escudo.svg', 'image/svg+xml'), source: 'Club' }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retires the active badge', async () => {
    const fetch = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () => json(team));
    const api = createCompetitionsApi(createApiClient({ fetch }));
    await expect(api.deleteTeamBadge(team.id)).resolves.toEqual(team);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(init?.method).toBe('DELETE');
    expect(url).toBe(`/api/v1/teams/${team.id}/badge`);
  });
});

describe('TeamBadgeManager (PD-ARCH-01G-D)', () => {
  it('requires the file, its source and the authorization before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const uploadTeamBadge = vi.fn().mockResolvedValue(withBadge);
    const onChanged = vi.fn();
    render(<TeamBadgeManager team={team} api={{ uploadTeamBadge, deleteTeamBadge: vi.fn() }} onChanged={onChanged} />);
    expect(screen.getByText(badgeCopy.none)).toBeTruthy();
    expect(screen.queryByRole('button', { name: badgeCopy.retire })).toBeNull();

    await user.click(screen.getByRole('button', { name: badgeCopy.upload }));
    const form = screen.getByRole('button', { name: badgeCopy.upload }).closest('form') as HTMLFormElement;
    await user.click(within(form).getByRole('button', { name: badgeCopy.upload }));
    expect(screen.getByText(badgeCopy.fileRequired)).toBeTruthy();
    expect(screen.getByText(badgeCopy.sourceRequired)).toBeTruthy();
    expect(screen.getByText(badgeCopy.authorizeRequired)).toBeTruthy();

    await user.upload(screen.getByLabelText(FILE_LABEL), imageFile('escudo.gif', 'image/gif'));
    await user.click(within(form).getByRole('button', { name: badgeCopy.upload }));
    expect(screen.getByText(badgeCopy.fileType)).toBeTruthy();

    await user.upload(screen.getByLabelText(FILE_LABEL), imageFile('grande.png', 'image/png', MAX_BADGE_BYTES + 1));
    await user.click(within(form).getByRole('button', { name: badgeCopy.upload }));
    expect(screen.getByText(badgeCopy.fileTooLarge)).toBeTruthy();
    expect(uploadTeamBadge).not.toHaveBeenCalled();

    const file = imageFile('escudo.png', 'image/png');
    await user.upload(screen.getByLabelText(FILE_LABEL), file);
    expect(screen.getByRole('img', { name: badgeCopy.previewAlt }).getAttribute('src')).toBe('blob:preview');
    await user.type(screen.getByRole('textbox', { name: badgeCopy.sourceLabel }), '  Sitio oficial del club ');
    await user.click(screen.getByRole('checkbox', { name: badgeCopy.authorize }));
    await user.click(within(form).getByRole('button', { name: badgeCopy.upload }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(withBadge));
    expect(uploadTeamBadge).toHaveBeenCalledWith(team.id, { file, source: 'Sitio oficial del club' });
  });

  it('shows the active badge and retires it only after a confirmation', async () => {
    const user = userEvent.setup();
    const deleteTeamBadge = vi.fn().mockResolvedValue(team);
    const onChanged = vi.fn();
    render(
      <TeamBadgeManager team={withBadge} api={{ uploadTeamBadge: vi.fn(), deleteTeamBadge }} onChanged={onChanged} />,
    );
    expect(screen.getByText('Sitio oficial del club')).toBeTruthy();
    expect(screen.getByText(badgeCopy.manual)).toBeTruthy();
    expect(screen.getByText('512 × 480 px · PNG')).toBeTruthy();
    expect(screen.getByRole('button', { name: badgeCopy.replace })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: badgeCopy.retire }));
    expect(screen.getByText(badgeCopy.retireQuestion('Club Uno'))).toBeTruthy();
    expect(deleteTeamBadge).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: badgeCopy.cancel }));
    expect(screen.queryByText(badgeCopy.retireQuestion('Club Uno'))).toBeNull();

    await user.click(screen.getByRole('button', { name: badgeCopy.retire }));
    await user.click(screen.getByRole('button', { name: badgeCopy.retireConfirm }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(team));
    expect(deleteTeamBadge).toHaveBeenCalledWith(team.id);
  });

  it('keeps the form open and reports a failed upload', async () => {
    const user = userEvent.setup();
    const uploadTeamBadge = vi.fn().mockRejectedValue(new Error('boom'));
    const onChanged = vi.fn();
    render(<TeamBadgeManager team={team} api={{ uploadTeamBadge, deleteTeamBadge: vi.fn() }} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: badgeCopy.upload }));
    await user.upload(screen.getByLabelText(FILE_LABEL), imageFile('escudo.jpg', 'image/jpeg'));
    await user.type(screen.getByRole('textbox', { name: badgeCopy.sourceLabel }), 'Club');
    await user.click(screen.getByRole('checkbox', { name: badgeCopy.authorize }));
    await user.click(screen.getByRole('button', { name: badgeCopy.upload }));
    expect(await screen.findByText(badgeCopy.failedTitle)).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByLabelText(FILE_LABEL)).toBeTruthy();
  });
});
