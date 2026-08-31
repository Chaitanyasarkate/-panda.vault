# Security Rules

1. Never store plaintext user passwords.

2. Never store plaintext vault credentials.

3. Never send the master password to the backend.

4. Never log passwords, vault keys, encryption keys,
   TOTP secrets, or authentication tokens.

5. Never implement custom cryptographic algorithms.

6. Use established cryptographic libraries/APIs.

7. Perform vault encryption/decryption client-side.

8. Backend should store encrypted vault data.

9. Do not expose decrypted vault data through APIs.

10. Do not use Math.random() for security-sensitive
    random values.

11. Use HTTPS in production.

12. Validate authorization for every vault operation.

13. Write security tests for authentication and
    authorization.

14. Do not mark the project production-ready without
    security review.