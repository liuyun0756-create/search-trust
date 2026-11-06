import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateCapabilityReport} from '@/lib/report-capability/validate';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
export function localIdentityArtifact(scenario:string){
 if(!isLocalE2ETestMode()||!['volcanoes-hiking-guides','pr-plumbing-fresno'].includes(scenario))throw Error('Local scenario unavailable');
 const value=JSON.parse(readFileSync(resolve(process.cwd(),'output/playwright/p1-05',scenario+'.json'),'utf8'));
 if(value.external_calls!==0||!validateCapabilityReport(value.base).ok)throw Error('Generate the saved-input preview first');
 return value;
}
