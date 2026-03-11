import { Injectable, signal } from '@angular/core';
import { PictureService } from './picture.service';
import { AlbumService } from './album.service';

export interface UploadTask {
  albumId: string;
  albumName: string;
  current: number;
  total: number;
  percent: number;
}

export interface SelectedFile {
  file: File;
  preview: string;
  name: string;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private pictureService: PictureService | null = null;

  /** Current active upload task (null = idle) */
  activeUpload = signal<UploadTask | null>(null);

  /** Callback fired when an upload batch completes */
  private onCompleteCallbacks: Array<(albumId: string, albumName: string, count: number) => void> = [];

  constructor() {
    // Lazy-inject to avoid circular deps
    import('./picture.service').then(m => {
      // PictureService is providedIn root, we need the injector.
      // Instead, we'll accept it via the upload method.
    });
  }

  isUploading(albumId: string): boolean {
    const u = this.activeUpload();
    return u !== null && u.albumId === albumId;
  }

  getUploadPercent(albumId: string): number {
    const u = this.activeUpload();
    return u && u.albumId === albumId ? u.percent : 0;
  }

  onComplete(cb: (albumId: string, albumName: string, count: number) => void): () => void {
    this.onCompleteCallbacks.push(cb);
    return () => {
      this.onCompleteCallbacks = this.onCompleteCallbacks.filter(c => c !== cb);
    };
  }

  /**
   * Start uploading files to an album in the background.
   * The modal should already be closed before calling this.
   */
  async uploadFiles(
    pictureService: PictureService,
    albumService: AlbumService,
    albumId: string,
    albumName: string,
    files: SelectedFile[],
    coverIndex: number | null = null
  ): Promise<void> {
    if (files.length === 0) return;

    this.activeUpload.set({ albumId, albumName, current: 0, total: files.length, percent: 0 });

    let coverPictureId: string | null = null;

    for (let i = 0; i < files.length; i++) {
      this.activeUpload.set({
        albumId,
        albumName,
        current: i + 1,
        total: files.length,
        percent: Math.round((i / files.length) * 100)
      });
      try {
        const pic = await pictureService.uploadPicture(albumId, files[i].file).toPromise();
        if (i === coverIndex && pic) {
          coverPictureId = pic.id;
        }
      } catch (err) {
        console.error(`Failed to upload "${files[i].name}":`, err);
        // Continue uploading remaining files even if one fails
      }
      this.activeUpload.set({
        albumId,
        albumName,
        current: i + 1,
        total: files.length,
        percent: Math.round(((i + 1) / files.length) * 100)
      });
    }

    // Set cover picture if one was selected
    if (coverPictureId) {
      try {
        await albumService.setCoverPicture(albumId, coverPictureId).toPromise();
      } catch {
        // Non-critical failure
      }
    }

    // Cleanup previews
    files.forEach(f => URL.revokeObjectURL(f.preview));

    // Notify listeners
    this.onCompleteCallbacks.forEach(cb => cb(albumId, albumName, files.length));

    // Keep indicator at 100% briefly, then hide
    setTimeout(() => this.activeUpload.set(null), 2000);
  }
}
