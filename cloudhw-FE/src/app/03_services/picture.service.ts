import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Picture } from '../04_models/picture.model';
import { environmentUrls } from '../../enviroment/enviroment';

@Injectable({ providedIn: 'root' })
export class PictureService {
  private http = inject(HttpClient);

  getAlbumPictures(albumId: string): Observable<Picture[]> {
    return this.http.get<Picture[]>(`${environmentUrls.pictures}/album/${albumId}`);
  }

  getAlbumThumbnails(albumId: string): Observable<any[]> {
    return this.http.get<any[]>(`${environmentUrls.pictures}/album/${albumId}/thumbnails`);
  }

  getPicture(id: string): Observable<Picture> {
    return this.http.get<Picture>(`${environmentUrls.pictures}/${id}`);
  }

  uploadPicture(albumId: string, file: File): Observable<Picture> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<Picture>(`${environmentUrls.pictures}/album/${albumId}`, formData);
  }

  deletePicture(id: string): Observable<void> {
    return this.http.delete<void>(`${environmentUrls.pictures}/${id}`);
  }

  getThumbnailUrl(pictureId: string): string {
    return `${environmentUrls.pictures}/${pictureId}/thumbnail`;
  }
  
  getThumbnailBlob(id: string): Observable<Blob> {
    return this.http.get(`${environmentUrls.pictures}/${id}/thumbnail`, { 
      responseType: 'blob' 
    });
  }

  getDataUrl(pictureId: string): string {
    return `${environmentUrls.pictures}/${pictureId}/data`;
  }
}
