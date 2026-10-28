import {afterEach,describe,expect,it,vi} from "vitest";
import {defaultPlanningSettings,parsePlanningSettings,parsePlanningView} from "./contracts";
import {isPlanningSettingsEnabled} from "./config";
const site="https://client.example/";
afterEach(()=>vi.unstubAllEnvs());
describe("optional confirmed planning settings",()=>{
  it("keeps defaults unknown and accepts explicit independent-SEO conditions",()=>{
    const settings=defaultPlanningSettings();expect(parsePlanningSettings(settings,site)).toEqual(settings);
    settings.priority="contact_path";settings.target_pages=["https://client.example/repairs/"];
    settings.execution_conditions={capacity:"limited",publishing_access:"needs_approval"};
    const copy=parsePlanningSettings(settings,site)!;expect(copy).toEqual(settings);copy.target_pages.push("mutate-copy");expect(settings.target_pages).toHaveLength(1);
  });
  it.each(["https://other.example/","https://client.example.evil.test/","https://user@client.example/","https://client.example/#scope","https://client.example/a b","javascript:alert(1)","https://client.example"])("rejects noncanonical or unsafe target %s",page=>{
    expect(parsePlanningSettings({...defaultPlanningSettings(),target_pages:[page]},site)).toBeNull();
  });
  it.each(["extra","duplicate","too-many","unknown-field","bad-capacity","null-condition"])("rejects %s instead of guessing",kind=>{
    const settings:Record<string,unknown>=defaultPlanningSettings();
    if(kind==="extra")settings.owner="another person";
    if(kind==="duplicate")settings.target_pages=[site,site];
    if(kind==="too-many")settings.target_pages=Array.from({length:21},(_,i)=>`${site}${i}/`);
    if(kind==="unknown-field")settings.priority="More revenue";
    if(kind==="bad-capacity")settings.execution_conditions={capacity:"none",publishing_access:"unknown"};
    if(kind==="null-condition")settings.execution_conditions=null;
    expect(parsePlanningSettings(settings,site)).toBeNull();
  });
  it("binds saved settings to a Case and requires an integer version",()=>{
    const view={caseId:"one",siteUrl:site,revision:0,settings:defaultPlanningSettings()};
    expect(parsePlanningView(view,"one")).toEqual(view);expect(parsePlanningView(view,"two")).toBeNull();
    expect(parsePlanningView({...view,revision:.5},"one")).toBeNull();
  });
  it("is disabled unless both the capability and explicit planning switches are true",()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");vi.stubEnv("V22_PLANNING_SETTINGS_ENABLED","");expect(isPlanningSettingsEnabled()).toBe(false);
    vi.stubEnv("V22_PLANNING_SETTINGS_ENABLED","true");expect(isPlanningSettingsEnabled()).toBe(true);
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","false");expect(isPlanningSettingsEnabled()).toBe(false);
  });
});
