from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter instance based on remote IP address
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
