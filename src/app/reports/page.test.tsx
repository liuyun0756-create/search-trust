import {renderToStaticMarkup} from "react-dom/server";
import {afterEach,describe,expect,it,vi} from "vitest";
import ReportsPage from "./page";
const mocks=vi.hoisted(()=>({list:vi.fn(),order:vi.fn(),reviews:vi.fn()}));
vi.mock("@/lib/auth",()=>({getCurrentUser:async()=>({userId:"00000000-0000-0000-0000-000000000001"})}));
vi.mock("@/lib/supabase",()=>({createServerClient:()=>{
  const query={from:()=>query,select:()=>query,eq:()=>query,not:()=>query,order:mocks.order};return query;
}}));
vi.mock("@/lib/report-capability/repository",()=>({CapabilityRepository:class {listCompletedReports=mocks.list;}}));
vi.mock("@/lib/review-reports/repository",()=>({ReviewDeliveryRepository:class {list=mocks.reviews;}}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe("versioned report workspace",()=>{
  it("leaves the existing list alone with the capability switch off",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","false");mocks.order.mockResolvedValue({data:[],error:null});
    expect(renderToStaticMarkup(await ReportsPage())).toContain("No V2.2 reports yet");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("adds completed capability reports and delivery state to Case history",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");mocks.order.mockResolvedValue({data:[],error:null});
    mocks.list.mockResolvedValue([{caseId:"case-1",reportId:"report-1",businessName:"Clinic",siteUrl:"https://clinic.example.invalid",market:"Local",service:"Dental care",type:"prospect",version:1,generatedAt:"2026-10-21T00:00:00Z",deliveryRevision:2,deliveryStatus:"draft"}]);
    const html=renderToStaticMarkup(await ReportsPage());
    expect(html).toContain("/cases/case-1/reports/report-1");expect(html).toContain("Delivery draft · revision 2 · approval needed");
    expect(html).not.toContain("No V2.2 reports yet");
  });
  it("shows a load error instead of a misleading empty list when the new source fails",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");mocks.order.mockResolvedValue({data:[],error:null});mocks.list.mockRejectedValue(new Error("private"));
    const html=renderToStaticMarkup(await ReportsPage());expect(html).toContain("Reports could not be loaded");expect(html).not.toContain("No V2.2 reports yet");
  });
  it("adds completed review versions only when their separate switch is enabled",async()=>{
    vi.stubEnv("V22_CAPABILITY_DISPATCH_ENABLED","true");vi.stubEnv("V22_REVIEW_DELIVERY_ENABLED","true");
    mocks.order.mockResolvedValue({data:[],error:null});mocks.list.mockResolvedValue([]);
    mocks.reviews.mockResolvedValue([{caseId:"case-2",reportId:"review-2",businessName:"Clinic",siteUrl:"https://clinic.example.invalid",market:"Local",service:"Dental care",type:"verified_execution",version:2,generatedAt:"2026-10-27T00:00:00Z",deliveryRevision:1,deliveryStatus:"approved"}]);
    const html=renderToStaticMarkup(await ReportsPage());expect(html).toContain("/cases/case-2/reports/review-2");expect(mocks.reviews).toHaveBeenCalled();
  });
});
