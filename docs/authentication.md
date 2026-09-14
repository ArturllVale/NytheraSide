# Authentication & Character Management

NytheraSide features an end-to-end account authentication and character creation/selection pipeline integrated between the Fastify backend and the RPG Maker MZ client.

---

## 1. REST Endpoints

### Account Endpoints
- **`POST /auth/register`**: Validates email and password, hashes passwords with Argon2, and stores account credentials.
- **`POST /auth/login`**: Authenticates credentials and returns a 24-hour opaque session token.
  - *Dev Note*: In development mode, attempting to log in with an unregistered account using a valid password (≥8 chars) will automatically register the account.
- **`POST /auth/logout`**: Revokes the active session token.

### Character Endpoints
All character endpoints require the `Authorization: Bearer <sessionToken>` header:
- **`GET /game/mzdata`** (or `GET /characters/mzdata`): Returns available class templates, hero sprites (`characterName`, `characterIndex`), and map names parsed directly from `data/Classes.json`, `data/Actors.json`, and `data/MapInfos.json`.
- **`GET /characters`**: Returns all characters associated with the authenticated account.
- **`POST /characters`**: Creates a new character.
  - Payload: `{ "name": string, "actorTemplateId": number }`
  - Validates character name (2 to 20 characters) and enforces uniqueness.
- **`DELETE /characters/:id`**: Safely deletes a character after verifying account ownership.

---

## 2. In-Game Client Flow (`NET_Auth.js`)

The client provides custom glassmorphic in-game UI scenes:

1. **Authentication Screen**:
   - Integrated dark glassmorphic UI for login and account creation.
   - Prevents accidental key event propagation to the RPG Maker engine during typing.
2. **Character Selection (`Scene_NytheraCharSelect`)**:
   - Displays 4 character slots in widescreen layout with 2D animated canvas previews.
   - Displays level, class name, current map name, and creation date.
   - Provides "Entrar no Reino" (play) and "Excluir Herói" (delete).
3. **Character Creation (`Scene_NytheraCharCreate`)**:
   - **Step 1 - Class Selection**: Visual cards displaying class name, thematic icons, and descriptions.
   - **Step 2 - Appearance**: Real-time canvas preview of the hero sprite with smooth golden aura, drop shadow, and a 4-direction 360° rotation button (`↻`).
   - **Step 3 - Name Confirmation**: Name input with length validation and duplicate name error feedback.
