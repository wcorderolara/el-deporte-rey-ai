/**
 * Startup configuration errors (OD-20, R-127, R-266; architecture.md section 5.1).
 *
 * A `ConfigError` names the setting or the environment variable and states the problem in fixed text. It never
 * contains a configured value, a secret, file content or an absolute file path. Adapters throw it from
 * `validateStartup` with the same rule (contracts/provider-ports.md section 1.4).
 */

/** One configuration problem: the setting (or variable) and the fixed problem text. */
export interface ConfigIssue {
  readonly setting: string;
  readonly problem: string;
}

/** Most problems listed in one error message; the full list stays in `issues`. */
const MAX_ISSUES_IN_MESSAGE = 20;

export class ConfigError extends Error {
  override readonly name = 'ConfigError';
  readonly issues: readonly ConfigIssue[];

  /** `new ConfigError('EDR_PORT', 'must be an integer from 1 to 65535')`. */
  constructor(setting: string, problem: string);
  constructor(issues: readonly ConfigIssue[]);
  constructor(settingOrIssues: string | readonly ConfigIssue[], problem?: string) {
    const issues: readonly ConfigIssue[] =
      typeof settingOrIssues === 'string'
        ? [{ setting: settingOrIssues, problem: problem ?? 'is invalid' }]
        : settingOrIssues.length > 0
          ? [...settingOrIssues]
          : [{ setting: 'configuration', problem: 'is invalid' }];
    const shown = issues.slice(0, MAX_ISSUES_IN_MESSAGE).map((issue) => `${issue.setting} ${issue.problem}`);
    if (issues.length > MAX_ISSUES_IN_MESSAGE) {
      shown.push(`and ${String(issues.length - MAX_ISSUES_IN_MESSAGE)} more problems`);
    }
    super(shown.join('; '));
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }

  /** The first setting named by this error. */
  get setting(): string {
    return this.issues[0]?.setting ?? 'configuration';
  }
}
