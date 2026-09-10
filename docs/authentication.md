# Authentication

`POST /auth/register` validates email/password, hashes passwords with Argon2, and rejects duplicate email addresses. `POST /auth/login` issues a random opaque 24-hour session token stored in the configured database. `POST /auth/logout` invalidates that token. Protected REST routes and `/battle/sync` validate the session rather than accepting a user id from the client. Login and registration attempts use the local rate-limiter fallback.
