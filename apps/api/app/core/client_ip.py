"""IP thật của người dùng: một nguồn duy nhất cho rate limit, sessions.ip và audit_logs.ip.

Chỉ đọc header CF-Connecting-IP khi TRUST_CLOUDFLARE_IP=true (API nằm sau Cloudflare và firewall
chỉ mở cho dải IP Cloudflare). Nếu không, ai cũng có thể tự đặt header này để giả IP, nên bỏ
qua và dùng IP kết nối.
"""

import ipaddress

from starlette.requests import HTTPConnection

from app.core.config import get_settings

CF_IP_HEADER = "cf-connecting-ip"


def client_ip(conn: HTTPConnection) -> str | None:
    if get_settings().trust_cloudflare_ip:
        raw = conn.headers.get(CF_IP_HEADER, "").strip()
        try:
            return str(ipaddress.ip_address(raw))
        except ValueError:
            pass  # header thiếu hoặc rác: dùng IP kết nối
    return conn.client.host if conn.client else None
