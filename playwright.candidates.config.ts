import {defineConfig} from '@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,globalSetup:undefined,testMatch:'capability-candidates.spec.ts',fullyParallel:false,workers:1,timeout:90000});
