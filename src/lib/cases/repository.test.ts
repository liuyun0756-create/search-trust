import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import type { CaseLocation } from "./contracts";
import type { CaseRecord, CreateCaseRecord } from "./repository";
import { SupabaseCaseRepository } from "./repository";

type FakeResult = {
  data: unknown;
  error: null;
  count?: number | null;
};

class FakeQueryBuilder {
  readonly calls: Array<[string, ...unknown[]]> = [];

  constructor(private readonly result: FakeResult) {}

  insert(value: unknown) { this.calls.push(["insert", value]); return this; }
  select(...args: unknown[]) { this.calls.push(["select", ...args]); return this; }
  update(value: unknown) { this.calls.push(["update", value]); return this; }
  eq(column: string, value: unknown) { this.calls.push(["eq", column, value]); return this; }
  neq(column: string, value: unknown) { this.calls.push(["neq", column, value]); return this; }
  order(column: string, options: unknown) { this.calls.push(["order", column, options]); return this; }
  range(from: number, to: number) { this.calls.push(["range", from, to]); return this; }
  limit(value: number) { this.calls.push(["limit", value]); return this; }
  single() { this.calls.push(["single"]); return this; }
  maybeSingle() { this.calls.push(["maybeSingle"]); return this; }
  then(resolve: (result: FakeResult) => unknown) { return Promise.resolve(resolve(this.result)); }
}

class FakeSupabase {
  readonly builders: FakeQueryBuilder[] = [];
  private readonly results: FakeResult[] = [];

  enqueue(result: FakeResult) { this.results.push(result); }

  from(table: string) {
    const builder = new FakeQueryBuilder(this.results.shift() ?? { data: null, error: null });
    builder.calls.push(["from", table]);
    this.builders.push(builder);
    return builder;
  }
}

const location: CaseLocation = {
  display_name: "Austin, TX",
  country_code: "US",
  region: "Texas",
  city: "Austin",
  postal_code: null,
  latitude: 30.2672,
  longitude: -97.7431,
};

const record: CaseRecord = {
  id: "00000000-0000-4000-8000-000000000101",
  user_id: "00000000-0000-4000-8000-000000000001",
  site_url: "https://example.com/",
  normalized_domain: "example.com",
  business_name: "Example",
  business_identity: {
    business_name: "Example",
    site_url: "https://example.com/",
    normalized_domain: "example.com",
    operating_model: "storefront",
    primary_location: location,
    public_gbp_url: null,
  },
  operating_model: "storefront",
  primary_service: "SEO",
  target_market: location,
  status: "active",
  latest_report_id: null,
  location_key: "geo:30.267200:-97.743100",
  archived_at: null,
  created_at: "2026-08-27T00:00:00.000Z",
  updated_at: "2026-08-27T00:00:00.000Z",
};

function hasUserScope(builder: FakeQueryBuilder, userId: string) {
  expect(builder.calls).toContainEqual(["eq", "user_id", userId]);
}

describe("Supabase Case repository owner scoping", () => {
  it("writes the current owner and scopes every read or mutation by user_id", async () => {
    const fake = new FakeSupabase();
    const repository = new SupabaseCaseRepository(fake as unknown as SupabaseClient);
    const userId = record.user_id;
    const createInput: CreateCaseRecord = {
      id: record.id,
      user_id: userId,
      site_url: record.site_url,
      normalized_domain: record.normalized_domain,
      business_name: record.business_name,
      business_identity: record.business_identity,
      operating_model: record.operating_model,
      primary_service: record.primary_service,
      target_market: record.target_market,
    };

    fake.enqueue({ data: record, error: null });
    await repository.create(createInput);
    expect(fake.builders[0].calls).toContainEqual(["insert", createInput]);
    expect(fake.builders[0].calls).toContainEqual(["insert", createInput]);

    fake.enqueue({ data: record, error: null });
    await repository.findById(userId, record.id);
    hasUserScope(fake.builders[1], userId);

    fake.enqueue({ data: record, error: null });
    await repository.findDuplicate(userId, record.normalized_domain, record.location_key!, record.id);
    hasUserScope(fake.builders[2], userId);

    fake.enqueue({ data: [record], error: null, count: 1 });
    await repository.list(userId, { status: "active", limit: 20, offset: 0 });
    hasUserScope(fake.builders[3], userId);

    fake.enqueue({ data: record, error: null });
    await repository.updateActive(userId, record.id, { business_name: "Updated" });
    hasUserScope(fake.builders[4], userId);

    fake.enqueue({ data: { ...record, status: "archived" }, error: null });
    await repository.archiveActive(userId, record.id, "2026-08-27T01:00:00.000Z");
    hasUserScope(fake.builders[5], userId);

    fake.enqueue({ data: record, error: null });
    await repository.restoreArchived(userId, record.id);
    hasUserScope(fake.builders[6], userId);

    for (const builder of fake.builders) {
      expect(builder.calls[0]).toEqual(["from", "client_cases"]);
    }
  });
});
