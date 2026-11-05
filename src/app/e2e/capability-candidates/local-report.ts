import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {candidateReviewFixture} from '@/lib/report-capability/fixtures/candidate-review';
import {validateCapabilityReport} from '@/lib/report-capability/validate';

// Read-only replay from the confirmed frozen inputs. No caller-controlled file path.
export const seamlessReplaySha256='76212b03eb9a22746dcb0a96844fc45e9983eeedc333b3531369e2d998d76333';
export function localCandidateReport(scenario:string){
  if(!isLocalE2ETestMode())throw new Error('Local preview only');
  if(scenario!=='seamless')return candidateReviewFixture(scenario);
  const bytes=readFileSync(path.join(process.cwd(),'output/playwright/p1-07/seamless-v12.json'));
  if(createHash('sha256').update(bytes).digest('hex')!==seamlessReplaySha256)throw new Error('Seamless replay checksum mismatch');
  const checked=validateCapabilityReport(JSON.parse(bytes.toString('utf8')));
  if(!checked.ok || checked.report.input_manifest.ruleset_version!=='v22_capability_public_v12'
    || checked.report.input_manifest.business.site_url!=='https://seamlessgutterspensacola.com/')throw new Error('Confirmed Seamless v12 replay required');
  return checked.report;
}
