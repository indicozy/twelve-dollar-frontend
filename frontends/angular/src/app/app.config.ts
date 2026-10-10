import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

// Zoneless (the default since Angular 21: no zone.js in the bundle). provideClientHydration() defaults: DOM
// hydration, the HttpClient transfer cache and incremental hydration (which brings event replay).
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideClientHydration(),
  ],
};
