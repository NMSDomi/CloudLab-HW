import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { SHARED_IMPORTS } from '../../shared.imports';

export interface PasswordStrength {
  score: number;        // 0–4
  label: string;
  color: string;
  glow: string;
  segments: boolean[];  // which of 4 segments are lit
  rules: PasswordRule[];
}

export interface PasswordRule {
  label: string;
  met: boolean;
}

@Component({
  selector: 'app-password-strength',
  standalone: true,
  imports: [...SHARED_IMPORTS],
  templateUrl: './password-strength.component.html',
  styleUrls: ['./password-strength.component.css']
})
export class PasswordStrengthComponent implements OnChanges {
  @Input() password = '';
  @Output() valid = new EventEmitter<boolean>();

  strength: PasswordStrength = this.evaluate('');

  ngOnChanges() {
    this.strength = this.evaluate(this.password);
    this.valid.emit(this.strength.rules.every(r => r.met));
  }

  private evaluate(pw: string): PasswordStrength {
    const rules: PasswordRule[] = [
      { label: 'passwordStrength.minChars',  met: pw.length >= 8 },
      { label: 'passwordStrength.uppercase', met: /[A-Z]/.test(pw) },
      { label: 'passwordStrength.lowercase', met: /[a-z]/.test(pw) },
      { label: 'passwordStrength.number',    met: /\d/.test(pw) },
      { label: 'passwordStrength.special',   met: /[^A-Za-z0-9]/.test(pw) },
    ];

    const metCount = rules.filter(r => r.met).length;

    const levels: { label: string; color: string; glow: string }[] = [
      { label: 'passwordStrength.veryWeak',  color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
      { label: 'passwordStrength.weak',      color: '#f97316', glow: 'rgba(249, 115, 22, 0.4)' },
      { label: 'passwordStrength.medium',    color: '#eab308', glow: 'rgba(234, 179, 8, 0.35)' },
      { label: 'passwordStrength.strong',    color: '#22c55e', glow: 'rgba(34, 197, 94, 0.4)' },
      { label: 'passwordStrength.veryStrong',color: '#16a34a', glow: 'rgba(22, 163, 74, 0.5)' },
    ];

    let score: number;
    if (pw.length >= 12 && metCount === 5) score = 4;
    else if (metCount === 5) score = 3;
    else if (metCount >= 3) score = 2;
    else if (metCount >= 2) score = 1;
    else score = 0;

    const empty: PasswordStrength = {
      score: 0, label: '', color: 'transparent', glow: 'transparent',
      segments: [false, false, false, false], rules
    };
    if (pw.length === 0) return empty;

    const level = levels[Math.min(score, levels.length - 1)];
    // segments 0..3 — light up (score+1) out of 4 if score < 4, else all 4
    const litCount = Math.min(score + 1, 4);
    const segments = [0, 1, 2, 3].map(i => i < litCount);

    return { score, label: level.label, color: level.color, glow: level.glow, segments, rules };
  }
}
