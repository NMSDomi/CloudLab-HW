import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Common imports shared across the whole application.
 * Spread into each standalone component's `imports` array:
 *
 *   imports: [...SHARED_IMPORTS, MySpecificComponent]
 */
export const SHARED_IMPORTS = [
  CommonModule,
  FormsModule,
  RouterLink,
  TranslatePipe,
] as const;
