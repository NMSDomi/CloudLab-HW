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
}
