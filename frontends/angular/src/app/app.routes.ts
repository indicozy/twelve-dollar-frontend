import { Routes } from '@angular/router';
import { feedResolver, postResolver } from './data';
import { FeedPage } from './pages/feed';
import { LoginPage } from './pages/login';
import { NotFoundPage } from './pages/not-found';
import { PostPage } from './pages/post';

// runGuardsAndResolvers: 'always' lets the enhanced like/compose submit re-run the resolver on the same URL.
export const routes: Routes = [
  { path: '', component: FeedPage, resolve: { posts: feedResolver }, runGuardsAndResolvers: 'always', title: 'Feed · Angular' },
  { path: 'posts/:id', component: PostPage, resolve: { post: postResolver }, runGuardsAndResolvers: 'always', title: 'Feed · Angular' },
  { path: 'login', component: LoginPage, title: 'Feed · Angular' },
  { path: '**', component: NotFoundPage, title: 'Feed · Angular' },
];
