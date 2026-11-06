import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,globalSetup:undefined,testMatch:'identity-review.spec.ts',fullyParallel:false,workers:1,timeout:120000});
