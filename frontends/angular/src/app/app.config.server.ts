import { FetchBackend, HttpBackend, HttpRequest } from '@angular/common/http';
import { ApplicationConfig, Injectable, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { BACKEND_URL } from '../server/api';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

/**
 * Server-only HttpClient backend: `/data/<path>` (the browser-facing read routes in server.ts) goes straight to
 * `BACKEND_URL/<path>` during SSR, so rendering a page costs one API call and no HTTP hop back into this server.
 * It sits after the interceptors, so the transfer cache has already keyed the request by its relative URL
 * (`/data/feed`), which is what the browser asks for: the cache hits and BACKEND_URL never reaches the page.
 */
@Injectable()
class ServerApiBackend extends FetchBackend {
  override handle(req: HttpRequest<unknown>) {
    // Platform-server's relative-URL interceptor has already made the URL absolute (`http://<host>/data/feed`).
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/data/')) {
      req = req.clone({ url: BACKEND_URL + url.pathname.slice('/data'.length) + url.search });
    }
    return super.handle(req);
  }
}

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: HttpBackend, useClass: ServerApiBackend },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
