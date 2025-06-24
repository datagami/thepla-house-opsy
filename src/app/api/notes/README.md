# Notes API Documentation

This document describes the endpoints for the Notes feature.

---

## 1. Create Note
**POST** `/api/notes`
- **Body:** `{ "title": string, "content": string }`
- **Response:** 201 Created, returns the created note object.

## 2. List Notes
**GET** `/api/notes`
- **Response:** 200 OK, returns an array of notes owned by or shared with the user.

## 3. Get Single Note
**GET** `/api/notes/[id]`
- **Response:** 200 OK, returns the note object if owned or shared with the user.

## 4. Update Note
**PUT** `/api/notes/[id]`
- **Body:** `{ "title"?: string, "content"?: string }`
- **Response:** 200 OK, returns the updated note. Also creates an edit history entry.

## 5. Delete Note (Soft Delete)
**DELETE** `/api/notes/[id]`
- **Response:** 200 OK, returns the soft-deleted note.

## 6. Archive Note
**POST** `/api/notes/[id]/archive`
- **Response:** 200 OK, returns the archived note.

## 7. Unarchive Note
**POST** `/api/notes/[id]/unarchive`
- **Response:** 200 OK, returns the unarchived note.

## 8. Share Note
**POST** `/api/notes/[id]/share`
- **Body:** `{ "userIds": string[] }`
- **Response:** 200 OK, returns the updated note with shared users.

## 9. Unshare Note
**POST** `/api/notes/[id]/unshare`
- **Body:** `{ "userIds": string[] }`
- **Response:** 200 OK, returns the updated note with shared users.

## 10. List Comments
**GET** `/api/notes/[id]/comments`
- **Response:** 200 OK, returns an array of comments for the note.

## 11. Add Comment
**POST** `/api/notes/[id]/comments`
- **Body:** `{ "content": string }`
- **Response:** 201 Created, returns the created comment.

## 12. Delete Comment
**DELETE** `/api/notes/[id]/comments/[commentId]`
- **Response:** 200 OK, `{ "success": true }`

## 13. Get Edit History
**GET** `/api/notes/[id]/history`
- **Response:** 200 OK, returns an array of edit history entries for the note.

---

### Common Error Responses
- `401 Unauthorized`: User is not authenticated.
- `403 Forbidden`: User does not have permission for the action.
- `404 Not Found`: Resource does not exist or is deleted.
- `400 Bad Request`: Invalid or missing request data.

---

### Example Note Object
```json
{
  "id": "note_id",
  "title": "Note Title",
  "content": "Note content...",
  "ownerId": "user_id",
  "isArchived": false,
  "isDeleted": false,
  "createdAt": "2024-06-25T12:00:00.000Z",
  "updatedAt": "2024-06-25T12:00:00.000Z",
  "sharedWith": [
    { "id": "share_id", "userId": "other_user_id", "noteId": "note_id" }
  ]
}
```

### Example Comment Object
```json
{
  "id": "comment_id",
  "noteId": "note_id",
  "authorId": "user_id",
  "content": "Comment text...",
  "createdAt": "2024-06-25T12:00:00.000Z",
  "author": {
    "id": "user_id",
    "name": "User Name"
  }
}
```

### Example Edit History Object
```json
{
  "id": "history_id",
  "noteId": "note_id",
  "editorId": "user_id",
  "content": "Previous note content...",
  "editedAt": "2024-06-25T12:00:00.000Z",
  "editor": {
    "id": "user_id",
    "name": "User Name"
  }
}
``` 