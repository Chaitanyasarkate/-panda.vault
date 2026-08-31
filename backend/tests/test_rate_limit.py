import pytest
from httpx import AsyncClient
from app.core.limiter import limiter

@pytest.mark.asyncio
async def test_rate_limiting_enforcement(client: AsyncClient):
    """Verifies that exceeding the allowed registration rate limit returns 429 Too Many Requests."""
    try:
        limiter.enabled = True
        
        # Send requests until limit is hit (limit is 5/minute)
        responses = []
        for i in range(7):
            res = await client.post(
                "/api/v1/auth/register",
                json={
                    "email": f"rate_user_{i}@vaultx.com",
                    "password": "ValidPassword123!"
                }
            )
            responses.append(res.status_code)

        # At least one request after the limit must be 429
        assert 429 in responses
    finally:
        limiter.enabled = False
