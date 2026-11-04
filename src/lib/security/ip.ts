import ipaddr from "ipaddr.js";

/**
 * Explicit deny-list on top of ipaddr.js range classification.
 * Belt-and-braces: anything that is not plainly public unicast is rejected.
 */
const DENY_CIDRS_V4 = [
  "0.0.0.0/8", // "this" network
  "10.0.0.0/8", // RFC1918
  "100.64.0.0/10", // carrier-grade NAT (also Alibaba metadata 100.100.100.200)
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local (AWS/GCP/Azure metadata 169.254.169.254)
  "172.16.0.0/12", // RFC1918
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // TEST-NET-1
  "192.31.196.0/24", // AS112
  "192.52.193.0/24", // AMT
  "192.88.99.0/24", // 6to4 relay
  "192.168.0.0/16", // RFC1918
  "192.175.48.0/24", // AS112
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved + broadcast
].map((c) => ipaddr.parseCIDR(c));

const DENY_CIDRS_V6 = [
  "::/128", // unspecified
  "::1/128", // loopback
  "::ffff:0:0/96", // IPv4-mapped (handled separately, but deny by default)
  "64:ff9b::/96", // NAT64
  "64:ff9b:1::/48", // local-use NAT64
  "100::/64", // discard
  "2001::/23", // IETF protocol assignments (incl. Teredo 2001::/32)
  "2001:db8::/32", // documentation
  "2002::/16", // 6to4
  "fc00::/7", // unique local (incl. AWS fd00:ec2::254)
  "fe80::/10", // link-local
  "fec0::/10", // site-local (deprecated)
  "ff00::/8", // multicast
].map((c) => ipaddr.parseCIDR(c));

export type IpCheck = { ok: true; address: string; family: 4 | 6 } | { ok: false; reason: string };

export function classifyIp(input: string): IpCheck {
  if (!ipaddr.isValid(input)) return { ok: false, reason: "invalid IP address" };
  let addr: ipaddr.IPv4 | ipaddr.IPv6 = ipaddr.parse(input);

  // Unwrap IPv4-mapped IPv6 (::ffff:127.0.0.1) so it is judged as IPv4.
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) {
    addr = (addr as ipaddr.IPv6).toIPv4Address();
  }

  const range = addr.range();
  if (range !== "unicast") return { ok: false, reason: `non-public address range (${range})` };

  const denyList = addr.kind() === "ipv4" ? DENY_CIDRS_V4 : DENY_CIDRS_V6;
  for (const cidr of denyList) {
    if (addr.kind() === cidr[0].kind() && addr.match(cidr as [typeof addr, number])) {
      return { ok: false, reason: `address in restricted range ${cidr[0].toString()}/${cidr[1]}` };
    }
  }
  return { ok: true, address: addr.toString(), family: addr.kind() === "ipv4" ? 4 : 6 };
}

export function isPublicIp(input: string): boolean {
  return classifyIp(input).ok;
}
