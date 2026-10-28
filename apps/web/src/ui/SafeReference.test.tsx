/**
 * SafeReference renders every source reference as plain text, never as a link (T10-F16, T11H-F14, AD-36).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SafeReference } from './SafeReference';

afterEach(cleanup);

const HOSTILE_REFERENCES = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(document.cookie)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'data:text/html,<script>alert(1)</script>',
  'https://example.invalid/v4/resource/1',
  '<a href="https://example.invalid">link</a>',
  'source:demo-a/matches@2026-10-27T10:00:00Z',
];

describe('SafeReference', () => {
  it.each(HOSTILE_REFERENCES)('renders %s as text with no anchor and no markup', (value) => {
    const { container } = render(<SafeReference value={value} />);

    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[href]')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toBe(value);
  });

  it('renders the javascript:, data: and https: values side by side without any link', () => {
    const { container } = render(
      <ul>
        <li>
          <SafeReference value="javascript:alert(1)" />
        </li>
        <li>
          <SafeReference value="data:text/html,<b>x</b>" />
        </li>
        <li>
          <SafeReference value="https://example.invalid/resource" />
        </li>
      </ul>,
    );

    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('code')).toHaveLength(3);
    expect(container.querySelector('b')).toBeNull();
  });

  it('shows control and bidirectional-override characters as replacement characters', () => {
    const { container } = render(<SafeReference value={'import:abc‮txt.exe\u0007'} />);

    expect(container.textContent).toBe('import:abc�txt.exe�');
  });

  it.each([null, undefined, ''])('shows a fixed text for an empty reference (%s)', (value) => {
    const { container } = render(<SafeReference value={value} />);

    expect(container.textContent).toBe('Sin referencia');
    expect(container.querySelector('a')).toBeNull();
  });
});
