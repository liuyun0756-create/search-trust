import {afterEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({legacy:vi.fn(),capability:vi.fn(),review:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("./server",()=>({createServerReportShareService:()=>({resolve:mocks.legacy})}));
vi.mock("../report-capability/shares",()=>({CapabilityShareService:class {resolve=mocks.capability;}}));
vi.mock("../review-reports/shares",()=>({ReviewShareService:class {resolve=mocks.review;}}));
vi.mock("../supabase",()=>({createServerClient:()=>({})}));
import {resolveVersionedShare} from "./versioned";
import {ReportShareNotFoundError} from "./service";
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();});
describe("versioned share resolution",()=>{
  it("preserves a legacy response without querying the new store",async()=>{
    mocks.legacy.mockResolvedValue({legacy:true});
    expect(await resolveVersionedShare("token")).toEqual({kind:"legacy",value:{legacy:true}});
    expect(mocks.capability).not.toHaveBeenCalled();
  });
  it("keeps the new resolver off by default",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","");mocks.legacy.mockRejectedValue(new ReportShareNotFoundError());
    await expect(resolveVersionedShare("token")).rejects.toBeInstanceOf(ReportShareNotFoundError);
    expect(mocks.capability).not.toHaveBeenCalled();
  });
  it("resolves the new schema only after a legacy not-found",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");mocks.legacy.mockRejectedValue(new ReportShareNotFoundError());mocks.capability.mockResolvedValue({delivery:{revision:2}});
    expect(await resolveVersionedShare("token")).toEqual({kind:"capability",value:{delivery:{revision:2}}});
    expect(mocks.capability).toHaveBeenCalledWith("token");
  });
  it("never masks a legacy database error with a fallback",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");mocks.legacy.mockRejectedValue(new Error("database unavailable"));
    await expect(resolveVersionedShare("token")).rejects.toThrow("database unavailable");
    expect(mocks.capability).not.toHaveBeenCalled();
  });
});

it("selects a review projection before the old capability reader when enabled",async()=>{
  vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED","true");
  mocks.legacy.mockRejectedValue(new ReportShareNotFoundError());mocks.review.mockResolvedValue({delivery:{revision:3}});
  expect(await resolveVersionedShare("token")).toEqual({kind:"review",value:{delivery:{revision:3}}});expect(mocks.capability).not.toHaveBeenCalled();
});
it("does not mask a review storage error with an older reader",async()=>{
  vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED","true");
  mocks.legacy.mockRejectedValue(new ReportShareNotFoundError());mocks.review.mockRejectedValue(new Error("unavailable"));
  await expect(resolveVersionedShare("token")).rejects.toThrow("unavailable");expect(mocks.capability).not.toHaveBeenCalled();
});
