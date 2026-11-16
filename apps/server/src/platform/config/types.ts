/**
 * Types of the validated configuration (architecture.md sections 5.1, 12.1 and 15.2; contracts/provider-ports.md
 * section 1.2). The configuration holds no secret and no provider identifier in code: provider specifics live only in
 * the opaque adapter `options` and in the configuration files.
 */
import type { Language } from '../format/text.js';

import type { CatalogueConfig } from './catalogue.js';

/** Data acquisition modes (PD-13). */
export const DATA_MODES = ['LIVE_DATA', 'MANUAL_DATA', 'DEMO_DATA'] as const;
export type DataMode = (typeof DATA_MODES)[number];

export const SOURCE_ROLES = ['primary', 'verification'] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

/** Republishing permission of a source (AD-28, PD-18, AD-38). */
export const PUBLICATION_PERMISSIONS = ['confirmed', 'unconfirmed', 'not_applicable'] as const;
export type PublicationPermission = (typeof PUBLICATION_PERMISSIONS)[number];

/** `verificationPolicy.manuallyApprovedPublication` values accepted by the configuration (PD-17, AD-38). */
export const MANUALLY_APPROVED_PUBLICATION_POLICIES = ['allowed_without_accepted_source', 'blocked'] as const;
export type ManuallyApprovedPublicationPolicy = (typeof MANUALLY_APPROVED_PUBLICATION_POLICIES)[number];

/** `verificationPolicy.livePublicationPermissionRule` values accepted by the configuration (PD-18, AD-38). */
export const LIVE_PUBLICATION_PERMISSION_RULES = ['every_supporting_source'] as const;
export type LivePublicationPermissionRule = (typeof LIVE_PUBLICATION_PERMISSION_RULES)[number];

/** Opaque adapter options: a frozen JSON object validated later by the adapter's own schema. */
export type AdapterOptions = Readonly<Record<string, unknown>>;

/** One configured sports-data source (contracts/provider-ports.md section 1.2, `SourceDescriptor` plus options). */
export interface SourceConfig {
  /** Configured source ID, `^[a-z0-9][a-z0-9-]{1,40}$`. */
  readonly id: string;
  readonly name: string;
  readonly mode: DataMode;
  readonly enabled: boolean;
  readonly role: SourceRole;
  /** Accepted under PD-01; never true for MANUAL_DATA (R-071). */
  readonly accepted: boolean;
  /** Sources sharing upstream data share one group and count once (OD-24). Defaults to the source ID. */
  readonly independenceGroup: string;
  /** The competition organiser's publication (R-311). */
  readonly officialPublication: boolean;
  /** `unconfirmed` by default for LIVE_DATA; `not_applicable` for DEMO_DATA and MANUAL_DATA. */
  readonly publicationPermission: PublicationPermission;
  /** The Product Owner decision recording the provider's written permission; only with `confirmed` LIVE_DATA. */
  readonly publicationPermissionDecision: string | null;
  /** Adapter kind slug, resolved only by the adapter registry. */
  readonly adapter: string;
  readonly options: AdapterOptions;
  /**
   * The operator validated the source's values before generation (PD-ARCH-01E-PD-01): its eligible facts are recorded
   * as approved by the operator when a run verifies them. Only for MANUAL_DATA sources; never makes a fact verified.
   */
  readonly operatorValidated: boolean;
}

export interface AiProviderConfig {
  /** Adapter kind slug (for example the stub adapter). */
  readonly adapter: string;
  readonly options: AdapterOptions;
}

export interface ServerConfig {
  /** Always the loopback address: the configuration accepts no other host (PD-05, SC-02). */
  readonly host: '127.0.0.1';
  /** Listening port: `EDR_PORT` when set, else `server.port`, else 4300. */
  readonly port: number;
  /** Exact `host:port` values accepted in the Host header (architecture.md section 12.1; T10-F02). */
  readonly allowedHosts: readonly string[];
  /** Exact origins accepted on mutating requests (architecture.md section 12.1; T10-F02). */
  readonly allowedOrigins: readonly string[];
}

export interface FormatConfig {
  readonly width: number;
  readonly height: number;
  readonly maxSlidesPerCarousel: number;
}

export interface VerificationPolicy {
  readonly manuallyApprovedPublication: ManuallyApprovedPublicationPolicy;
  readonly livePublicationPermissionRule: LivePublicationPermissionRule;
}

export interface LanguagesConfig {
  readonly defaultLanguage: Language;
  readonly languages: readonly { readonly code: Language; readonly label: string }[];
}

export interface FontRole {
  readonly family: string;
  readonly weight: number;
}

/** Provisional brand settings (OD-07, R-032, R-418). */
export interface BrandConfig {
  readonly name: string;
  /** The brand's social handle, the only `@` mention allowed in drafted text (architecture.md section 8.3). */
  readonly handle: string;
  readonly mascotName: string | null;
  /** True while the Product Owner has not supplied the official values (OD-07). */
  readonly provisional: boolean;
  readonly palette: Readonly<{
    primary: string;
    primaryDark: string;
    accent: string;
    secondary: string;
    light: string;
  }>;
  readonly fonts: Readonly<{ heading: FontRole; body: FontRole; numeric: FontRole }>;
}

export interface PathsConfig {
  /** Absolute project root: relative configured paths resolve against it. */
  readonly rootDir: string;
  /** Absolute data directory: `EDR_DATA_DIR` when set, else `dataDir`. Created by the composition root. */
  readonly dataDir: string;
}

/** The validated, frozen application configuration. */
export interface AppConfig {
  readonly server: ServerConfig;
  readonly paths: PathsConfig;
  readonly display: Readonly<{ utcOffsetMinutes: number }>;
  readonly format: FormatConfig;
  readonly standingsRowsPerSlide: number;
  readonly publicationMode: 'manual';
  readonly providers: Readonly<{
    sports: Readonly<{ sources: readonly SourceConfig[] }>;
    ai: AiProviderConfig;
    /** Image generation provider of the design proposals (PD-ARCH-01G-B); adapter `disabled` by default. */
    images: AiProviderConfig;
    /** Editorial copy writer (PD-ARCH-01H). */
    editorial: AiProviderConfig;
  }>;
  readonly verificationPolicy: VerificationPolicy;
  readonly catalogue: CatalogueConfig;
  readonly languages: LanguagesConfig;
  readonly brand: BrandConfig;
}
