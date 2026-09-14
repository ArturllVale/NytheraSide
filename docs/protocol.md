# Realtime WebSocket Protocol

The realtime gateway is mounted at `/battle/sync` and processes all map presence and battle synchronization over WebSockets.

---

## 1. Handshake & Authentication

Every WebSocket connection must authenticate as its first message.

### Client -> Server: `AUTH_REQ`
```json
{
  "type": "AUTH_REQ",
  "token": "opaque_session_token_from_login",
  "characterId": "optional_character_uuid"
}
```

### Server -> Client: `AUTH_RES`
```json
{
  "type": "AUTH_RES",
  "success": true,
  "character": {
    "id": "char_uuid",
    "name": "HeroName",
    "mapId": 1,
    "x": 10,
    "y": 12,
    "direction": 2
  }
}
```

---

## 2. World & Map Movement

### Client -> Server: `MAP_MOVE_REQ`
Sent when the player moves or changes direction on the map:
```json
{
  "type": "MAP_MOVE_REQ",
  "payload": {
    "mapId": 1,
    "x": 11,
    "y": 12,
    "direction": 6,
    "isMoving": true
  }
}
```

### Server -> Client: `MAP_UPDATE_RES`
Broadcast periodically or on state change to players on the same map:
```json
{
  "type": "MAP_UPDATE_RES",
  "payload": {
    "players": [
      {
        "characterId": "char_uuid",
        "name": "HeroName",
        "x": 11,
        "y": 12,
        "direction": 6,
        "isMoving": false,
        "characterName": "Actor1",
        "characterIndex": 0
      }
    ]
  }
}
```

---

## 3. Battle Synchronization

### Starting a Battle
```json
{
  "type": "BATTLE_START_REQ",
  "troopId": 1
}
```

### Submitting a Battle Command
```json
{
  "type": "BATTLE_COMMAND_REQ",
  "command": {
    "type": "SKILL",
    "skillId": 1,
    "targetId": "enemy_1"
  }
}
```

### Toggling Auto-Battle
```json
{
  "type": "BATTLE_SET_AUTO_REQ",
  "isAuto": true
}
```

### Battle Update Broadcast
```json
{
  "type": "BATTLE_UPDATE_RES",
  "state": { /* snapshot */ },
  "events": [
    {
      "type": "DAMAGE",
      "sourceId": "char_uuid",
      "targetId": "enemy_1",
      "value": 45
    }
  ]
}
```

---

## 4. Error Handling: `ERROR_RES`
```json
{
  "type": "ERROR_RES",
  "message": "Error description"
}
```
