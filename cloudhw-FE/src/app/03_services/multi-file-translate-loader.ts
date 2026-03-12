import { TranslateLoader } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Maps each namespace filename to the key used in translation strings.
 * e.g. 'password-strength' → 'passwordStrength'
 */
const NAMESPACES: { file: string; key: string }[] = [
  { file: 'common',            key: 'common'          },
  { file: 'auth',              key: 'auth'             },
  { file: 'header',            key: 'header'           },
  { file: 'home',              key: 'home'             },
  { file: 'album',             key: 'album'            },
  { file: 'profile',           key: 'profile'          },
  { file: 'share',             key: 'share'            },
  { file: 'search',            key: 'search'           },
  { file: 'upload',            key: 'upload'           },
  { file: 'password-strength', key: 'passwordStrength' },
];

export class MultiFileTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient, private prefix = 'assets/i18n') {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTranslation(lang: string): Observable<any> {
    const requests: Record<string, Observable<object>> = {};

    for (const ns of NAMESPACES) {
      requests[ns.key] = this.http
        .get<object>(`${this.prefix}/${lang}/${ns.file}.json`)
        .pipe(catchError(() => of({})));
    }

    return forkJoin(requests);
  }
}
