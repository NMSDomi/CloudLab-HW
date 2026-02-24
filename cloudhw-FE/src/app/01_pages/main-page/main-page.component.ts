import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../02_components/header/header.component';

@Component({
  selector: 'app-main-page',
  standalone: true,
  imports: [HeaderComponent, RouterOutlet],
  templateUrl: './main-page.component.html',
  styleUrls: ['./main-page.component.css'],
})
export class MainPageComponent {}
