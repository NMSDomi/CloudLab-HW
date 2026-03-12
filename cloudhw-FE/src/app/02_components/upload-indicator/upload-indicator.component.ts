import { Component, inject } from '@angular/core';
import { UploadService } from '../../03_services/upload.service';
import { SHARED_IMPORTS } from '../../shared.imports';

@Component({
  selector: 'app-upload-indicator',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  template: `
    @if (uploadService.activeUpload()) {
      <div class="bg-upload-indicator">
        <div class="bg-upload-progress-ring">
          <svg viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="3" />
            <circle cx="20" cy="20" r="16" fill="none" stroke="#e94560" stroke-width="3"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="100.53"
                    [attr.stroke-dashoffset]="100.53 - (100.53 * uploadService.activeUpload()!.percent / 100)"
                    class="bg-upload-ring" />
          </svg>
          <span class="bg-upload-percent">{{ uploadService.activeUpload()!.percent }}%</span>
        </div>
        <div class="bg-upload-info">
          <span class="bg-upload-album">{{ uploadService.activeUpload()!.albumName }}</span>
          <span class="bg-upload-detail">{{ 'upload.uploading' | translate }} {{ uploadService.activeUpload()!.current }}/{{ uploadService.activeUpload()!.total }} {{ 'upload.photos' | translate }}</span>
        </div>
      </div>
    }
  `,
  styles: [`
    .bg-upload-indicator {
      position: fixed;
      bottom: 24px;
      left: 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(26, 26, 46, 0.95);
      -webkit-backdrop-filter: blur(12px);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      padding: 12px 18px 12px 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      z-index: 5000;
      animation: bgUploadIn 0.3s ease;
    }

    @keyframes bgUploadIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .bg-upload-progress-ring {
      position: relative;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
    }

    .bg-upload-progress-ring svg {
      width: 40px;
      height: 40px;
      transform: rotate(-90deg);
    }

    .bg-upload-ring {
      transition: stroke-dashoffset 0.3s ease;
    }

    .bg-upload-percent {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      font-weight: 700;
      color: #fff;
    }

    .bg-upload-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .bg-upload-album {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .bg-upload-detail {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.45);
    }
  `]
})
export class UploadIndicatorComponent {
  uploadService = inject(UploadService);
}
