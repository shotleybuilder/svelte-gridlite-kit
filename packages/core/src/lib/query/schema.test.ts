import { describe, it, expect } from "vitest";
import { mapPostgresType, mapOidToDataType } from "./schema.js";

// ─── mapPostgresType (pure function, no DB needed) ─────────────────────────

describe("mapPostgresType", () => {
  it("maps numeric types", () => {
    expect(mapPostgresType("integer")).toBe("number");
    expect(mapPostgresType("bigint")).toBe("number");
    expect(mapPostgresType("smallint")).toBe("number");
    expect(mapPostgresType("numeric")).toBe("number");
    expect(mapPostgresType("decimal")).toBe("number");
    expect(mapPostgresType("real")).toBe("number");
    expect(mapPostgresType("double precision")).toBe("number");
    expect(mapPostgresType("serial")).toBe("number");
    expect(mapPostgresType("bigserial")).toBe("number");
    expect(mapPostgresType("smallserial")).toBe("number");
    expect(mapPostgresType("money")).toBe("number");
  });

  it("maps date/time types", () => {
    expect(mapPostgresType("date")).toBe("date");
    expect(mapPostgresType("timestamp without time zone")).toBe("date");
    expect(mapPostgresType("timestamp with time zone")).toBe("date");
    expect(mapPostgresType("time without time zone")).toBe("date");
    expect(mapPostgresType("time with time zone")).toBe("date");
    expect(mapPostgresType("interval")).toBe("date");
  });

  it("maps boolean", () => {
    expect(mapPostgresType("boolean")).toBe("boolean");
  });

  it("maps text types", () => {
    expect(mapPostgresType("character varying")).toBe("text");
    expect(mapPostgresType("character")).toBe("text");
    expect(mapPostgresType("text")).toBe("text");
    expect(mapPostgresType("uuid")).toBe("text");
  });

  it("maps json types", () => {
    expect(mapPostgresType("json")).toBe("json");
    expect(mapPostgresType("jsonb")).toBe("json");
  });

  it("is case-insensitive", () => {
    expect(mapPostgresType("INTEGER")).toBe("number");
    expect(mapPostgresType("Boolean")).toBe("boolean");
    expect(mapPostgresType("DATE")).toBe("date");
  });
});

// ─── mapOidToDataType (pure function, no DB needed) ─────────────────────────

describe("mapOidToDataType", () => {
  it("maps numeric OIDs", () => {
    expect(mapOidToDataType(23)).toBe("number"); // int4
    expect(mapOidToDataType(20)).toBe("number"); // int8
    expect(mapOidToDataType(21)).toBe("number"); // int2
    expect(mapOidToDataType(700)).toBe("number"); // float4
    expect(mapOidToDataType(701)).toBe("number"); // float8
    expect(mapOidToDataType(1700)).toBe("number"); // numeric
    expect(mapOidToDataType(790)).toBe("number"); // money
  });

  it("maps date/time OIDs", () => {
    expect(mapOidToDataType(1082)).toBe("date"); // date
    expect(mapOidToDataType(1114)).toBe("date"); // timestamp
    expect(mapOidToDataType(1184)).toBe("date"); // timestamptz
    expect(mapOidToDataType(1083)).toBe("date"); // time
    expect(mapOidToDataType(1266)).toBe("date"); // timetz
    expect(mapOidToDataType(1186)).toBe("date"); // interval
  });

  it("maps boolean OID", () => {
    expect(mapOidToDataType(16)).toBe("boolean");
  });

  it("maps json OIDs", () => {
    expect(mapOidToDataType(114)).toBe("json"); // json
    expect(mapOidToDataType(3802)).toBe("json"); // jsonb
  });

  it("returns text for unknown OIDs", () => {
    expect(mapOidToDataType(25)).toBe("text"); // text
    expect(mapOidToDataType(1043)).toBe("text"); // varchar
    expect(mapOidToDataType(99999)).toBe("text"); // unknown
  });
});
