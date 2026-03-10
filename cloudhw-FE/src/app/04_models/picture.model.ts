export interface Picture {
  id: string;
  name: string;
  /** Date the photo was taken (from EXIF). Falls back to uploadedAt when EXIF is absent. */
  createdAt: string | null;
  /** Server-side timestamp of when the file was uploaded. */
  uploadedAt: string;
  size: number;
  contentType: string;
  width: number;
  height: number;
  albumId: string;
}

export interface ThumbnailResult {
  id: string;
  contentType: string;
  thumbnail: string; // base64
}
