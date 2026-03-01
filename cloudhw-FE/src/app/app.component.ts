import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UploadIndicatorComponent } from './02_components/upload-indicator/upload-indicator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, UploadIndicatorComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'cloudhw-FE';
}
