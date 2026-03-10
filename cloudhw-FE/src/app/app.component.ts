import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UploadIndicatorComponent } from './02_components/upload-indicator/upload-indicator.component';
import { GlobalSearchComponent } from './02_components/global-search/global-search.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UploadIndicatorComponent, GlobalSearchComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'cloudhw-FE';
  // Auth initialization is handled by APP_INITIALIZER (see app.config.ts)
  // before any component or guard runs — no duplicate refresh here.
}
