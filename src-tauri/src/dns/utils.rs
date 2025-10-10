use std::net::Ipv4Addr;

pub fn ipv4_to_u32(ipv4: Ipv4Addr) -> u32 {
    ipv4.into()
}
