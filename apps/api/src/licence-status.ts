// Licence-status providers. A provider answers "what is the current status of
// these licence numbers?" against the authoritative source. The rest of the
// backend only knows this interface, so the real MTO feed drops in by swapping
// the provider — no route or model changes.

import { config } from './config.js';
import type { MtoLicenceStatus, LicenceStatusResult } from './shared/licence-status.js';

export interface LicenceStatusProvider {
  readonly source: 'demo' | 'mto_batch' | 'mto_consent';
  /**
   * Look up many licences in one call (the MTO feed is batch-oriented, capped
   * at ~100 per order). Returns a result per input, keyed by licence number.
   * A number with no record comes back as { code: 'NotFound' }.
   */
  check(licenceNumbers: string[]): Promise<Map<string, LicenceStatusResult>>;
}

const normalize = (n: string) => n.replace(/[^A-Z0-9]/gi, '').toUpperCase();

/**
 * Demo provider: deterministic statuses with no network. The status is derived
 * from the licence number so a given demo licence always reads the same, and
 * an in-memory override map lets the demo "Flip status" tool and tests change
 * a licence to suspended/interlock to show the alert path.
 */
export class DemoLicenceStatusProvider implements LicenceStatusProvider {
  readonly source = 'demo' as const;
  private overrides = new Map<string, MtoLicenceStatus>();

  /** Used by the demo tool/tests to force a status for one licence. */
  setOverride(licenceNumber: string, code: MtoLicenceStatus | null): void {
    const key = normalize(licenceNumber);
    if (code) this.overrides.set(key, code);
    else this.overrides.delete(key);
  }

  private statusFor(licenceNumber: string): MtoLicenceStatus {
    const key = normalize(licenceNumber);
    const override = this.overrides.get(key);
    if (override) return override;
    // Stable pseudo-status from the number: almost all demo licences are Valid.
    let h = 0;
    for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const bucket = h % 100;
    if (bucket < 90) return 'Valid';
    if (bucket < 96) return 'ValidWithIgnitionInterlock';
    if (bucket < 98) return 'ValidWithIgnitionInterlockAndWCode';
    return 'NotValid';
  }

  async check(licenceNumbers: string[]): Promise<Map<string, LicenceStatusResult>> {
    const out = new Map<string, LicenceStatusResult>();
    for (const n of licenceNumbers) {
      const code = this.statusFor(n);
      out.set(n, {
        code,
        interlock: code === 'ValidWithIgnitionInterlock' || code === 'ValidWithIgnitionInterlockAndWCode',
        wCode: code === 'ValidWithIgnitionInterlockAndWCode',
      });
    }
    return out;
  }
}

/**
 * MTO batch provider (production). Calls MTO's account-based driver-record feed
 * under a data-sharing agreement — NOT the public, CAPTCHA-gated Driver's
 * Licence Check webpage. The request/response shape below is the integration
 * seam: it mirrors the public service (an ordered list of licence numbers in,
 * a status per number out) and is finalized against MTO's account API spec when
 * the agreement is in place. Without an endpoint configured it refuses rather
 * than guessing, so a misconfigured production deploy fails loudly.
 */
export class MtoBatchLicenceStatusProvider implements LicenceStatusProvider {
  readonly source = 'mto_batch' as const;
  constructor(
    private endpoint: string,
    private apiKey: string,
    private batchSize = 100,
  ) {}

  async check(licenceNumbers: string[]): Promise<Map<string, LicenceStatusResult>> {
    const out = new Map<string, LicenceStatusResult>();
    for (let i = 0; i < licenceNumbers.length; i += this.batchSize) {
      const chunk = licenceNumbers.slice(i, i + this.batchSize);
      const res = await fetch(`${this.endpoint}/batch-status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey },
        body: JSON.stringify({ licenceNumbers: chunk }),
      });
      if (!res.ok) throw new Error(`MTO licence-status feed returned ${res.status}`);
      const body = (await res.json()) as { results: { licenceNumber: string; status: MtoLicenceStatus }[] };
      for (const r of body.results) {
        out.set(r.licenceNumber, {
          code: r.status,
          interlock: r.status === 'ValidWithIgnitionInterlock' || r.status === 'ValidWithIgnitionInterlockAndWCode',
          wCode: r.status === 'ValidWithIgnitionInterlockAndWCode',
        });
      }
    }
    return out;
  }
}

let provider: LicenceStatusProvider = buildFromConfig();

function buildFromConfig(): LicenceStatusProvider {
  if (config.licenceStatus.provider === 'mto_batch') {
    const { mtoEndpoint, mtoApiKey, batchSize } = config.licenceStatus;
    if (!mtoEndpoint || !mtoApiKey) throw new Error('MTO_DLC_ENDPOINT and MTO_DLC_API_KEY must be set when LICENCE_STATUS_PROVIDER=mto_batch');
    return new MtoBatchLicenceStatusProvider(mtoEndpoint, mtoApiKey, batchSize);
  }
  return new DemoLicenceStatusProvider();
}

export function getLicenceStatusProvider(): LicenceStatusProvider {
  return provider;
}

/** Tests and the demo set their own provider. */
export function setLicenceStatusProvider(p: LicenceStatusProvider): void {
  provider = p;
}
