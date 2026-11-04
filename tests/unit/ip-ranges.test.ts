import { describe, expect, it } from "vitest";
import { classifyIp, isPublicIp } from "@/lib/security/ip";

describe("classifyIp", () => {
  it.each(["93.184.215.14", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e"])("allows public %s", (ip) => {
    expect(isPublicIp(ip)).toBe(true);
  });

  it.each([
    "127.0.0.1", "127.255.255.254", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "100.100.100.200", "0.0.0.0", "255.255.255.255", "224.0.0.1", "240.0.0.1", "192.0.2.10",
    "198.51.100.7", "203.0.113.9", "198.18.0.1", "192.0.0.170",
    "::", "::1", "fe80::1", "fc00::1", "fd00:ec2::254", "ff02::1", "2001:db8::1", "64:ff9b::7f00:1", "2002:7f00:1::",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",
  ])("rejects non-public %s", (ip) => {
    const r = classifyIp(ip);
    expect(r.ok).toBe(false);
  });

  it("rejects garbage", () => {
    expect(classifyIp("not-an-ip").ok).toBe(false);
    expect(classifyIp("999.1.1.1").ok).toBe(false);
  });

  it("unwraps IPv4-mapped public addresses", () => {
    const r = classifyIp("::ffff:8.8.8.8");
    expect(r.ok && r.family).toBe(4);
  });
});
