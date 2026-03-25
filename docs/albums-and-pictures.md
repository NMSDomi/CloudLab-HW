# Albums & Pictures

This document covers the data models, access control, and operations for albums and pictures.

---

## Data Models

### Album

```
Album
  ├─ Id                (GUID, primary key)
  ├─ Name
  ├─ Description       (optional)
  ├─ CreatedAt
  ├─ IsPublic          (bool — controls public visibility)
  ├─ Size              (total bytes of all pictures, maintained automatically)
  ├─ CoverPictureId    (optional FK → Picture, nullable)
  ├─ OwnerId           (FK → User)
  ├─ Pictures          (navigation: ICollection<Picture>)
  └─ SharedWith        (navigation: ICollection<AlbumShare>)
```

### Picture

```
Picture
  ├─ Id                (GUID, primary key)
  ├─ Name              (original filename)
  ├─ CreatedAt         (date photo was taken, read from EXIF — null if no EXIF)
  ├─ UploadedAt        (server-side UTC timestamp, always present)
  ├─ Size              (bytes)
  ├─ ContentType       (MIME type)
  ├─ Data              (raw image bytes — stored in PostgreSQL)
  ├─ Thumbnail         (JPEG, max 500px longest side — stored in PostgreSQL)
  ├─ Width / Height    (pixels)
  └─ AlbumId           (FK → Album)
```

Images (full size and thumbnail) are stored **directly in the database** as byte arrays, not on a file system or object storage.

### AlbumShare

Join table for the many-to-many relationship between albums and users they are shared with:

```
AlbumShare
  ├─ UserId    (FK → User, composite PK)
  ├─ AlbumId   (FK → Album, composite PK)
  └─ SharedAt  (UTC timestamp of when access was granted)
```

---

## Access Control

Access to an album (and its pictures) is determined by `HasAccessAsync`:

```
User has access if ANY of the following is true:
  1. User is the album owner  (album.OwnerId == userId)
  2. Album is public          (album.IsPublic == true)
  3. Album is shared with the user (AlbumShare record exists)
```

This check is applied **at the service layer** for every read operation — getting an album, getting pictures, getting thumbnails. If access is denied, the service returns `null` / empty list, and the controller returns `404 Not Found` (not 403, to avoid leaking existence).

Write operations (upload, delete picture, update album, share, set cover) require the requesting user to be the **owner**.

---

## Album Operations

| Operation | Endpoint | Auth | Constraint |
|---|---|---|---|
| List my albums | `GET /api/album/my` | Required | Returns albums owned by caller |
| List public albums | `GET /api/album/public` | None | Returns all public albums |
| List shared with me | `GET /api/album/shared` | Required | Albums shared with caller |
| Search | `GET /api/album/search?q=` | None | Searches public + caller's own |
| Get album | `GET /api/album/{id}` | None | Access-controlled |
| Create | `POST /api/album` | Required | Caller becomes owner |
| Update | `PUT /api/album/{id}` | Required | Owner only |
| Delete | `DELETE /api/album/{id}` | Required | Owner only, cascades pictures |
| Share | `POST /api/album/{id}/share` | Required | Owner only |
| Unshare | `DELETE /api/album/{id}/share/{userId}` | Required | Owner only |
| Set cover | `PUT /api/album/{id}/cover` | Required | Owner only |
| Get cover thumbnail | `GET /api/album/{id}/cover` | None | Access-controlled |
| Download album ZIP | `GET /api/album/{id}/download` | None | Access-controlled |
| List share recipients | `GET /api/album/{id}/shares` | Required | Owner/shared user with access |

---

## Picture Operations

| Operation | Endpoint | Auth | Constraint |
|---|---|---|---|
| Get pictures in album | `GET /api/picture/album/{albumId}` | None | Access-controlled |
| Get thumbnails in album | `GET /api/picture/album/{albumId}/thumbnails` | None | Access-controlled |
| Get picture metadata | `GET /api/picture/{id}` | None | Access-controlled |
| Get full image data | `GET /api/picture/{id}/data` | None | Access-controlled |
| Get thumbnail | `GET /api/picture/{id}/thumbnail` | None | Access-controlled |
| Upload | `POST /api/picture/album/{albumId}` | Required | Album owner only |
| Delete | `DELETE /api/picture/{id}` | Required | Album owner only |
| Rename | `PATCH /api/picture/{id}/name` | Required | Album owner only, 1–40 chars |

---

## Picture Upload

```
1. POST /api/picture/album/{albumId}  multipart/form-data  file=<image>
2. Backend validates:
   - File must be provided and non-empty
   - Content-Type must be one of:
     image/jpeg, image/png, image/gif, image/webp, image/tiff,
     image/heic, image/heif, image/bmp
   - Max size: 45 MB per request
3. Image is loaded via ImageSharp to:
   - Validate it is a real image (rejects corrupt files)
   - Read width and height
4. EXIF metadata is parsed for CreatedAt:
   - Priority: DateTimeOriginal → DateTimeDigitized → DateTime
   - Supports standard (yyyy:MM:dd HH:mm:ss) and non-standard date formats
   - Falls back to null if no valid EXIF date found
5. EXIF/IPTC/XMP metadata is stripped from stored bytes (privacy hardening)
6. Thumbnail generated: JPEG, max 500px on longest side, quality 90
7. Both full image and thumbnail stored in DB
8. Album.Size updated (+=)
```

---

## Picture Deletion

```
1. DELETE /api/picture/{id}
2. Caller must be owner of the album the picture belongs to
3. Picture record (including Data and Thumbnail bytes) deleted from DB
4. Album.Size updated (-=, clamped to 0)
```

---

## Album Sharing

```
Share:
  POST /api/album/{id}/share  { "userId": "..." }
  → Only owner can share
  → Idempotent: sharing with already-shared user returns success

Unshare:
  DELETE /api/album/{id}/share/{targetUserId}
  → Only owner can unshare
  → Idempotent: unsharing a non-shared user returns success
```

Shared users get **read-only** access. They cannot upload, delete, edit, or reshare the album.

---

## Thumbnail vs Full Image

The API serves thumbnails and full images as separate endpoints to allow the frontend to load fast previews without fetching full-resolution data.

| | Endpoint | Data returned |
|---|---|---|
| Thumbnail | `/api/picture/{id}/thumbnail` | JPEG ≤500px, serves from `Thumbnail` column |
| Full image | `/api/picture/{id}/data` | Original bytes, serves from `Data` column |

The frontend fetches thumbnails for album grids and only requests full image data when a picture is opened.
