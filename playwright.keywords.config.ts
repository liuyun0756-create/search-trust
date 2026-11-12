import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const server=base.webServer;
if(!server||Array.isArray(server))throw Error('Keyword tests require the existing local server configuration');
export default defineConfig({...base,
 testMatch:'**/target-keywords.spec.ts',
 metadata:{targetKeywordsEnabled:true},
 webServer:{...server,reuseExistingServer:false,env:{...server.env,
  V22_TARGET_KEYWORDS_ENABLED:'true',V22_CAPABILITY_DISPATCH_ENABLED:'true',V22_CAPABILITY_INTAKE_ENABLED:'true',
 }},
});
