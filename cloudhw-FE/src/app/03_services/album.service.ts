import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Album } from '../04_models/album.model';
import { environmentUrls } from '../../enviroment/enviroment';

@Injectable({ providedIn: 'root' })
export class AlbumService {
  private http = inject(HttpClient);

  getMyAlbums(): Observable<Album[]> {
    return this.http.get<Album[]>(`${environmentUrls.albums}/my`);
  }

  getPublicAlbums(): Observable<Album[]> {
    return this.http.get<Album[]>(`${environmentUrls.albums}/public`);
  }

  getSharedWithMe(): Observable<Album[]> {
    return this.http.get<Album[]>(`${environmentUrls.albums}/shared`);
  }

  getAlbum(id: string): Observable<Album> {
    return this.http.get<Album>(`${environmentUrls.albums}/${id}`);
  }

  createAlbum(data: { name: string; description?: string; isPublic: boolean }): Observable<Album> {
    return this.http.post<Album>(environmentUrls.albums, data);
  }

  updateAlbum(id: string, data: { name: string; description?: string; isPublic: boolean }): Observable<Album> {
    return this.http.put<Album>(`${environmentUrls.albums}/${id}`, data);
  }

  deleteAlbum(id: string): Observable<void> {
    return this.http.delete<void>(`${environmentUrls.albums}/${id}`);
  }

  setCoverPicture(albumId: string, pictureId: string): Observable<void> {
    return this.http.put<void>(`${environmentUrls.albums}/${albumId}/cover`, { pictureId });
  }

  getCoverThumbnailUrl(albumId: string): string {
    return `${environmentUrls.albums}/${albumId}/cover`;
  }

  searchAlbums(query: string): Observable<Album[]> {
    return this.http.get<Album[]>(`${environmentUrls.albums}/search`, { params: { q: query } });
  }

  shareAlbum(albumId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${environmentUrls.albums}/${albumId}/share`, { userId });
  }

  unshareAlbum(albumId: string, targetUserId: string): Observable<void> {
    return this.http.delete<void>(`${environmentUrls.albums}/${albumId}/share/${encodeURIComponent(targetUserId)}`);
  }

  downloadAlbumZip(albumId: string): Observable<Blob> {
    return this.http.get(`${environmentUrls.albums}/${albumId}/download`, { responseType: 'blob' });
  }

  getAlbumShares(albumId: string): Observable<{ userId: string; userName: string; sharedAt: string }[]> {
    return this.http.get<{ userId: string; userName: string; sharedAt: string }[]>(
      `${environmentUrls.albums}/${albumId}/shares`
    );
  }
}
