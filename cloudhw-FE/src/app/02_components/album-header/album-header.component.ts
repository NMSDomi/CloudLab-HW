import { Component, input, output } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';
import { Album } from '../../04_models/album.model';

@Component({
  selector: 'app-album-header',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './album-header.component.html',
  styleUrls: ['./album-header.component.css']
})
export class AlbumHeaderComponent {
  album             = input.required<Album>();
  isOwner           = input(false);
  downloading       = input(false);
  visibilityToggling = input(false);

  backClicked        = output<void>();
  visibilityToggled  = output<void>();
  filesSelected      = output<FileList>();
  shareClicked       = output<void>();
  copyLink           = output<void>();
  downloadClicked    = output<void>();
  deleteClicked      = output<void>();

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.filesSelected.emit(input.files);
      input.value = '';
    }
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
